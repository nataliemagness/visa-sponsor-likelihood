/**
 * CLI: npx tsx scripts/seed-historic.ts [--ch-limit <n>]
 *
 * Downloads the Home Office Work Sponsorship CoS XLSX, builds industry
 * benchmarks, then batch-fetches Companies House data.
 *
 * The register must already be seeded (npm run seed) before running this.
 * CH batch limit defaults to Infinity for the CLI (processes all companies).
 */
import { runHistoricSeed } from '../lib/seed-historic'

const args = process.argv.slice(2)
const limitIdx = args.indexOf('--ch-limit')
const chBatchLimit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity

async function main() {
  console.log('=== SponsorIQ historic seed ===')
  if (isFinite(chBatchLimit)) {
    console.log(`CH batch limit: ${chBatchLimit}`)
  } else {
    console.log('CH batch limit: unlimited (all unenriched companies)')
  }
  console.log()

  const result = await runHistoricSeed({
    chBatchLimit,
    onProgress: msg => console.log(`  ${msg}`),
  })

  console.log()
  console.log('=== Done ===')
  console.log(`Industry benchmarks: ${result.benchmarks.industries} industries (${result.benchmarks.years.join(', ')})`)
  console.log(`CH enrichment: ${result.ch.fetched} fetched, ${result.ch.failed} failed, ${result.ch.alreadyHad} already had data, ${result.ch.skippedLimit} skipped (limit)`)
  console.log(`Duration: ${result.duration}s`)
}

main().catch(err => {
  console.error('Historic seed failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
