import fs from 'fs'
import path from 'path'
import Fuse from 'fuse.js'
import {
  tursoCount,
  tursoGetSeededAt,
  tursoGetBySlug,
  tursoSearch,
  tursoSave,
  tursoUpdateCH,
  tursoUpdateReed,
  tursoBulkUpdateCH,
  tursoGetUnenriched,
  tursoCountEnriched,
} from './turso'

// ── Types (source of truth) ──────────────────────────────────────────────────

export type CompanyRecord = {
  slug: string
  name: string
  town: string | null
  county: string | null
  sponsorRoute: string | null
  sponsorSubTier: string | null
  sponsorRating: string | null
  companyNumber: string | null
  chStatus: string | null
  sicCodes: string[] | null
  registeredAddress: string | null
  employeeCount: number | null
  employeeAccountsType: string | null
  incorporationDate: string | null
  chFetchedAt: string | null
  liveJobCount: number | null
  liveJobFetchedAt: string | null
  lastUpdated: string
}

export type CHUpdate = {
  companyNumber: string
  chStatus: string
  sicCodes: string[]
  registeredAddress: string
  employeeCount: number | null
  employeeAccountsType: string | null
  incorporationDate: string | null
}

// ── JSON file store (local dev fallback) ─────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH  = path.join(DATA_DIR, 'sponsors.json')

type DataFile = {
  seededAt: string
  count: number
  companies: CompanyRecord[]
}

declare global {
  // eslint-disable-next-line no-var
  var __sponsorsStore:
    | { companies: CompanyRecord[]; fuse: Fuse<CompanyRecord> | null }
    | undefined
}

function loadFile(): DataFile | null {
  if (!fs.existsSync(DB_PATH)) return null
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) as DataFile } catch { return null }
}

function buildStore(companies: CompanyRecord[]) {
  return {
    companies,
    fuse: companies.length > 0
      ? new Fuse(companies, { keys: ['name', 'town', 'county'], threshold: 0.35, minMatchCharLength: 2 })
      : null,
  }
}

function getStore() {
  if (!global.__sponsorsStore) {
    const data = loadFile()
    global.__sponsorsStore = buildStore(data?.companies ?? [])
  }
  return global.__sponsorsStore
}

function safeSave(data: DataFile): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(DB_PATH, JSON.stringify(data))
  } catch {
    // Silently fail on read-only filesystems (Vercel serverless)
  }
}

// JSON-backed implementations (sync, wrapped in Promise below)
function json_count(): number { return getStore().companies.length }

function json_seededAt(): string | null {
  if (!fs.existsSync(DB_PATH)) return null
  try { return (JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) as DataFile).seededAt ?? null }
  catch { return null }
}

function json_getBySlug(slug: string): CompanyRecord | null {
  return getStore().companies.find((c) => c.slug === slug) ?? null
}

function json_search(query: string, route?: string, limit = 50): CompanyRecord[] {
  const store = getStore()
  let results = query.trim()
    ? (store.fuse?.search(query) ?? []).map((r) => r.item)
    : store.companies
  if (route) results = results.filter((c) => c.sponsorRoute?.toLowerCase().includes(route.toLowerCase()))
  return results.slice(0, limit)
}

function json_save(companies: CompanyRecord[]): void {
  safeSave({ seededAt: new Date().toISOString(), count: companies.length, companies })
  global.__sponsorsStore = buildStore(companies)
}

function json_updateCH(slug: string, ch: CHUpdate): void {
  const store = getStore()
  const idx = store.companies.findIndex((c) => c.slug === slug)
  if (idx === -1) return
  store.companies[idx] = {
    ...store.companies[idx],
    companyNumber: ch.companyNumber, chStatus: ch.chStatus, sicCodes: ch.sicCodes,
    registeredAddress: ch.registeredAddress, employeeCount: ch.employeeCount,
    employeeAccountsType: ch.employeeAccountsType, incorporationDate: ch.incorporationDate,
    chFetchedAt: new Date().toISOString(),
  }
  const existing = loadFile()
  safeSave({ seededAt: existing?.seededAt ?? new Date().toISOString(), count: store.companies.length, companies: store.companies })
}

function json_updateReed(slug: string, liveJobCount: number): void {
  const store = getStore()
  const idx = store.companies.findIndex((c) => c.slug === slug)
  if (idx === -1) return
  store.companies[idx] = { ...store.companies[idx], liveJobCount, liveJobFetchedAt: new Date().toISOString() }
  const existing = loadFile()
  safeSave({ seededAt: existing?.seededAt ?? new Date().toISOString(), count: store.companies.length, companies: store.companies })
}

function json_bulkUpdateCH(updates: Map<string, CHUpdate>): number {
  if (updates.size === 0) return 0
  const store = getStore()
  const now = new Date().toISOString()
  let applied = 0
  for (let i = 0; i < store.companies.length; i++) {
    const ch = updates.get(store.companies[i].slug)
    if (!ch) continue
    store.companies[i] = {
      ...store.companies[i],
      companyNumber: ch.companyNumber, chStatus: ch.chStatus, sicCodes: ch.sicCodes,
      registeredAddress: ch.registeredAddress, employeeCount: ch.employeeCount,
      employeeAccountsType: ch.employeeAccountsType, incorporationDate: ch.incorporationDate,
      chFetchedAt: now,
    }
    applied++
  }
  if (applied > 0) {
    const existing = loadFile()
    safeSave({ seededAt: existing?.seededAt ?? now, count: store.companies.length, companies: store.companies })
  }
  return applied
}

function json_getUnenriched(limit?: number): CompanyRecord[] {
  const unenriched = getStore().companies
    .filter((c) => !c.chFetchedAt)
    .sort((a, b) => {
      const aRank = (a.sponsorRating?.toLowerCase().startsWith('a') ? 0 : 2) +
                    (a.sponsorRoute?.toLowerCase().includes('skilled') ? 0 : 1)
      const bRank = (b.sponsorRating?.toLowerCase().startsWith('a') ? 0 : 2) +
                    (b.sponsorRoute?.toLowerCase().includes('skilled') ? 0 : 1)
      if (aRank !== bRank) return aRank - bRank
      return a.name.localeCompare(b.name)
    })
  return limit ? unenriched.slice(0, limit) : unenriched
}

function json_countEnriched(): number {
  return getStore().companies.filter((c) => !!c.chFetchedAt).length
}

// ── Public async API ─────────────────────────────────────────────────────────
// When TURSO_URL is set → Turso; otherwise → JSON file store.

const useTurso = () => !!process.env.TURSO_URL

export async function countCompanies(): Promise<number> {
  return useTurso() ? tursoCount() : json_count()
}

export async function getSeededAt(): Promise<string | null> {
  return useTurso() ? tursoGetSeededAt() : json_seededAt()
}

export async function getCompanyBySlug(slug: string): Promise<CompanyRecord | null> {
  return useTurso() ? tursoGetBySlug(slug) : json_getBySlug(slug)
}

export async function searchCompanies(
  query: string,
  route?: string,
  limit = 50,
): Promise<CompanyRecord[]> {
  return useTurso() ? tursoSearch(query, route, limit) : json_search(query, route, limit)
}

export async function saveCompanies(companies: CompanyRecord[]): Promise<void> {
  if (useTurso()) return tursoSave(companies)
  json_save(companies)
}

export async function updateCompanyWithCH(slug: string, ch: CHUpdate): Promise<void> {
  if (useTurso()) return tursoUpdateCH(slug, ch)
  json_updateCH(slug, ch)
}

export async function updateCompanyWithReed(slug: string, liveJobCount: number): Promise<void> {
  if (useTurso()) return tursoUpdateReed(slug, liveJobCount)
  json_updateReed(slug, liveJobCount)
}

export async function bulkUpdateCH(updates: Map<string, CHUpdate>): Promise<number> {
  return useTurso() ? tursoBulkUpdateCH(updates) : json_bulkUpdateCH(updates)
}

/** Returns companies not yet enriched with Companies House data, in priority order. */
export async function getUnenrichedCompanies(limit?: number): Promise<CompanyRecord[]> {
  return useTurso() ? tursoGetUnenriched(limit) : json_getUnenriched(limit)
}

/** Count of companies that have already been CH-enriched. */
export async function countEnrichedCompanies(): Promise<number> {
  return useTurso() ? tursoCountEnriched() : json_countEnriched()
}
