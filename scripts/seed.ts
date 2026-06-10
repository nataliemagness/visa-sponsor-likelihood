/**
 * CLI seed script — run with:  npx tsx scripts/seed.ts
 */
import fs from 'fs'
import path from 'path'
import { runSeed } from '../lib/seed-register'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'sponsors.json')

async function main() {
  console.log('Fetching UK Sponsor Register CSV URL from GOV.UK…')
  const result = await runSeed()

  console.log(`Parsed ${result.count} companies (${result.skipped} skipped)`)
  console.log(`Source: ${result.csvUrl}`)

  fs.mkdirSync(DATA_DIR, { recursive: true })
  const data = {
    seededAt: result.seededAt,
    count: result.count,
    companies: result.companies,
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(data))
  console.log(`Saved to ${DB_PATH}`)
}

main().catch((err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
