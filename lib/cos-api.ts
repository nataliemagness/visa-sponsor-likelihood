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

// ── Name-based industry fallback ─────────────────────────────────────────────
// LLPs, overseas companies, and UK establishments don't return sic_codes from
// the Companies House API. We infer industry from known firm names and keywords.

// Layer 1: well-known firm names whose registered names contain no industry keywords
const KNOWN_FIRM_PATTERNS: [RegExp, string][] = [
  // Big Four + mid-tier accounting / audit
  [/\bkpmg\b/i,                                          'Professional, Scientific and Technical Activities'],
  [/\bdeloitte\b/i,                                      'Professional, Scientific and Technical Activities'],
  [/\bpricewaterhousecoopers\b/i,                        'Professional, Scientific and Technical Activities'],
  [/\bernst\s*(?:&|and)\s*young\b/i,                     'Professional, Scientific and Technical Activities'],
  [/\bgrant\s+thornton\b/i,                              'Professional, Scientific and Technical Activities'],
  [/\bbdo\s+llp\b/i,                                     'Professional, Scientific and Technical Activities'],
  [/\brsm\s+uk\b/i,                                      'Professional, Scientific and Technical Activities'],
  [/\bmazars\b/i,                                        'Professional, Scientific and Technical Activities'],
  [/\bforvis\s+mazars\b/i,                               'Professional, Scientific and Technical Activities'],
  // Strategy / management consulting
  [/\bmckinsey\b/i,                                      'Professional, Scientific and Technical Activities'],
  [/\bbain\s*(?:&|and)\s*company\b/i,                    'Professional, Scientific and Technical Activities'],
  [/\bboston\s+consulting\b/i,                           'Professional, Scientific and Technical Activities'],
  [/\boliver\s+wyman\b/i,                                'Professional, Scientific and Technical Activities'],
  [/\bbooz\b/i,                                          'Professional, Scientific and Technical Activities'],
  [/\barthur\s+d\.?\s*little\b/i,                        'Professional, Scientific and Technical Activities'],
  // Magic Circle + Silver Circle law firms
  [/\bclifford\s+chance\b/i,                             'Professional, Scientific and Technical Activities'],
  [/\blinklaters\b/i,                                    'Professional, Scientific and Technical Activities'],
  [/\bfreshfields\b/i,                                   'Professional, Scientific and Technical Activities'],
  [/\bslaughter\s+and\s+may\b/i,                         'Professional, Scientific and Technical Activities'],
  [/\ballen\s*(?:&|and)\s*overy\b/i,                     'Professional, Scientific and Technical Activities'],
  [/\bhogan\s+lovells\b/i,                               'Professional, Scientific and Technical Activities'],
  [/\bnorton\s+rose\b/i,                                 'Professional, Scientific and Technical Activities'],
  [/\bashurst\b/i,                                       'Professional, Scientific and Technical Activities'],
  [/\bherbert\s+smith\b/i,                               'Professional, Scientific and Technical Activities'],
  [/\beversheds\b/i,                                     'Professional, Scientific and Technical Activities'],
  // Large IT services / offshore delivery (typically overseas-company or uk-establishment)
  [/\btata\s+consultancy\b/i,                            'Information and Communications'],
  [/\binfosys\b/i,                                       'Information and Communications'],
  [/\bwipro\b/i,                                         'Information and Communications'],
  [/\bcognizant\b/i,                                     'Information and Communications'],
  [/\bhcl\s+(?:technologies|tech)\b/i,                   'Information and Communications'],
  [/\bmphasis\b/i,                                       'Information and Communications'],
  [/\bhexaware\b/i,                                      'Information and Communications'],
  [/\btech\s+mahindra\b/i,                               'Information and Communications'],
  // Staffing / recruitment (often have opaque names)
  [/\bmanpower\b/i,                                      'Administrative and support service activities'],
  [/\badecco\b/i,                                        'Administrative and support service activities'],
  [/\brandstad\b/i,                                      'Administrative and support service activities'],
]

// Layer 2: keyword patterns for descriptive company names
const KEYWORD_INDUSTRY_PATTERNS: [RegExp, string][] = [
  [/\b(?:management\s+consult|strategy\s+consult|business\s+consult|consult(?:ing|ancy|ants?)|advisor[sy]|advisory\s+service|accountan|accounting|audit(?:ing|ors?)|tax\s+(?:advisor|service|consult)|chartered\s+(?:accountan|surveyor)|actuari|valuati|solicitor|barrister|law\s+firm|legal\s+service|patent\s+attorn|architect|structural\s+engin|surveying|quantity\s+surveyor)\b/i,
   'Professional, Scientific and Technical Activities'],
  [/\b(?:bank(?:ing)?|financ(?:e|ial|ing)|insurance|invest(?:ment|ing)|capital\s+(?:management|partners)|asset\s+manag|fund\s+manag|wealth\s+manag|securities|trading\s+(?:house|company)|credit\s+(?:union|company)|lending|mortgage)\b/i,
   'Financial and Insurance Activities'],
  [/\b(?:hospital|health(?:care)?|clinic(?:al)?|medical\s+(?:centre|service)|nhs\s+trust|care\s+home|nursing\s+home|dental\s+(?:practice|clinic)|pharmaceu|pharmacy|therapeutics|biotech(?:nology)?)\b/i,
   'Human Health and Social Work Activities'],
  [/\b(?:software|technology\s+(?:service|solution)|digital\s+(?:service|solution|agency)|cyber(?:security)?|data\s+(?:analytic|science|service)|cloud\s+(?:service|solution)|it\s+(?:service|solution|consult)|information\s+(?:tech|service)|telecoms?|telecommunications)\b/i,
   'Information and Communications'],
  [/\b(?:school|college|universit|academ(?:y|ic)|education(?:al)?|training\s+(?:provider|centre|academy)|e-?learn)\b/i,
   'Education'],
]

/**
 * Infer industry from company name when SIC codes are unavailable.
 * Used for LLPs, overseas companies, and UK establishments.
 */
export function nameToIndustry(name: string): string | null {
  // Known firm lookup takes priority (more specific)
  for (const [pattern, industry] of KNOWN_FIRM_PATTERNS) {
    if (pattern.test(name)) return industry
  }
  // Keyword matching as secondary fallback
  for (const [pattern, industry] of KEYWORD_INDUSTRY_PATTERNS) {
    if (pattern.test(name)) return industry
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

  // Persist to Turso when available (Vercel), otherwise write to local file
  if (process.env.TURSO_URL) {
    const { tursoSaveBenchmarks } = await import('./db/turso')
    await tursoSaveBenchmarks(JSON.stringify(result))
  } else {
    try {
      fs.mkdirSync(path.dirname(BENCHMARK_PATH), { recursive: true })
      fs.writeFileSync(BENCHMARK_PATH, JSON.stringify(result, null, 2))
    } catch {}
  }

  // Populate the in-process cache so scoring picks up the new values immediately
  global.__industryBenchmarks = result.benchmarks

  return result
}

/**
 * Pre-populate the benchmark cache from Turso (production) or the local file.
 * Call this before any scoring in an async request handler.
 */
export async function ensureBenchmarks(): Promise<void> {
  if (global.__industryBenchmarks) return
  if (process.env.TURSO_URL) {
    try {
      const { tursoLoadBenchmarks } = await import('./db/turso')
      const blob = await tursoLoadBenchmarks()
      if (blob) {
        const data = JSON.parse(blob) as IndustryBenchmarkFile
        global.__industryBenchmarks = data.benchmarks
        return
      }
    } catch {}
  }
  loadBenchmarks()
}
