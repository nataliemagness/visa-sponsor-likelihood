import type { CompanyRecord } from './db/store'
import { loadBenchmarks, sicToIndustry, industryToScore } from './cos-api'

export type ScoreLabel = 'Very Likely' | 'Likely' | 'Possible' | 'Unlikely'

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
    routeScope: Signal
  }
}

export function scoreCompany(company: CompanyRecord): ScoreBreakdown {
  const dissolved =
    company.chStatus === 'dissolved' || company.chStatus === 'liquidation'

  if (dissolved) {
    return {
      score: 0,
      label: 'Unlikely',
      capped: true,
      capReason: 'Company is dissolved — cannot hold a sponsor licence',
      signals: {
        licenceStatus:           { normalisedScore: 0, weight: 0.35, explanation: 'Dissolved companies cannot hold a sponsor licence.' },
        companyStatus:           { normalisedScore: 0, weight: 0.25, explanation: 'Companies House records this company as dissolved.' },
        industrySponsorshipRate: { normalisedScore: 0, weight: 0.30, explanation: 'No active routes.' },
        routeScope:              { normalisedScore: 0, weight: 0.10, explanation: 'No active routes.' },
      },
    }
  }

  // ── Signal 1: Licence status (35%) ───────────────────────────────────────
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

  // ── Signal 2: Company status from Companies House (25%) ──────────────────
  let chScore: number
  let chExpl: string

  if (!company.chFetchedAt) {
    // Changed from 0.65 → 0.50: being on the register is a necessary but not sufficient signal;
    // unverified CH status gets a conservative neutral rather than an optimistic placeholder.
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

  // ── Signal 3: Industry sponsorship rate (30%) ─────────────────────────────
  // Derived from the Home Office Work Sponsorship CoS XLSX (industry-level aggregates).
  // The per-employer CoS counts are not publicly available at this granularity; this
  // signal captures how actively companies in the same sector sponsor Skilled Workers.
  const benchmarks = loadBenchmarks()
  const industry = sicToIndustry(company.sicCodes)
  const industryScore = industryToScore(industry, benchmarks)

  let industryExpl: string
  if (!company.chFetchedAt) {
    industryExpl = 'Industry unknown — Companies House SIC codes needed. Run seed:historic to enrich.'
  } else if (!industry) {
    industryExpl = 'Could not map SIC codes to a sponsorship industry category.'
  } else {
    const pct = Math.round(industryScore * 100)
    industryExpl = `Sector: ${industry}. Home Office data shows ${pct >= 70 ? 'very high' : pct >= 50 ? 'moderate' : 'lower'} Skilled Worker sponsorship activity in this industry.`
  }

  // ── Signal 4: Sponsor route scope (10%) ───────────────────────────────────
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
    licenceScore  * 0.35 +
    chScore       * 0.25 +
    industryScore * 0.30 +
    routeScore    * 0.10

  const score = Math.round(rawScore * 100)

  return {
    score,
    label: toLabel(score),
    capped: false,
    capReason: null,
    signals: {
      licenceStatus:           { normalisedScore: licenceScore,  weight: 0.35, explanation: licenceExpl  },
      companyStatus:           { normalisedScore: chScore,       weight: 0.25, explanation: chExpl       },
      industrySponsorshipRate: { normalisedScore: industryScore, weight: 0.30, explanation: industryExpl },
      routeScope:              { normalisedScore: routeScore,    weight: 0.10, explanation: routeExpl    },
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
