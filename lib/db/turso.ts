import { createClient } from '@libsql/client/http'
import type { Client, Row } from '@libsql/client'
import type { CompanyRecord, CHUpdate } from './store'

// ── Client singleton (survives Lambda warm re-use) ───────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __tursoClient: Client | undefined
}

function getClient(): Client {
  if (!process.env.TURSO_URL) throw new Error('TURSO_URL is not set')
  if (!global.__tursoClient) {
    global.__tursoClient = createClient({
      url: process.env.TURSO_URL,
      authToken: process.env.TURSO_AUTH_TOKEN ?? '',
    })
  }
  return global.__tursoClient
}

// ── Schema ───────────────────────────────────────────────────────────────────
// Called on first use — IF NOT EXISTS makes it idempotent on warm starts too.
let _schemaReady: Promise<void> | null = null

function ensureSchema(): Promise<void> {
  if (_schemaReady) return _schemaReady
  _schemaReady = (async () => {
    const db = getClient()
    await db.execute(`
      CREATE TABLE IF NOT EXISTS companies (
        slug                  TEXT PRIMARY KEY,
        name                  TEXT NOT NULL,
        town                  TEXT,
        county                TEXT,
        sponsor_route         TEXT,
        sponsor_sub_tier      TEXT,
        sponsor_rating        TEXT,
        company_number        TEXT,
        ch_status             TEXT,
        sic_codes             TEXT,
        registered_address    TEXT,
        employee_count        INTEGER,
        employee_accounts_type TEXT,
        incorporation_date    TEXT,
        ch_fetched_at         TEXT,
        live_job_count        INTEGER,
        live_job_fetched_at   TEXT,
        last_updated          TEXT NOT NULL
      )
    `)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS metadata (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_companies_name ON companies (name)
    `)
  })()
  return _schemaReady
}

// ── Row mapper ───────────────────────────────────────────────────────────────
function rowToRecord(row: Row): CompanyRecord {
  const sicRaw = row.sic_codes as string | null
  return {
    slug:                  row.slug                   as string,
    name:                  row.name                   as string,
    town:                  row.town                   as string | null,
    county:                row.county                 as string | null,
    sponsorRoute:          row.sponsor_route          as string | null,
    sponsorSubTier:        row.sponsor_sub_tier       as string | null,
    sponsorRating:         row.sponsor_rating         as string | null,
    companyNumber:         row.company_number         as string | null,
    chStatus:              row.ch_status              as string | null,
    sicCodes:              sicRaw ? JSON.parse(sicRaw) as string[] : null,
    registeredAddress:     row.registered_address     as string | null,
    employeeCount:         row.employee_count         as number | null,
    employeeAccountsType:  row.employee_accounts_type as string | null,
    incorporationDate:     row.incorporation_date     as string | null,
    chFetchedAt:           row.ch_fetched_at          as string | null,
    liveJobCount:          row.live_job_count         as number | null,
    liveJobFetchedAt:      row.live_job_fetched_at    as string | null,
    lastUpdated:           row.last_updated           as string,
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function tursoCount(): Promise<number> {
  await ensureSchema()
  const db = getClient()
  const res = await db.execute('SELECT COUNT(*) AS n FROM companies')
  return (res.rows[0].n as number) ?? 0
}

export async function tursoGetSeededAt(): Promise<string | null> {
  await ensureSchema()
  const db = getClient()
  const res = await db.execute({
    sql: "SELECT value FROM metadata WHERE key = 'seeded_at'",
    args: [],
  })
  return (res.rows[0]?.value as string) ?? null
}

export async function tursoGetBySlug(slug: string): Promise<CompanyRecord | null> {
  await ensureSchema()
  const db = getClient()
  const res = await db.execute({ sql: 'SELECT * FROM companies WHERE slug = ?', args: [slug] })
  return res.rows.length ? rowToRecord(res.rows[0]) : null
}

export async function tursoSearch(
  query: string,
  route?: string,
  limit = 50,
): Promise<CompanyRecord[]> {
  await ensureSchema()
  const db = getClient()

  const parts: string[] = []
  const args: (string | number)[] = []

  if (query.trim()) {
    parts.push('name LIKE ?')
    args.push(`%${query}%`)
  }
  if (route) {
    parts.push('sponsor_route LIKE ?')
    args.push(`%${route}%`)
  }

  const where = parts.length ? `WHERE ${parts.join(' AND ')}` : ''
  args.push(limit)

  const res = await db.execute({
    sql: `SELECT * FROM companies ${where} ORDER BY name LIMIT ?`,
    args,
  })
  return res.rows.map(rowToRecord)
}

const BATCH_SIZE = 500

export async function tursoSave(companies: CompanyRecord[]): Promise<void> {
  await ensureSchema()
  const db = getClient()
  await db.execute('DELETE FROM companies')

  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    await db.batch(
      companies.slice(i, i + BATCH_SIZE).map((c) => ({
        sql: `INSERT OR REPLACE INTO companies
          (slug, name, town, county, sponsor_route, sponsor_sub_tier, sponsor_rating,
           company_number, ch_status, sic_codes, registered_address, employee_count,
           employee_accounts_type, incorporation_date, ch_fetched_at,
           live_job_count, live_job_fetched_at, last_updated)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          c.slug, c.name, c.town, c.county,
          c.sponsorRoute, c.sponsorSubTier, c.sponsorRating,
          c.companyNumber, c.chStatus,
          c.sicCodes ? JSON.stringify(c.sicCodes) : null,
          c.registeredAddress, c.employeeCount, c.employeeAccountsType,
          c.incorporationDate, c.chFetchedAt,
          c.liveJobCount, c.liveJobFetchedAt,
          c.lastUpdated,
        ],
      })),
      'write',
    )
  }

  await db.execute({
    sql: "INSERT OR REPLACE INTO metadata (key, value) VALUES ('seeded_at', ?)",
    args: [new Date().toISOString()],
  })
}

export async function tursoUpdateCH(slug: string, ch: CHUpdate): Promise<void> {
  await ensureSchema()
  const db = getClient()
  await db.execute({
    sql: `UPDATE companies SET
      company_number = ?, ch_status = ?, sic_codes = ?, registered_address = ?,
      employee_count = ?, employee_accounts_type = ?, incorporation_date = ?,
      ch_fetched_at = ?
      WHERE slug = ?`,
    args: [
      ch.companyNumber, ch.chStatus,
      ch.sicCodes ? JSON.stringify(ch.sicCodes) : null,
      ch.registeredAddress, ch.employeeCount, ch.employeeAccountsType,
      ch.incorporationDate, new Date().toISOString(),
      slug,
    ],
  })
}

export async function tursoUpdateReed(slug: string, liveJobCount: number): Promise<void> {
  await ensureSchema()
  const db = getClient()
  await db.execute({
    sql: 'UPDATE companies SET live_job_count = ?, live_job_fetched_at = ? WHERE slug = ?',
    args: [liveJobCount, new Date().toISOString(), slug],
  })
}

export async function tursoBulkUpdateCH(updates: Map<string, CHUpdate>): Promise<number> {
  if (updates.size === 0) return 0
  await ensureSchema()
  const db = getClient()
  const now = new Date().toISOString()

  const statements = [...updates.entries()].map(([slug, ch]) => ({
    sql: `UPDATE companies SET
      company_number = ?, ch_status = ?, sic_codes = ?, registered_address = ?,
      employee_count = ?, employee_accounts_type = ?, incorporation_date = ?,
      ch_fetched_at = ?
      WHERE slug = ?`,
    args: [
      ch.companyNumber, ch.chStatus,
      ch.sicCodes ? JSON.stringify(ch.sicCodes) : null,
      ch.registeredAddress, ch.employeeCount, ch.employeeAccountsType,
      ch.incorporationDate, now,
      slug,
    ],
  }))

  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    await db.batch(statements.slice(i, i + BATCH_SIZE), 'write')
  }

  return updates.size
}

// Used by seed:historic — avoids loading all 55k records when only unenriched ones are needed.
export async function tursoGetUnenriched(limit?: number): Promise<CompanyRecord[]> {
  await ensureSchema()
  const db = getClient()
  const sql = limit
    ? `SELECT * FROM companies WHERE ch_fetched_at IS NULL
       ORDER BY
         CASE WHEN lower(sponsor_rating) LIKE '%(a %' THEN 0 ELSE 1 END,
         CASE WHEN sponsor_route LIKE '%killed%' THEN 0 ELSE 1 END,
         name
       LIMIT ?`
    : `SELECT * FROM companies WHERE ch_fetched_at IS NULL
       ORDER BY
         CASE WHEN lower(sponsor_rating) LIKE '%(a %' THEN 0 ELSE 1 END,
         CASE WHEN sponsor_route LIKE '%killed%' THEN 0 ELSE 1 END,
         name`
  const res = await db.execute({ sql, args: limit ? [limit] : [] })
  return res.rows.map(rowToRecord)
}

export async function tursoCountEnriched(): Promise<number> {
  await ensureSchema()
  const db = getClient()
  const res = await db.execute(
    "SELECT COUNT(*) AS n FROM companies WHERE ch_fetched_at IS NOT NULL",
  )
  return (res.rows[0].n as number) ?? 0
}

export async function tursoSaveBenchmarks(blob: string): Promise<void> {
  await ensureSchema()
  const db = getClient()
  await db.execute({
    sql: "INSERT OR REPLACE INTO metadata (key, value) VALUES ('industry_benchmarks', ?)",
    args: [blob],
  })
}

export async function tursoLoadBenchmarks(): Promise<string | null> {
  await ensureSchema()
  const db = getClient()
  const res = await db.execute({
    sql: "SELECT value FROM metadata WHERE key = 'industry_benchmarks'",
    args: [],
  })
  return (res.rows[0]?.value as string) ?? null
}
