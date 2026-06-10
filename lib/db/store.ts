import fs from 'fs'
import path from 'path'
import Fuse from 'fuse.js'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'sponsors.json')

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
  employeeCount: number | null      // estimated from CH accounts type
  employeeAccountsType: string | null // raw CH accounts type ("micro-entity", "full", etc.)
  incorporationDate: string | null
  chFetchedAt: string | null
  lastUpdated: string
}

type DataFile = {
  seededAt: string
  count: number
  companies: CompanyRecord[]
}

// Persist across Next.js HMR reloads
declare global {
  // eslint-disable-next-line no-var
  var __sponsorsStore:
    | { companies: CompanyRecord[]; fuse: Fuse<CompanyRecord> | null }
    | undefined
}

function loadFile(): DataFile | null {
  if (!fs.existsSync(DB_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) as DataFile
  } catch {
    return null
  }
}

function buildStore(companies: CompanyRecord[]) {
  return {
    companies,
    fuse:
      companies.length > 0
        ? new Fuse(companies, {
            keys: ['name', 'town', 'county'],
            threshold: 0.35,
            minMatchCharLength: 2,
          })
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

export function getCompanies(): CompanyRecord[] {
  return getStore().companies
}

export function getCompanyBySlug(slug: string): CompanyRecord | null {
  return getStore().companies.find((c) => c.slug === slug) ?? null
}

export function searchCompanies(query: string, route?: string, limit = 50): CompanyRecord[] {
  const store = getStore()
  let results: CompanyRecord[]

  if (!query.trim()) {
    results = store.companies
  } else {
    results = (store.fuse?.search(query) ?? []).map((r) => r.item)
  }

  if (route) {
    const lc = route.toLowerCase()
    results = results.filter((c) => c.sponsorRoute?.toLowerCase().includes(lc))
  }

  return results.slice(0, limit)
}

export function countCompanies(): number {
  return getStore().companies.length
}

export function getSeededAt(): string | null {
  if (!fs.existsSync(DB_PATH)) return null
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) as DataFile
    return data.seededAt ?? null
  } catch {
    return null
  }
}

export function saveCompanies(companies: CompanyRecord[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const data: DataFile = {
    seededAt: new Date().toISOString(),
    count: companies.length,
    companies,
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(data))
  global.__sponsorsStore = buildStore(companies)
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

/** Single-company CH update (used by lazy page-visit enrichment). Writes to disk immediately. */
export function updateCompanyWithCH(slug: string, ch: CHUpdate): void {
  const store = getStore()
  const idx = store.companies.findIndex((c) => c.slug === slug)
  if (idx === -1) return

  store.companies[idx] = {
    ...store.companies[idx],
    companyNumber: ch.companyNumber,
    chStatus: ch.chStatus,
    sicCodes: ch.sicCodes,
    registeredAddress: ch.registeredAddress,
    employeeCount: ch.employeeCount,
    employeeAccountsType: ch.employeeAccountsType,
    incorporationDate: ch.incorporationDate,
    chFetchedAt: new Date().toISOString(),
  }

  const existing = loadFile()
  const data: DataFile = {
    seededAt: existing?.seededAt ?? new Date().toISOString(),
    count: store.companies.length,
    companies: store.companies,
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(data))
}

/** Bulk CH update used by seed:historic. Accumulates all changes then writes once. */
export function bulkUpdateCH(updates: Map<string, CHUpdate>): number {
  if (updates.size === 0) return 0
  const store = getStore()
  const now = new Date().toISOString()
  let applied = 0

  for (let i = 0; i < store.companies.length; i++) {
    const ch = updates.get(store.companies[i].slug)
    if (!ch) continue
    store.companies[i] = {
      ...store.companies[i],
      companyNumber: ch.companyNumber,
      chStatus: ch.chStatus,
      sicCodes: ch.sicCodes,
      registeredAddress: ch.registeredAddress,
      employeeCount: ch.employeeCount,
      employeeAccountsType: ch.employeeAccountsType,
      incorporationDate: ch.incorporationDate,
      chFetchedAt: now,
    }
    applied++
  }

  if (applied > 0) {
    const existing = loadFile()
    const data: DataFile = {
      seededAt: existing?.seededAt ?? now,
      count: store.companies.length,
      companies: store.companies,
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data))
  }
  return applied
}
