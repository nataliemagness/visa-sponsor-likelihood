/**
 * Repeatedly calls /api/seed/historic until the target number of CH-enriched
 * companies is reached.
 *
 * Usage:
 *   npx tsx scripts/bulk-enrich.ts --target 5000
 *   npx tsx scripts/bulk-enrich.ts --target 5000 --port 3001
 *   npx tsx scripts/bulk-enrich.ts --target 5000 --url http://localhost:3001
 */

const BATCH_SIZE = 300
const GAP_BETWEEN_ROUNDS_MS = 2_000
const MAX_CONSECUTIVE_ERRORS = 3
const FETCH_TIMEOUT_MS = 330_000
const PROBE_PORTS = [3000, 3001, 3002, 3003]

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(): { target: number; baseUrl: string | null } {
  const args = process.argv.slice(2)
  let target = 0
  let port: number | null = null
  let baseUrl: string | null = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) {
      target = parseInt(args[++i], 10)
    } else if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[++i], 10)
    } else if (args[i] === '--url' && args[i + 1]) {
      baseUrl = args[++i]
    }
  }

  if (!target || isNaN(target)) {
    console.error('Usage: npx tsx scripts/bulk-enrich.ts --target <number> [--port <port>] [--url <url>]')
    process.exit(1)
  }

  if (port) baseUrl = `http://localhost:${port}`
  return { target, baseUrl }
}

// ── Port auto-detection ───────────────────────────────────────────────────────

async function detectPort(): Promise<string> {
  for (const port of PROBE_PORTS) {
    try {
      const res = await fetch(`http://localhost:${port}/api/seed/status`, {
        signal: AbortSignal.timeout(2_000),
      })
      if (res.ok) {
        console.log(`[bulk-enrich] Auto-detected dev server on port ${port}`)
        return `http://localhost:${port}`
      }
    } catch {
      // port not responding — try next
    }
  }
  console.error(
    `[bulk-enrich] Could not find dev server on ports ${PROBE_PORTS.join(', ')}.\n` +
    `Start your dev server first, then re-run with --port if it is on a non-standard port.`,
  )
  process.exit(1)
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SeedStatus = { count: number; seededAt: string | null }
type HistoricResult = {
  success: boolean
  ch?: { fetched: number; failed: number; alreadyHad: number; skippedLimit: number }
  duration?: number
  error?: string
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { target, baseUrl: argUrl } = parseArgs()
  const baseUrl = argUrl ?? await detectPort()

  console.log(`[bulk-enrich] Target: ${target} enriched companies  |  API: ${baseUrl}`)

  // Check current enrichment count
  const statusRes = await fetch(`${baseUrl}/api/seed/status`)
  const status = (await statusRes.json()) as SeedStatus
  console.log(`[bulk-enrich] DB has ${status.count} total companies`)

  let consecutiveErrors = 0
  let round = 0

  while (true) {
    round++
    console.log(`\n[bulk-enrich] ── Round ${round} ──────────────────────────────`)

    let result: HistoricResult
    try {
      const res = await fetch(`${baseUrl}/api/seed/historic`, {
        method: 'POST',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      result = (await res.json()) as HistoricResult
    } catch (err) {
      consecutiveErrors++
      console.error(`[bulk-enrich] Network error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err)
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error('[bulk-enrich] Too many consecutive errors — aborting.')
        process.exit(1)
      }
      await sleep(GAP_BETWEEN_ROUNDS_MS)
      continue
    }

    if (!result.success) {
      consecutiveErrors++
      console.error(`[bulk-enrich] API error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, result.error)
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error('[bulk-enrich] Too many consecutive errors — aborting.')
        process.exit(1)
      }
      await sleep(GAP_BETWEEN_ROUNDS_MS)
      continue
    }

    consecutiveErrors = 0
    const ch = result.ch!
    const totalEnriched = ch.alreadyHad + ch.fetched

    console.log(
      `[bulk-enrich] Done in ${result.duration}s — ` +
      `fetched: ${ch.fetched}, already had: ${ch.alreadyHad}, ` +
      `failed: ${ch.failed}, deferred: ${ch.skippedLimit}`,
    )
    console.log(`[bulk-enrich] Total enriched so far: ${totalEnriched} / ${target}`)

    if (totalEnriched >= target) {
      console.log(`\n[bulk-enrich] ✓ Target of ${target} enriched companies reached!`)
      break
    }

    if (ch.skippedLimit === 0 && ch.fetched === 0) {
      console.log('[bulk-enrich] No unenriched companies left — stopping.')
      break
    }

    console.log(`[bulk-enrich] Waiting ${GAP_BETWEEN_ROUNDS_MS}ms before next round…`)
    await sleep(GAP_BETWEEN_ROUNDS_MS)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(err => {
  console.error('[bulk-enrich] Fatal error:', err)
  process.exit(1)
})
