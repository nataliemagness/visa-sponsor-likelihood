import { downloadAndSaveBenchmarks, type IndustryBenchmarkFile } from './cos-api'
import { getCompanies, countCompanies, bulkUpdateCH, type CHUpdate } from './db/store'
import { fetchCHByName } from './ch-api'

export type HistoricSeedResult = {
  benchmarks: {
    industries: number
    xlsxUrl: string
    years: number[]
    refreshed: boolean
  }
  ch: {
    fetched: number
    failed: number
    alreadyHad: number
    skippedLimit: number
  }
  duration: number
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Runs the historic seed pipeline:
 *  1. Downloads the Home Office Work Sponsorship XLSX and rebuilds industry benchmarks.
 *  2. Batch-fetches Companies House data for companies that haven't been enriched yet,
 *     prioritising A-rated Skilled Worker sponsors.
 *
 * Rate limit: CH API allows 600 req / 5 min ≈ 2 req/sec.
 * chBatchLimit caps the number of new CH fetches per run to keep the operation time bounded.
 * Default 200 ≈ ~2 minutes. Set to Infinity in CLI scripts.
 */
export async function runHistoricSeed(options?: {
  chBatchLimit?: number
  onProgress?: (msg: string) => void
}): Promise<HistoricSeedResult> {
  const { chBatchLimit = 200, onProgress = () => {} } = options ?? {}
  const start = Date.now()

  if (countCompanies() === 0) {
    throw new Error('Sponsor register not seeded yet — run "Seed real data" first.')
  }

  // ── 1. Download and rebuild industry benchmarks ───────────────────────────
  onProgress('Downloading Work Sponsorship CoS XLSX from GOV.UK…')
  let benchmarkFile: IndustryBenchmarkFile
  const benchmarksRefreshed = true

  try {
    benchmarkFile = await downloadAndSaveBenchmarks()
    onProgress(
      `Built benchmarks for ${Object.keys(benchmarkFile.benchmarks).length} industries ` +
      `(years: ${benchmarkFile.years.join(', ')})`,
    )
  } catch (err) {
    throw new Error(
      `Benchmark download failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  // ── 2. Batch-fetch Companies House ────────────────────────────────────────
  if (!process.env.COMPANIES_HOUSE_API_KEY) {
    onProgress('COMPANIES_HOUSE_API_KEY not set — skipping CH enrichment')
    return buildResult(benchmarkFile, benchmarksRefreshed, 0, 0, 0, 0, start)
  }

  const companies = getCompanies()
  const unenriched = companies.filter(c => !c.chFetchedAt)
  const alreadyHad = companies.length - unenriched.length

  onProgress(
    `${unenriched.length} companies without CH data (${alreadyHad} already enriched)`,
  )

  // Prioritise: A-rated first, then Skilled Worker route, then alphabetical
  const prioritised = [...unenriched].sort((a, b) => {
    const aRank = (a.sponsorRating?.toLowerCase().startsWith('a') ? 0 : 2) +
                  (a.sponsorRoute?.toLowerCase().includes('skilled') ? 0 : 1)
    const bRank = (b.sponsorRating?.toLowerCase().startsWith('a') ? 0 : 2) +
                  (b.sponsorRoute?.toLowerCase().includes('skilled') ? 0 : 1)
    if (aRank !== bRank) return aRank - bRank
    return a.name.localeCompare(b.name)
  })

  const toFetch = prioritised.slice(0, chBatchLimit)
  const skippedLimit = Math.max(0, unenriched.length - chBatchLimit)

  // Accumulate updates in memory — one bulk write at the end avoids N disk writes
  const updates = new Map<string, CHUpdate>()
  let fetched = 0
  let failed = 0

  // ~1.9 req/sec — comfortably under the 600/5min rate limit
  const MS_BETWEEN_REQUESTS = 530

  for (let i = 0; i < toFetch.length; i++) {
    if (i > 0) await sleep(MS_BETWEEN_REQUESTS)

    const company = toFetch[i]
    try {
      const chData = await fetchCHByName(company.name)
      if (chData) {
        updates.set(company.slug, chData)
        fetched++
      } else {
        failed++
      }
    } catch {
      failed++
    }

    if ((i + 1) % 50 === 0 || i === toFetch.length - 1) {
      onProgress(`CH enrichment: ${i + 1}/${toFetch.length} processed (${fetched} matched)`)
      // Flush accumulated updates to disk every 50 companies so progress isn't lost
      if (updates.size > 0) {
        bulkUpdateCH(updates)
        updates.clear()
      }
    }
  }

  // Final flush
  if (updates.size > 0) bulkUpdateCH(updates)

  return buildResult(benchmarkFile, benchmarksRefreshed, fetched, failed, alreadyHad, skippedLimit, start)
}

function buildResult(
  benchmarkFile: IndustryBenchmarkFile,
  refreshed: boolean,
  fetched: number,
  failed: number,
  alreadyHad: number,
  skippedLimit: number,
  start: number,
): HistoricSeedResult {
  return {
    benchmarks: {
      industries: Object.keys(benchmarkFile.benchmarks).length,
      xlsxUrl: benchmarkFile.xlsxUrl,
      years: benchmarkFile.years,
      refreshed,
    },
    ch: { fetched, failed, alreadyHad, skippedLimit },
    duration: Math.round((Date.now() - start) / 1000),
  }
}
