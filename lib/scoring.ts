import type { CompanyRecord } from './db/store'
import { loadBenchmarks, sicToIndustry, nameToIndustry, industryToScore } from './cos-api'

export type ScoreLabel = 'Very Likely' | 'Likely' | 'Possible' | 'Unlikely'
export type SizeTier = 'Micro' | 'Small' | 'Medium' | 'Large' | 'Enterprise'

export type RoleContext = {
  role: string
  /** null = API unavailable; 0+ = actual live listing count for this role at this employer */
  jobCount: number | null
}

type Signal = {
  normalisedScore: number
  weight: number
  explanation: string
}

export type ScoreBreakdown = {
  score: number
  label: ScoreLabel
  capped: boolean
  capReason: string | null
  signals: {
    licenceStatus: Signal
    companyStatus: Signal
    industrySponsorshipRate: Signal
    liveJobSignal: Signal
    companySize: Signal
    international: Signal
    routeScope: Signal
  }
}

// SIC division prefixes (first 2 digits) that indicate internationally-oriented sectors
const INTERNATIONAL_SIC_PREFIXES = new Set([
  '58','59','60','61','62','63', // Information and Communications
  '64','65','66',                // Financial and Insurance
  '69','70','71','72','73','74','75', // Professional, Scientific and Technical
  '86','87','88',                // Human Health and Social Work
])

export function sizeTierLabel(employeeCount: number | null): SizeTier | null {
  if (employeeCount === null) return null
  if (employeeCount < 10)   return 'Micro'
  if (employeeCount < 50)   return 'Small'
  if (employeeCount < 250)  return 'Medium'
  if (employeeCount < 1000) return 'Large'
  return 'Enterprise'
}

function isInternationalSector(sicCodes: string[] | null): boolean {
  if (!sicCodes || sicCodes.length === 0) return false
  return sicCodes.some((code) => INTERNATIONAL_SIC_PREFIXES.has(code.slice(0, 2)))
}

function incorporationYear(incorporationDate: string | null): number | null {
  if (!incorporationDate) return null
  const y = parseInt(incorporationDate.slice(0, 4), 10)
  return isNaN(y) ? null : y
}

export function yearsIncorporated(incorporationDate: string | null): number | null {
  const y = incorporationYear(incorporationDate)
  if (y === null) return null
  return new Date().getFullYear() - y
}

const DISSOLVED_ZERO: ScoreBreakdown = {
  score: 0,
  label: 'Unlikely',
  capped: true,
  capReason: 'Company is dissolved — cannot hold a sponsor licence',
  signals: {
    licenceStatus:           { normalisedScore: 0, weight: 0.30, explanation: 'Dissolved companies cannot hold a sponsor licence.' },
    companyStatus:           { normalisedScore: 0, weight: 0.20, explanation: 'Companies House records this company as dissolved.' },
    industrySponsorshipRate: { normalisedScore: 0, weight: 0.20, explanation: 'No active routes.' },
    liveJobSignal:           { normalisedScore: 0, weight: 0.10, explanation: 'No active routes.' },
    companySize:             { normalisedScore: 0, weight: 0.10, explanation: 'No active routes.' },
    international:           { normalisedScore: 0, weight: 0.05, explanation: 'No active routes.' },
    routeScope:              { normalisedScore: 0, weight: 0.05, explanation: 'No active routes.' },
  },
}

export function scoreCompany(company: CompanyRecord, roleCtx?: RoleContext): ScoreBreakdown {
  const dissolved =
    company.chStatus === 'dissolved' || company.chStatus === 'liquidation'
  if (dissolved) return DISSOLVED_ZERO

  // ── Signal 1: Licence status (30%) ───────────────────────────────────────
  const ratingRaw = (company.sponsorRating ?? '').toLowerCase()
  let licenceScore: number
  let licenceExpl: string

  if (ratingRaw.includes(' a') || ratingRaw.startsWith('a') || ratingRaw === 'worker') {
    licenceScore = 1.0
    licenceExpl = 'A-rated on the Home Office Register — full licence, highest compliance standing.'
  } else if (ratingRaw.includes(' b') || ratingRaw.startsWith('b')) {
    licenceScore = 0.5
    licenceExpl = 'B-rated on the Home Office Register — provisional licence, compliance under review.'
  } else {
    licenceScore = 0.75
    licenceExpl = 'Currently on the Home Office Register of Licensed Sponsors.'
  }

  // ── Signal 2: Company status from Companies House (20%) ──────────────────
  let chScore: number
  let chExpl: string

  if (!company.chFetchedAt) {
    chScore = 0.50
    chExpl = 'Companies House not yet verified — run seed:historic to pre-fetch CH data, or visit this page to enrich on demand.'
  } else if (company.chStatus === 'active') {
    chScore = 1.0
    chExpl = 'Companies House confirms company is active.'
  } else if (company.chStatus === 'dormant') {
    chScore = 0.35
    chExpl = 'Companies House shows this company as dormant — unlikely to be actively hiring.'
  } else {
    chScore = 0.40
    chExpl = `Companies House status: ${company.chStatus ?? 'unknown'}.`
  }

  // ── Signal 3: Industry sponsorship rate (20%) ─────────────────────────────
  const benchmarks = loadBenchmarks()
  const sicIndustry = sicToIndustry(company.sicCodes)
  // LLPs, overseas companies, and UK establishments don't have SIC codes from CH.
  // Fall back to name-based inference so firms like KPMG or Clifford Chance still score correctly.
  const nameIndustry = !sicIndustry && company.chFetchedAt ? nameToIndustry(company.name) : null
  const industry = sicIndustry ?? nameIndustry
  const industryScore = industryToScore(industry, benchmarks)

  let industryExpl: string
  if (!company.chFetchedAt) {
    industryExpl = 'Industry unknown — Companies House SIC codes needed. Run seed:historic to enrich.'
  } else if (!industry) {
    industryExpl = 'Could not determine industry — SIC codes unavailable and company name did not match known patterns.'
  } else {
    const pct = Math.round(industryScore * 100)
    const source = nameIndustry ? ' (inferred from company name — SIC codes not published for this entity type)' : ''
    industryExpl = `Sector: ${industry}${source}. Home Office data shows ${pct >= 70 ? 'very high' : pct >= 50 ? 'moderate' : 'lower'} Skilled Worker sponsorship activity in this industry.`
  }

  // ── Signal 4: Live jobs on Reed (10%) ────────────────────────────────────
  // When roleCtx is provided, checks for role-specific listings at this employer.
  // When not provided, checks for general visa-sponsored listings.
  let liveJobScore: number
  let liveJobExpl: string

  if (roleCtx) {
    if (roleCtx.jobCount == null) {
      liveJobScore = 0.50
      liveJobExpl = `Reed.co.uk search unavailable — could not check live "${roleCtx.role}" listings at this company.`
    } else if (roleCtx.jobCount === 0) {
      liveJobScore = 0.10
      liveJobExpl = `No live "${roleCtx.role}" roles found at this company on Reed.co.uk — they may not actively hire for this role type.`
    } else {
      liveJobScore = Math.min(0.50 + roleCtx.jobCount * 0.10, 1.0)
      const n = roleCtx.jobCount
      liveJobExpl = `${n} live "${roleCtx.role}" role${n === 1 ? '' : 's'} at this company on Reed.co.uk — actively hiring this role type.`
    }
  } else if (company.liveJobCount == null) {
    liveJobScore = 0.50
    liveJobExpl = !process.env.REED_API_KEY
      ? 'Reed.co.uk signal not configured — add REED_API_KEY to enable live job count.'
      : 'Live job count not yet fetched — will load on next page visit.'
  } else if (company.liveJobCount === 0) {
    liveJobScore = 0.0
    liveJobExpl = 'No sponsored roles currently listed on Reed.co.uk.'
  } else {
    liveJobScore = Math.min(company.liveJobCount / 5, 1)
    const label = company.liveJobCount >= 5 ? '5 or more' : String(company.liveJobCount)
    liveJobExpl = `${label} sponsored role${company.liveJobCount === 1 ? '' : 's'} currently live on Reed.co.uk — active hiring signal.`
  }

  // ── Signal 5: Company size (10%) ──────────────────────────────────────────
  let sizeScore: number
  let sizeExpl: string

  if (!company.chFetchedAt || company.employeeCount == null) {
    sizeScore = 0.45
    sizeExpl = 'Company size unknown — Companies House data needed to estimate employee count.'
  } else {
    const tier = sizeTierLabel(company.employeeCount)!
    const tierDescriptions: Record<SizeTier, string> = {
      Micro:      'Micro company (<10 employees) — limited HR capacity for sponsorship admin.',
      Small:      'Small company (10–49 employees) — some HR capacity but sponsorship admin is a significant overhead.',
      Medium:     'Medium company (50–249 employees) — sufficient scale for in-house sponsorship processes.',
      Large:      'Large company (250–999 employees) — dedicated HR function, established sponsorship capability.',
      Enterprise: 'Enterprise (1,000+ employees) — substantial HR infrastructure and high sponsorship volume.',
    }
    const tierScores: Record<SizeTier, number> = {
      Micro: 0.20, Small: 0.40, Medium: 0.65, Large: 0.80, Enterprise: 1.00,
    }
    sizeScore = tierScores[tier]
    sizeExpl = tierDescriptions[tier]
  }

  // ── Signal 6: Company maturity & international sector (5%) ───────────────
  let intlScore: number
  let intlExpl: string

  if (!company.chFetchedAt) {
    intlScore = 0.45
    intlExpl = 'Company maturity unknown — Companies House data needed.'
  } else {
    const year = incorporationYear(company.incorporationDate)
    // For LLPs/overseas companies with no SIC codes, check against the inferred industry too
    const intlIndustries = new Set([
      'Information and Communications',
      'Financial and Insurance Activities',
      'Professional, Scientific and Technical Activities',
      'Human Health and Social Work Activities',
    ])
    const intlSector = isInternationalSector(company.sicCodes) || (!!industry && intlIndustries.has(industry))

    if (year === null) {
      intlScore = 0.45
      intlExpl = 'Incorporation date not available from Companies House.'
    } else if (year < 2010 && intlSector) {
      intlScore = 1.00
      intlExpl = `Incorporated ${year} in a high-international sector — mature organisation with established international hiring infrastructure.`
    } else if (year < 2015) {
      intlScore = 0.75
      intlExpl = `Incorporated ${year} — established company with likely experience in skilled worker sponsorship.`
    } else if (year < 2020) {
      intlScore = 0.55
      intlExpl = `Incorporated ${year} — developing company; some sponsorship experience likely.`
    } else {
      intlScore = 0.35
      intlExpl = `Incorporated ${year} — newer company; less established international hiring infrastructure.`
    }
  }

  // ── Signal 7: Sponsor route scope (5%) ────────────────────────────────────
  const route = company.sponsorRoute ?? ''
  let routeScore: number
  let routeExpl: string

  if (!route) {
    routeScore = 0.55
    routeExpl = 'Route information not available in the register.'
  } else if (route.toLowerCase().includes('skilled')) {
    routeScore = 1.0
    routeExpl = `Licensed for Skilled Worker route.${company.sponsorSubTier ? ` Sub-tier: ${company.sponsorSubTier}.` : ''}`
  } else {
    routeScore = 0.70
    routeExpl = `Licensed for: ${route}.${company.sponsorSubTier ? ` Sub-tier: ${company.sponsorSubTier}.` : ''}`
  }

  const rawScore =
    licenceScore   * 0.30 +
    chScore        * 0.20 +
    industryScore  * 0.20 +
    liveJobScore   * 0.10 +
    sizeScore      * 0.10 +
    intlScore      * 0.05 +
    routeScore     * 0.05

  const score = Math.round(rawScore * 100)

  return {
    score,
    label: toLabel(score),
    capped: false,
    capReason: null,
    signals: {
      licenceStatus:           { normalisedScore: licenceScore,   weight: 0.30, explanation: licenceExpl   },
      companyStatus:           { normalisedScore: chScore,        weight: 0.20, explanation: chExpl        },
      industrySponsorshipRate: { normalisedScore: industryScore,  weight: 0.20, explanation: industryExpl  },
      liveJobSignal:           { normalisedScore: liveJobScore,   weight: 0.10, explanation: liveJobExpl   },
      companySize:             { normalisedScore: sizeScore,      weight: 0.10, explanation: sizeExpl      },
      international:           { normalisedScore: intlScore,      weight: 0.05, explanation: intlExpl      },
      routeScope:              { normalisedScore: routeScore,     weight: 0.05, explanation: routeExpl     },
    },
  }
}

export function toLabel(score: number): ScoreLabel {
  if (score >= 80) return 'Very Likely'
  if (score >= 55) return 'Likely'
  if (score >= 30) return 'Possible'
  return 'Unlikely'
}

export function scoreToColor(score: number): string {
  if (score >= 80) return 'text-[#22c55e]'
  if (score >= 55) return 'text-[#6C47FF]'
  if (score >= 30) return 'text-[#f59e0b]'
  return 'text-red-400'
}

export function scoreToBg(score: number): string {
  if (score >= 80) return 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30'
  if (score >= 55) return 'bg-[#6C47FF]/10 text-[#6C47FF] border-[#6C47FF]/30'
  if (score >= 30) return 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30'
  return 'bg-red-500/10 text-red-400 border-red-500/30'
}
