export type ScoreLabel = "Very Likely" | "Likely" | "Possible" | "Unlikely"

export type Company = {
  slug: string
  name: string
  city: string
  industry: string
  sizeTier: string
  score: number
  scoreLabel: ScoreLabel
  isActiveSponsor: boolean
  ukRating: "A-rated" | "B-rated" | null
  totalSponsored3yr: number
  routes: string[]
  companyStatus: "active" | "dissolved" | "dormant"
  employeeCount: number
  signals: {
    volume:         { rawValue: number; normalisedScore: number; weight: number; explanation: string }
    registerStatus: { rawValue: string; normalisedScore: number; weight: number; explanation: string }
    roleMatch:      { rawValue: number; normalisedScore: number; weight: number; explanation: string }
    sizeTier:       { rawValue: string; normalisedScore: number; weight: number; explanation: string }
    recency:        { rawValue: number; normalisedScore: number; weight: number; explanation: string }
  }
  history: { year: number; totalSponsored: number }[]
  industryAvgScore: number
  percentile: number
}

export const MOCK_COMPANIES: Company[] = [
  {
    slug: "tata-consultancy-services",
    name: "Tata Consultancy Services Limited",
    city: "London",
    industry: "Technology",
    sizeTier: "mega-corp",
    score: 94,
    scoreLabel: "Very Likely",
    isActiveSponsor: true,
    ukRating: "A-rated",
    totalSponsored3yr: 12480,
    routes: ["Skilled Worker", "Graduate"],
    companyStatus: "active",
    employeeCount: 50000,
    signals: {
      volume:         { rawValue: 12480, normalisedScore: 1.0,  weight: 0.35, explanation: "TCS has sponsored 12,480 workers over the last 3 years, placing it in the top 1% of Technology companies." },
      registerStatus: { rawValue: "A-rated", normalisedScore: 0.9, weight: 0.25, explanation: "Currently A-rated on the Home Office Register of Licensed Sponsors." },
      roleMatch:      { rawValue: 340,   normalisedScore: 1.0,  weight: 0.20, explanation: "340 Software Engineer sponsorships in the last 3 years — strong role-specific history." },
      sizeTier:       { rawValue: "mega-corp", normalisedScore: 1.0, weight: 0.12, explanation: "Over 50,000 employees in the UK — established legal infrastructure for sponsorship." },
      recency:        { rawValue: 2024,  normalisedScore: 1.0,  weight: 0.08, explanation: "Actively sponsoring in the current fiscal year." },
    },
    history: [
      { year: 2019, totalSponsored: 2800 },
      { year: 2020, totalSponsored: 3100 },
      { year: 2021, totalSponsored: 3600 },
      { year: 2022, totalSponsored: 4200 },
      { year: 2023, totalSponsored: 4680 },
    ],
    industryAvgScore: 52,
    percentile: 99,
  },
  {
    slug: "infosys",
    name: "Infosys BPM Limited",
    city: "London",
    industry: "Technology",
    sizeTier: "mega-corp",
    score: 88,
    scoreLabel: "Very Likely",
    isActiveSponsor: true,
    ukRating: "A-rated",
    totalSponsored3yr: 7200,
    routes: ["Skilled Worker"],
    companyStatus: "active",
    employeeCount: 20000,
    signals: {
      volume:         { rawValue: 7200,  normalisedScore: 0.88, weight: 0.35, explanation: "7,200 sponsorships over 3 years, in the top 5% for Technology companies." },
      registerStatus: { rawValue: "A-rated", normalisedScore: 0.9, weight: 0.25, explanation: "Currently A-rated on the Home Office Register." },
      roleMatch:      { rawValue: 210,   normalisedScore: 1.0,  weight: 0.20, explanation: "210 Software Engineer sponsorships over the last 3 years." },
      sizeTier:       { rawValue: "mega-corp", normalisedScore: 1.0, weight: 0.12, explanation: "Over 20,000 employees — large established sponsor." },
      recency:        { rawValue: 2024,  normalisedScore: 1.0,  weight: 0.08, explanation: "Active in current fiscal year." },
    },
    history: [
      { year: 2019, totalSponsored: 1800 },
      { year: 2020, totalSponsored: 2000 },
      { year: 2021, totalSponsored: 2100 },
      { year: 2022, totalSponsored: 2400 },
      { year: 2023, totalSponsored: 2800 },
    ],
    industryAvgScore: 52,
    percentile: 96,
  },
  {
    slug: "capgemini",
    name: "Capgemini UK plc",
    city: "London",
    industry: "Technology",
    sizeTier: "enterprise",
    score: 81,
    scoreLabel: "Very Likely",
    isActiveSponsor: true,
    ukRating: "A-rated",
    totalSponsored3yr: 4100,
    routes: ["Skilled Worker", "Health and Care Worker"],
    companyStatus: "active",
    employeeCount: 12000,
    signals: {
      volume:         { rawValue: 4100,  normalisedScore: 0.75, weight: 0.35, explanation: "4,100 sponsorships over 3 years, in the top 10% for Technology companies." },
      registerStatus: { rawValue: "A-rated", normalisedScore: 0.9, weight: 0.25, explanation: "Currently A-rated on the Home Office Register." },
      roleMatch:      { rawValue: 95,    normalisedScore: 1.0,  weight: 0.20, explanation: "95 Software Engineer sponsorships over the last 3 years." },
      sizeTier:       { rawValue: "enterprise", normalisedScore: 0.85, weight: 0.12, explanation: "12,000 employees — enterprise-scale sponsor." },
      recency:        { rawValue: 2024,  normalisedScore: 1.0,  weight: 0.08, explanation: "Active in current fiscal year." },
    },
    history: [
      { year: 2019, totalSponsored: 900 },
      { year: 2020, totalSponsored: 1100 },
      { year: 2021, totalSponsored: 1200 },
      { year: 2022, totalSponsored: 1400 },
      { year: 2023, totalSponsored: 1500 },
    ],
    industryAvgScore: 52,
    percentile: 91,
  },
  {
    slug: "jpmorgan-chase",
    name: "JPMorgan Chase Bank N.A.",
    city: "London",
    industry: "Finance",
    sizeTier: "mega-corp",
    score: 76,
    scoreLabel: "Likely",
    isActiveSponsor: true,
    ukRating: "A-rated",
    totalSponsored3yr: 3200,
    routes: ["Skilled Worker"],
    companyStatus: "active",
    employeeCount: 18000,
    signals: {
      volume:         { rawValue: 3200,  normalisedScore: 0.65, weight: 0.35, explanation: "3,200 sponsorships over 3 years, above average for Finance companies." },
      registerStatus: { rawValue: "A-rated", normalisedScore: 0.9, weight: 0.25, explanation: "Currently A-rated on the Home Office Register." },
      roleMatch:      { rawValue: 28,    normalisedScore: 0.9,  weight: 0.20, explanation: "28 Software Engineer sponsorships — moderate role-specific history." },
      sizeTier:       { rawValue: "mega-corp", normalisedScore: 1.0, weight: 0.12, explanation: "18,000 UK employees — large established sponsor." },
      recency:        { rawValue: 2024,  normalisedScore: 1.0,  weight: 0.08, explanation: "Active in current fiscal year." },
    },
    history: [
      { year: 2019, totalSponsored: 700 },
      { year: 2020, totalSponsored: 750 },
      { year: 2021, totalSponsored: 800 },
      { year: 2022, totalSponsored: 900 },
      { year: 2023, totalSponsored: 1050 },
    ],
    industryAvgScore: 48,
    percentile: 84,
  },
  {
    slug: "deloitte",
    name: "Deloitte LLP",
    city: "London",
    industry: "Professional Services",
    sizeTier: "enterprise",
    score: 71,
    scoreLabel: "Likely",
    isActiveSponsor: true,
    ukRating: "A-rated",
    totalSponsored3yr: 2600,
    routes: ["Skilled Worker"],
    companyStatus: "active",
    employeeCount: 22000,
    signals: {
      volume:         { rawValue: 2600,  normalisedScore: 0.58, weight: 0.35, explanation: "2,600 sponsorships over 3 years." },
      registerStatus: { rawValue: "A-rated", normalisedScore: 0.9, weight: 0.25, explanation: "Currently A-rated on the Home Office Register." },
      roleMatch:      { rawValue: 14,    normalisedScore: 0.82, weight: 0.20, explanation: "14 Software Engineer sponsorships — some role-specific history." },
      sizeTier:       { rawValue: "enterprise", normalisedScore: 0.85, weight: 0.12, explanation: "22,000 UK employees." },
      recency:        { rawValue: 2024,  normalisedScore: 1.0,  weight: 0.08, explanation: "Active in current fiscal year." },
    },
    history: [
      { year: 2019, totalSponsored: 520 },
      { year: 2020, totalSponsored: 580 },
      { year: 2021, totalSponsored: 600 },
      { year: 2022, totalSponsored: 700 },
      { year: 2023, totalSponsored: 720 },
    ],
    industryAvgScore: 44,
    percentile: 78,
  },
  {
    slug: "small-startup-ltd",
    name: "Small Startup Ltd",
    city: "Manchester",
    industry: "Technology",
    sizeTier: "startup",
    score: 12,
    scoreLabel: "Unlikely",
    isActiveSponsor: false,
    ukRating: null,
    totalSponsored3yr: 0,
    routes: [],
    companyStatus: "active",
    employeeCount: 8,
    signals: {
      volume:         { rawValue: 0,    normalisedScore: 0.0,  weight: 0.35, explanation: "No sponsorship history found." },
      registerStatus: { rawValue: "Not licensed", normalisedScore: 0.0, weight: 0.25, explanation: "Not currently on the Home Office Register of Licensed Sponsors." },
      roleMatch:      { rawValue: 0,    normalisedScore: 0.0,  weight: 0.20, explanation: "No role-specific sponsorship history." },
      sizeTier:       { rawValue: "startup", normalisedScore: 0.3, weight: 0.12, explanation: "8 employees — small company, would need to apply for a sponsor licence first." },
      recency:        { rawValue: 0,    normalisedScore: 0.0,  weight: 0.08, explanation: "No recent sponsorship activity." },
    },
    history: [],
    industryAvgScore: 52,
    percentile: 4,
  },
]

export function getCompanyBySlug(slug: string): Company | undefined {
  return MOCK_COMPANIES.find((c) => c.slug === slug)
}

export function searchCompanies(role: string, industry?: string, seniority?: string): Company[] {
  let results = MOCK_COMPANIES.filter((c) => c.score > 10)
  if (industry) {
    results = results.filter((c) => c.industry.toLowerCase().includes(industry.toLowerCase()))
  }
  return results.sort((a, b) => b.score - a.score)
}

export function scoreToColor(score: number): string {
  if (score >= 80) return "text-green-600"
  if (score >= 55) return "text-teal-600"
  if (score >= 30) return "text-amber-600"
  return "text-red-600"
}

export function scoreToBg(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800"
  if (score >= 55) return "bg-teal-100 text-teal-800"
  if (score >= 30) return "bg-amber-100 text-amber-800"
  return "bg-red-100 text-red-800"
}
