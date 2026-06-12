import Link from "next/link"
import { notFound } from "next/navigation"
import { getCompanyBySlug, countCompanies, updateCompanyWithCH, updateCompanyWithReed } from "@/lib/db/store"
import { scoreCompany, sizeTierLabel, yearsIncorporated } from "@/lib/scoring"
import type { RoleContext } from "@/lib/scoring"
import { fetchCHByName } from "@/lib/ch-api"
import { fetchSponsoredJobCount, fetchRoleJobCount } from "@/lib/reed-api"
import { sicToIndustry, nameToIndustry, ensureBenchmarks } from "@/lib/cos-api"
import { classifyRole } from "@/lib/role-classifier"
import { getCompanyBySlug as getMockBySlug } from "@/lib/mock-data"
import { ScoreRing } from "@/components/score-ring"
import { SponsorHistoryChart } from "@/components/sponsor-history-chart"

const BASE_SIGNAL_LABELS: Record<string, string> = {
  licenceStatus:           "Licence Rating",
  companyStatus:           "Company Status",
  industrySponsorshipRate: "Industry Sponsorship Rate",
  liveJobSignal:           "Live Sponsored Jobs",
  companySize:             "Company Size",
  international:           "Company Maturity",
  routeScope:              "Sponsor Route",
}

const MOCK_SIGNAL_LABELS: Record<string, string> = {
  volume: "Sponsorship Volume",
  registerStatus: "Register Status",
  roleMatch: "Role Match",
  sizeTier: "Company Size",
  recency: "Recency",
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "active"    ? "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30" :
    status === "dissolved" ? "bg-red-500/10 text-red-400 border-red-500/30"       :
                             "bg-[#1a1a1a] text-[#9ca3af] border-[#2a2a2a]"
  return (
    <span className={`inline-flex items-center text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border ${cls}`}>
      {status}
    </span>
  )
}

function SigBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? "#22c55e" : pct >= 55 ? "#6C47FF" : pct >= 30 ? "#f59e0b" : "#ef4444"
  return (
    <div className="w-full h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ role?: string }>
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const role = sp.role?.trim() || undefined

  // ── Real data path ──────────────────────────────────────────────────────────
  if (await countCompanies() > 0) {
    let company = await getCompanyBySlug(slug ?? "")
    if (!company) notFound()

    if (!company.chFetchedAt && process.env.COMPANIES_HOUSE_API_KEY) {
      const chData = await fetchCHByName(company.name)
      if (chData) {
        await updateCompanyWithCH(company.slug, chData)
        company = await getCompanyBySlug(slug) ?? company
      }
    }

    // Reed: fetch general sponsored job count if stale (24h TTL)
    const reedTtlMs = 24 * 60 * 60 * 1000
    // eslint-disable-next-line react-hooks/purity
    const nowMs = Date.now()
    const reedStale =
      !company.liveJobFetchedAt ||
      nowMs - new Date(company.liveJobFetchedAt).getTime() > reedTtlMs
    if (reedStale && process.env.REED_API_KEY) {
      const count = await fetchSponsoredJobCount(company.name)
      if (count !== null) {
        await updateCompanyWithReed(company.slug, count)
        company = await getCompanyBySlug(slug) ?? company
      }
    }

    // Role-specific: fetch live listing count for this role at this employer
    let roleCtx: RoleContext | undefined
    if (role && process.env.REED_API_KEY) {
      const jobCount = await fetchRoleJobCount(company.name, role)
      roleCtx = { role, jobCount }
    } else if (role) {
      roleCtx = { role, jobCount: null }
    }

    await ensureBenchmarks()
    const breakdown = scoreCompany(company, roleCtx)
    const location = [company.town, company.county].filter(Boolean).join(", ")
    const roleClass = role ? classifyRole(role) : null
    const signalLabel = (key: string) =>
      key === 'liveJobSignal' && role
        ? `Live "${role}" Roles`
        : (BASE_SIGNAL_LABELS[key] ?? key)

    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <nav className="border-b border-[#2a2a2a] px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <Link href="/" className="text-xs text-[#9ca3af] hover:text-white transition-colors">← Back</Link>
            <span className="text-sm font-bold tracking-tight text-white">SponsorIQ</span>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-6 py-10">
          {breakdown.capped && breakdown.capReason && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 mb-6 text-sm text-red-400 font-medium">
              ⚠ {breakdown.capReason}
            </div>
          )}

          {roleClass && (
            <div className={`border rounded-xl px-5 py-3.5 mb-6 text-sm flex items-start gap-3 ${
              roleClass.risk === 'high'
                ? 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]'
                : roleClass.risk === 'low'
                  ? 'bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]'
                  : 'bg-[#6C47FF]/10 border-[#6C47FF]/30 text-[#6C47FF]'
            }`}>
              <span className="mt-0.5 shrink-0">
                {roleClass.risk === 'high' ? '✓' : roleClass.risk === 'low' ? '⚠' : '◎'}
              </span>
              <div>
                <span className="font-semibold">{roleClass.label}</span>
                {' — '}
                {roleClass.detail}
              </div>
            </div>
          )}

          {/* Header */}
          <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{company.name}</h1>
              <div className="flex items-center gap-3 flex-wrap text-sm text-[#9ca3af]">
                {location && <span>{location}</span>}
                {company.sponsorRoute && (
                  <><span className="text-[#2a2a2a]">·</span><span>{company.sponsorRoute}</span></>
                )}
                {company.companyNumber && (
                  <><span className="text-[#2a2a2a]">·</span><span className="font-mono text-xs">CH {company.companyNumber}</span></>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap shrink-0">
              <span className="inline-flex items-center text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border bg-[#6C47FF]/10 text-[#6C47FF] border-[#6C47FF]/30">
                Licensed Sponsor
              </span>
              {role && (
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border bg-[#1a1a1a] text-[#9ca3af] border-[#2a2a2a]">
                  Role: {role}
                </span>
              )}
              {company.sponsorRating && (
                <span className="inline-flex items-center text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border bg-[#1a1a1a] text-[#9ca3af] border-[#2a2a2a]">
                  {company.sponsorRating}
                </span>
              )}
              {company.chStatus && <StatusBadge status={company.chStatus} />}
            </div>
          </div>

          {/* Score + breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 flex flex-col items-center justify-center gap-4">
              <ScoreRing score={breakdown.score} />
              <div className="w-full pt-4 border-t border-[#2a2a2a] text-xs text-[#9ca3af] space-y-1.5">
                <div className="flex justify-between">
                  <span>Signals used</span><span className="text-white">7</span>
                </div>
                <div className="flex justify-between">
                  <span>CH data</span>
                  <span className={company.chFetchedAt ? "text-[#22c55e]" : "text-[#9ca3af]"}>
                    {company.chFetchedAt ? "Loaded" : "Pending"}
                  </span>
                </div>
                {company.employeeAccountsType && (
                  <div className="flex justify-between">
                    <span>Accounts type</span>
                    <span className="text-white capitalize">{company.employeeAccountsType}</span>
                  </div>
                )}
                {company.employeeCount !== null && (
                  <div className="flex justify-between">
                    <span>Est. employees</span>
                    <span className="text-white">~{company.employeeCount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Live jobs (Reed)</span>
                  <span className={
                    company.liveJobCount === null
                      ? "text-[#9ca3af]"
                      : company.liveJobCount === 0
                        ? "text-[#9ca3af]"
                        : "text-[#22c55e]"
                  }>
                    {company.liveJobCount === null
                      ? "Pending"
                      : company.liveJobCount === 0
                        ? "None found"
                        : `${company.liveJobCount} role${company.liveJobCount === 1 ? "" : "s"}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
              <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-5">Score Breakdown</p>
              <div className="space-y-5">
                {Object.entries(breakdown.signals).map(([key, signal]) => {
                  const pts = Math.round((signal.normalisedScore ?? 0) * (signal.weight ?? 0) * 100)
                  const maxPts = Math.round((signal.weight ?? 0) * 100)
                  return (
                    <div key={key}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-medium text-white">{signalLabel(key)}</span>
                        <span className="text-xs text-[#9ca3af] font-mono tabular-nums">{pts} / {maxPts} pts</span>
                      </div>
                      <SigBar value={signal.normalisedScore ?? 0} />
                      <p className="text-xs text-[#9ca3af] leading-relaxed mt-1.5">{signal.explanation}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Company Profile */}
          {company.chFetchedAt && (() => {
            const tier = sizeTierLabel(company.employeeCount)
            const yrs = yearsIncorporated(company.incorporationDate)
            const sicIndustry = sicToIndustry(company.sicCodes)
            const inferredIndustry = !sicIndustry ? nameToIndustry(company.name) : null
            const industryLabel = sicIndustry ?? inferredIndustry
            return (
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 mb-4">
                <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-4">Company Profile</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">

                  {/* Size tier */}
                  {tier && (
                    <div>
                      <span className="text-xs text-[#9ca3af] block mb-1">Size</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{tier}</span>
                        {company.employeeCount !== null && (
                          <span className="text-xs text-[#9ca3af]">~{company.employeeCount.toLocaleString()} employees</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Years incorporated */}
                  {yrs !== null && (
                    <div>
                      <span className="text-xs text-[#9ca3af] block mb-1">Incorporated</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{company.incorporationDate}</span>
                        <span className="text-xs text-[#9ca3af]">{yrs} year{yrs === 1 ? '' : 's'} ago</span>
                      </div>
                    </div>
                  )}

                  {/* Company number */}
                  {company.companyNumber && (
                    <div>
                      <span className="text-xs text-[#9ca3af] block mb-1">CH number</span>
                      <span className="text-white font-mono">{company.companyNumber}</span>
                    </div>
                  )}

                  {/* Status */}
                  {company.chStatus && (
                    <div>
                      <span className="text-xs text-[#9ca3af] block mb-1">Status</span>
                      <span className="text-white capitalize">{company.chStatus}</span>
                    </div>
                  )}

                  {/* Industry label */}
                  {industryLabel && (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-[#9ca3af] block mb-1">
                        Industry {inferredIndustry ? '(inferred from name)' : '(SIC mapping)'}
                      </span>
                      <span className="text-white">{industryLabel}</span>
                    </div>
                  )}

                  {/* SIC codes */}
                  {company.sicCodes && company.sicCodes.length > 0 && (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-[#9ca3af] block mb-1.5">SIC codes</span>
                      <div className="flex gap-2 flex-wrap">
                        {company.sicCodes.map((code) => (
                          <span key={code} className="text-xs font-mono bg-[#1a1a1a] border border-[#2a2a2a] px-2 py-0.5 rounded-md text-[#9ca3af]">
                            {code}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Note for LLPs / overseas companies with no SIC codes */}
                  {company.sicCodes && company.sicCodes.length === 0 && (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-[#9ca3af]/50 italic">
                        SIC codes not published by Companies House for this entity type
                      </span>
                    </div>
                  )}

                  {/* Registered address */}
                  {company.registeredAddress && (
                    <div className="sm:col-span-2">
                      <span className="text-xs text-[#9ca3af] block mb-1">Registered address</span>
                      <span className="text-white">{company.registeredAddress}</span>
                    </div>
                  )}

                </div>
              </div>
            )
          })()}

          {/* Register details */}
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
            <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-4">Register Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {company.sponsorRoute && (
                <div>
                  <span className="text-xs text-[#9ca3af] block mb-0.5">Route</span>
                  <span className="text-white">{company.sponsorRoute}</span>
                </div>
              )}
              {company.sponsorSubTier && company.sponsorSubTier !== company.sponsorRoute && (
                <div>
                  <span className="text-xs text-[#9ca3af] block mb-0.5">Sub-tier</span>
                  <span className="text-white">{company.sponsorSubTier}</span>
                </div>
              )}
              {company.sponsorRating && (
                <div>
                  <span className="text-xs text-[#9ca3af] block mb-0.5">Rating</span>
                  <span className="text-white">{company.sponsorRating}</span>
                </div>
              )}
              {location && (
                <div>
                  <span className="text-xs text-[#9ca3af] block mb-0.5">Location</span>
                  <span className="text-white">{location}</span>
                </div>
              )}
              <div>
                <span className="text-xs text-[#9ca3af] block mb-0.5">Last updated</span>
                <span className="text-white">
                  {new Date(company.lastUpdated).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Mock / demo data fallback ────────────────────────────────────────────────
  const mock = getMockBySlug(slug ?? "")
  if (!mock) notFound()

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <nav className="border-b border-[#2a2a2a] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-xs text-[#9ca3af] hover:text-white transition-colors">← Back</Link>
          <span className="text-sm font-bold tracking-tight text-white">SponsorIQ</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-xs text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-full px-3 py-1.5 inline-flex items-center gap-2 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
          Demo data —{" "}
          <Link href="/admin" className="underline underline-offset-2 hover:text-[#f59e0b]">
            seed the register
          </Link>{" "}
          to load real records
        </p>

        {(mock.companyStatus === "dissolved" || mock.companyStatus === "dormant") && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 mb-6 text-sm text-red-400 font-medium">
            ⚠ Company is dissolved — cannot sponsor
          </div>
        )}
        {!mock.isActiveSponsor && mock.companyStatus !== "dissolved" && (
          <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-xl px-5 py-3 mb-6 text-sm text-[#f59e0b]">
            <span className="font-semibold">Not currently licensed</span> — would need to apply for a sponsor licence first.
          </div>
        )}

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{mock.name}</h1>
            <p className="text-sm text-[#9ca3af]">{mock.city} · {mock.industry} · {mock.employeeCount.toLocaleString()} employees</p>
          </div>
          <div className="flex gap-2 flex-wrap shrink-0">
            {mock.isActiveSponsor ? (
              <span className="inline-flex items-center text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border bg-[#6C47FF]/10 text-[#6C47FF] border-[#6C47FF]/30">
                Licensed Sponsor
              </span>
            ) : (
              <span className="inline-flex items-center text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border bg-red-500/10 text-red-400 border-red-500/30">
                Not Licensed
              </span>
            )}
            {mock.ukRating && (
              <span className="inline-flex items-center text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border bg-[#1a1a1a] text-[#9ca3af] border-[#2a2a2a]">
                {mock.ukRating}
              </span>
            )}
          </div>
        </div>

        {/* Score + breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 flex flex-col items-center justify-center gap-4">
            <ScoreRing score={mock.score} />
            <div className="w-full pt-4 border-t border-[#2a2a2a] text-xs text-[#9ca3af] space-y-1.5">
              <div className="flex justify-between">
                <span>Industry avg</span><span className="text-white">{mock.industryAvgScore}</span>
              </div>
              <div className="flex justify-between">
                <span>Percentile</span><span className="text-white">{mock.percentile}th</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
            <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-5">Score Breakdown</p>
            <div className="space-y-5">
              {Object.entries(mock.signals).map(([key, signal]) => {
                const pts = Math.round((signal.normalisedScore ?? 0) * (signal.weight ?? 0) * 100)
                const maxPts = Math.round((signal.weight ?? 0) * 100)
                return (
                  <div key={key}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-medium text-white">{MOCK_SIGNAL_LABELS[key] ?? key}</span>
                      <span className="text-xs text-[#9ca3af] font-mono tabular-nums">{pts} / {maxPts} pts</span>
                    </div>
                    <SigBar value={signal.normalisedScore ?? 0} />
                    <p className="text-xs text-[#9ca3af] leading-relaxed mt-1.5">{signal.explanation}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {mock.history.length > 0 && (
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 mb-4">
            <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-4">Sponsorship History</p>
            <SponsorHistoryChart history={mock.history} />
          </div>
        )}

        {mock.routes.length > 0 && (
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
            <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest mb-3">Sponsor Routes</p>
            <div className="flex gap-2 flex-wrap">
              {mock.routes.map((route) => (
                <span key={route} className="text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border bg-[#1a1a1a] text-[#9ca3af] border-[#2a2a2a]">
                  {route}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
