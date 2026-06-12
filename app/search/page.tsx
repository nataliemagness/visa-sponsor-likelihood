import Link from "next/link"
import { searchCompanies, countCompanies } from "@/lib/db/store"
import { scoreCompany } from "@/lib/scoring"
import { ensureBenchmarks } from "@/lib/cos-api"
import { SearchForm } from "@/components/search-form"

function ScorePill({ score, label }: { score: number; label: string }) {
  const color =
    score >= 80 ? { text: "text-[#22c55e]", bg: "bg-[#22c55e]/10", border: "border-[#22c55e]/30" } :
    score >= 55 ? { text: "text-[#6C47FF]",  bg: "bg-[#6C47FF]/10",  border: "border-[#6C47FF]/30"  } :
    score >= 30 ? { text: "text-[#f59e0b]",  bg: "bg-[#f59e0b]/10",  border: "border-[#f59e0b]/30"  } :
                  { text: "text-red-400",     bg: "bg-red-500/10",    border: "border-red-500/30"    }

  return (
    <span
      className={`inline-flex items-center text-xs font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${color.text} ${color.bg} ${color.border}`}
    >
      {label}
    </span>
  )
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; industry?: string; seniority?: string }>
}) {
  const params = await searchParams
  const role = params.role ?? ""
  const industry = params.industry
  const total = await countCompanies()

  if (total === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <nav className="border-b border-[#2a2a2a] px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            <Link href="/" className="text-xs text-[#9ca3af] hover:text-white transition-colors">← Back</Link>
            <span className="text-sm font-bold tracking-tight text-white">SponsorIQ</span>
          </div>
        </nav>
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-12 inline-block">
            <div className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-2xl mx-auto mb-5">
              📂
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No real data loaded yet</h2>
            <p className="text-[#9ca3af] text-sm mb-6 max-w-sm mx-auto">
              Seed the UK Sponsor Register to search across 55,000+ licensed companies.
            </p>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 bg-[#6C47FF] hover:bg-[#5a3de0] text-white text-sm font-semibold px-6 py-2.5 rounded-full transition-colors"
            >
              Seed real data →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const results = await searchCompanies(role, industry)
  await ensureBenchmarks()

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <nav className="border-b border-[#2a2a2a] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-xs text-[#9ca3af] hover:text-white transition-colors">← Back</Link>
          <span className="text-sm font-bold tracking-tight text-white">SponsorIQ</span>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">
            {role ? (
              <>Sponsors for <span className="text-[#6C47FF]">{role}</span></>
            ) : (
              "Licensed sponsors"
            )}
          </h1>
          <p className="text-[#9ca3af] text-sm">
            {results.length} companies
            {industry ? ` · ${industry}` : ""}
            {params.seniority ? ` · ${params.seniority} level` : ""}
            {" · "}{total.toLocaleString()} total indexed
          </p>
        </div>

        {role && (
          <p className="text-xs text-[#9ca3af] bg-[#111111] border border-[#2a2a2a] rounded-xl px-4 py-3 mb-6">
            Showing all licensed sponsors matching your search. Role-specific matching requires historic visa certificate data — coming soon.
          </p>
        )}

        {results.length === 0 ? (
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-12 text-center mb-8">
            <p className="text-white font-medium mb-1">No matches found</p>
            <p className="text-[#9ca3af] text-sm">Try a shorter search term or browse all companies.</p>
          </div>
        ) : (
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[#9ca3af] uppercase tracking-widest w-10">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#9ca3af] uppercase tracking-widest">Company</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#9ca3af] uppercase tracking-widest hidden md:table-cell">Route</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#9ca3af] uppercase tracking-widest hidden lg:table-cell">Location</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-[#9ca3af] uppercase tracking-widest w-40">Likelihood</th>
                </tr>
              </thead>
              <tbody>
                {results.map((company, i) => {
                  const { score, label } = scoreCompany(company)
                  const barColor =
                    score >= 80 ? "#22c55e" :
                    score >= 55 ? "#6C47FF" :
                    score >= 30 ? "#f59e0b" :
                    "#ef4444"
                  return (
                    <tr
                      key={company.slug}
                      className="border-b border-[#2a2a2a] last:border-0 hover:bg-[#1a1a1a] transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-[#9ca3af] font-mono tabular-nums">{i + 1}</td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/company/${company.slug}`}
                          className="font-medium text-white hover:text-[#6C47FF] transition-colors text-sm"
                        >
                          {company.name}
                        </Link>
                        {company.sponsorRating && (
                          <span className="ml-2 text-xs text-[#9ca3af]">{company.sponsorRating}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        {company.sponsorRoute ? (
                          <span className="text-xs text-[#9ca3af] bg-[#1a1a1a] border border-[#2a2a2a] px-2.5 py-1 rounded-full">
                            {company.sponsorRoute}
                          </span>
                        ) : (
                          <span className="text-xs text-[#9ca3af]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell text-sm text-[#9ca3af]">
                        {[company.town, company.county].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${score}%`, backgroundColor: barColor }}
                              />
                            </div>
                            <span className="text-sm font-bold text-white w-8 text-right tabular-nums">{score}</span>
                          </div>
                          <ScorePill score={score} label={label} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
          <p className="text-sm font-semibold text-white mb-4">Search again</p>
          <SearchForm />
        </div>
      </div>
    </div>
  )
}
