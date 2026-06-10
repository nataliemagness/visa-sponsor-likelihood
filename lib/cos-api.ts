import path from 'path'
import fs from 'fs'

// UK SIC 2007 division ranges → Home Office XLSX industry label (exact strings from the file)
const SIC_SECTIONS: [number, number, string][] = [
  [1,  3,  'Agriculture, Forestry and Fishing'],
  [5,  9,  'Mining and Quarrying'],
  [10, 33, 'Manufacturing'],
  [35, 35, 'Electricity, gas, steam and air conditioning supply'],
  [36, 39, 'Water supply; sewerage, waste management and remediation activities'],
  [41, 43, 'Construction'],
  [45, 47, 'Wholesale and retail trade; repair of motor vehicles and motorcycles'],
  [49, 53, 'Transportation and Storage'],
  [55, 56, 'Accommodation and Food Service Activities'],
  [58, 63, 'Information and Communications'],
  [64, 66, 'Financial and Insurance Activities'],
  [68, 68, 'Real estate activities'],
  [69, 75, 'Professional, Scientific and Technical Activities'],
  [77, 82, 'Administrative and support service activities'],
  [84, 84, 'Public administration and defence; compulsory social security'],
  [85, 85, 'Education'],
  [86, 88, 'Human Health and Social Work Activities'],
  [90, 93, 'Arts, Entertainment and Recreation'],
  [94, 96, 'Other Service Activities'],
  [97, 98, 'Activities of households as employers; production activities of household for own use'],
  [99, 99, 'Activities of extraterritorial organisations and bodies'],
]

// Pre-computed from the Home Office Work Sponsorship XLSX (Q1 2023 release).
// Worker (Skilled Worker) CoS, 2020-2022 complete years.
// sqrt-normalised against max industry (Healthcare = 1.0).
// Refreshed and overridden by running seed:historic.
export const HARDCODED_BENCHMARKS: Record<string, number> = {
  'Human Health and Social Work Activities':                                                    1.00,
  'Information and Communications':                                                             0.69,
  'Professional, Scientific and Technical Activities':                                          0.62,
  'Arts, Entertainment and Recreation':                                                         0.62,
  'Education':                                                                                  0.59,
  'Agriculture, Forestry and Fishing':                                                          0.56,
  'Financial and Insurance Activities':                                                         0.54,
  'Manufacturing':                                                                              0.43,
  'Other Service Activities':                                                                   0.41,
  'Administrative and support service activities':                                              0.39,
  'Accommodation and Food Service Activities':                                                  0.39,
  'Wholesale and retail trade; repair of motor vehicles and motorcycles':                       0.35,
  'Construction':                                                                               0.33,
  'Transportation and Storage':                                                                 0.30,
  'Mining and Quarrying':                                                                       0.28,
  'Public administration and defence; compulsory social security':                              0.28,
  'Electricity, gas, steam and air conditioning supply':                                        0.28,
  'Real estate activities':                                                                     0.26,
  'Activities of extraterritorial organisations and bodies':                                    0.26,
  'Water supply; sewerage, waste management and remediation activities':                        0.23,
  'Activities of households as employers; production activities of household for own use':      0.22,
}

export type IndustryBenchmarkFile = {
  generatedAt: string
  xlsxUrl: string
  years: number[]
  benchmarks: Record<string, number>
  rawTotals: Record<string, number>
}

const BENCHMARK_PATH = path.join(process.cwd(), 'data', 'industry-benchmarks.json')

// globalThis cache so HMR reloads don't re-read disk on every request
declare global {
  // eslint-disable-next-line no-var
  var __industryBenchmarks: Record<string, number> | undefined
}

export function loadBenchmarks(): Record<string, number> {
  if (global.__industryBenchmarks) return global.__industryBenchmarks
  try {
    if (fs.existsSync(BENCHMARK_PATH)) {
      const data = JSON.parse(fs.readFileSync(BENCHMARK_PATH, 'utf-8')) as IndustryBenchmarkFile
      global.__industryBenchmarks = data.benchmarks
      return data.benchmarks
    }
  } catch {}
  global.__industryBenchmarks = HARDCODED_BENCHMARKS
  return HARDCODED_BENCHMARKS
}

export function clearBenchmarkCache(): void {
  global.__industryBenchmarks = undefined
}

/** Map a list of SIC codes to the matching Home Office industry label. */
export function sicToIndustry(sicCodes: string[] | null | undefined): string | null {
  if (!sicCodes || sicCodes.length === 0) return null
  for (const sic of sicCodes) {
    const division = parseInt(sic.slice(0, 2), 10)
    if (isNaN(division)) continue
    for (const [lo, hi, label] of SIC_SECTIONS) {
      if (division >= lo && division <= hi) return label
    }
  }
  return null
}

/** 0-1 score for a company's industry. Falls back to neutral 0.45 when unknown. */
export function industryToScore(
  industry: string | null,
  benchmarks: Record<string, number>,
): number {
  if (!industry) return 0.45
  return benchmarks[industry] ?? 0.40
}

// ── XLSX download + parsing ───────────────────────────────────────────────────

async function findWorkSponsorshipXlsxUrl(): Promise<string> {
  const res = await fetch(
    'https://www.gov.uk/api/content/government/statistical-data-sets/managed-migration-datasets',
    { headers: { 'User-Agent': 'SponsorIQ/1.0' }, signal: AbortSignal.timeout(15_000) },
  )
  if (!res.ok) throw new Error(`GOV.UK API returned HTTP ${res.status}`)

  const json = await res.json() as {
    details?: { attachments?: Array<{ url?: string; title?: string; content_type?: string }> }
  }

  const xlsxMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const attachments = json.details?.attachments ?? []

  const match =
    attachments.find(a =>
      a.content_type === xlsxMime &&
      (a.title?.toLowerCase().includes('work') || a.title?.toLowerCase().includes('certificate')),
    ) ?? attachments.find(a => a.content_type === xlsxMime)

  if (!match?.url) {
    throw new Error(
      `No Work Sponsorship XLSX found. Attachments: [${attachments.map(a => a.title).join(', ')}]`,
    )
  }
  return match.url
}

export async function downloadAndSaveBenchmarks(): Promise<IndustryBenchmarkFile> {
  const xlsxUrl = await findWorkSponsorshipXlsxUrl()

  const res = await fetch(xlsxUrl, {
    headers: { 'User-Agent': 'SponsorIQ/1.0' },
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`XLSX download failed: HTTP ${res.status}`)

  const buffer = await res.arrayBuffer()

  // Dynamic import keeps xlsx out of the Next.js client bundle
  const XLSX = await import('xlsx')
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })

  // Find the data sheet (e.g. "Data - CoS_D01")
  const sheetName =
    wb.SheetNames.find(n => n.startsWith('Data - CoS')) ??
    wb.SheetNames.find(n => n.toLowerCase().includes('data')) ??
    wb.SheetNames[0]

  const ws = wb.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][]

  // Row 0: title row; Row 1: headers (Year, Quarter, Type, Category, Industry, Applications)
  const YEAR_COL = 0
  const CAT_COL  = 3
  const IND_COL  = 4
  const APP_COL  = 5

  // Identify the 3 most recent COMPLETE years (partial years have fewer rows)
  const yearCounts = new Map<number, number>()
  for (const row of rawRows.slice(2)) {
    const yr = Number(row[YEAR_COL])
    if (yr > 2000 && yr < 2100) yearCounts.set(yr, (yearCounts.get(yr) ?? 0) + 1)
  }
  const completeYears = [...yearCounts.entries()]
    .sort((a, b) => b[0] - a[0])
    .filter(([, count]) => count > 80) // partial years have far fewer rows
    .slice(0, 3)
    .map(([yr]) => yr)

  if (completeYears.length === 0) throw new Error('Could not identify complete years in XLSX data')

  // Aggregate: Worker (Skilled Worker) route, not Temporary Worker
  const rawTotals: Record<string, number> = {}
  for (const row of rawRows.slice(2)) {
    const yr = Number(row[YEAR_COL])
    if (!completeYears.includes(yr)) continue
    const cat = String(row[CAT_COL]).toLowerCase()
    if (!cat.includes('worker') || cat.includes('temporary')) continue
    const industry = String(row[IND_COL]).trim()
    if (!industry || industry === 'End of table') continue
    const n = parseInt(String(row[APP_COL]).replace(/,/g, ''), 10) || 0
    rawTotals[industry] = (rawTotals[industry] ?? 0) + n
  }

  if (Object.keys(rawTotals).length === 0) {
    throw new Error(`No industry data found. Sheet: "${sheetName}", years: ${completeYears.join(', ')}`)
  }

  // sqrt-normalise against max industry
  const maxTotal = Math.max(...Object.values(rawTotals))
  const benchmarks: Record<string, number> = {}
  for (const [industry, total] of Object.entries(rawTotals)) {
    benchmarks[industry] = Math.round((0.2 + 0.8 * Math.sqrt(total / maxTotal)) * 100) / 100
  }

  const result: IndustryBenchmarkFile = {
    generatedAt: new Date().toISOString(),
    xlsxUrl,
    years: completeYears.sort(),
    benchmarks,
    rawTotals,
  }

  fs.mkdirSync(path.dirname(BENCHMARK_PATH), { recursive: true })
  fs.writeFileSync(BENCHMARK_PATH, JSON.stringify(result, null, 2))

  // Bust the in-process cache so scoring picks up the new values immediately
  clearBenchmarkCache()

  return result
}
