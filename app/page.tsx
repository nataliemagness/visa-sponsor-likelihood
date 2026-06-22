import Link from "next/link"
import { SearchForm } from "@/components/search-form"
import { CompanySearch } from "@/components/company-search"
import { countCompanies, getSeededAt } from "@/lib/db/store"

function IconRefresh() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

function IconSignals() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function IconScore() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

export default async function Home() {
  const [total, seededAt] = await Promise.all([countCompanies(), getSeededAt()])

  const displayCount = total > 0 ? total.toLocaleString() : "141,883"
  const updatedLabel = seededAt
    ? `Updated ${new Date(seededAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
    : "Updated daily from gov.uk"

  return (
    <div className="min-h-screen bg-[#0a0a0a]">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="border-b border-[#2a2a2a] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#6C47FF] shadow-[0_0_6px_#6C47FF]" />
            <span className="text-sm font-bold tracking-tight text-white">SponsorIQ</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#how-it-works"
              className="text-xs text-[#9ca3af] hover:text-white transition-colors"
            >
              How it works
            </a>
            <Link href="/admin" className="text-xs text-[#9ca3af] hover:text-white transition-colors">
              Admin
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-10 text-center">

        {/* Badge */}
        <div className="mb-7 flex justify-center">
          <span className="inline-flex items-center gap-2 bg-[#6C47FF]/10 border border-[#6C47FF]/30 text-[#6C47FF] text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6C47FF] animate-pulse" />
            UK Skilled Worker Visa
          </span>
        </div>

        {/* Headline + glow */}
        <div className="relative mb-6">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[240px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, #6C47FF 0%, transparent 70%)",
              opacity: 0.09,
              filter: "blur(40px)",
            }}
          />
          <h1 className="relative text-5xl sm:text-6xl font-bold text-white leading-[1.08] tracking-tight">
            Will they sponsor<br />your visa?
          </h1>
        </div>

        <p className="text-base text-[#9ca3af] mb-10 max-w-xl mx-auto leading-relaxed">
          Search any UK employer to see their Skilled Worker Visa sponsorship
          likelihood — backed by the Home Office Register and Companies House.
        </p>

        {/* Stats bar */}
        <div className="inline-flex items-stretch bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden mb-14 max-w-full">
          <div className="flex items-center gap-2.5 px-5 sm:px-6 py-3.5 border-r border-[#2a2a2a]">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0 shadow-[0_0_5px_#22c55e]" />
            <span className="text-xs text-white font-medium whitespace-nowrap">
              {displayCount} licensed sponsors
            </span>
          </div>
          <div className="flex items-center gap-2.5 px-5 sm:px-6 py-3.5 border-r border-[#2a2a2a] text-[#6C47FF]">
            <IconRefresh />
            <span className="text-xs text-[#9ca3af] whitespace-nowrap">{updatedLabel}</span>
          </div>
          <div className="flex items-center gap-2.5 px-5 sm:px-6 py-3.5 text-[#6C47FF]">
            <IconSignals />
            <span className="text-xs text-[#9ca3af] whitespace-nowrap">7 scoring signals</span>
          </div>
        </div>

        {/* Search cards */}
        <div className="space-y-3 text-left">

          {/* Card 1 — role search */}
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-[3px] h-5 rounded-full bg-[#6C47FF]" />
              <h2 className="text-base font-semibold text-white">Find top sponsoring companies</h2>
            </div>
            <p className="text-sm text-[#9ca3af] mb-6 pl-[15px]">
              Enter a role to see which companies are most likely to sponsor it.
            </p>
            <SearchForm />
          </div>

          {/* Card 2 — company lookup */}
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-[3px] h-5 rounded-full bg-[#6C47FF]" />
              <h2 className="text-base font-semibold text-white">Look up a specific company</h2>
            </div>
            <p className="text-sm text-[#9ca3af] mb-6 pl-[15px]">
              {total > 0
                ? "Search any licensed UK sponsor to see their likelihood score."
                : "Try Tata Consultancy Services, Deloitte, or JPMorgan Chase."}
            </p>
            <CompanySearch />
          </div>

        </div>

        <p className="text-xs text-[#9ca3af] mt-5 leading-relaxed">
          Scores are estimates based on public government data and company signals — not guarantees of sponsorship. Always verify directly with employers.
        </p>
      </div>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="border-t border-[#2a2a2a] mt-6">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-widest text-center mb-10">
            How it works
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: <IconSearch />,
                step: "01",
                title: "Search",
                desc: "Enter a job role or look up any UK employer by name.",
              },
              {
                icon: <IconScore />,
                step: "02",
                title: "Score",
                desc: "We analyse 7 signals — licence rating, company size, live jobs, industry, and more.",
              },
              {
                icon: <IconCheck />,
                step: "03",
                title: "Apply with confidence",
                desc: "Target companies most likely to sponsor and skip the ones that won't.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-xl bg-[#6C47FF]/10 border border-[#6C47FF]/20 flex items-center justify-center text-[#6C47FF]">
                    {item.icon}
                  </div>
                  <span className="text-xs font-mono text-[#2a2a2a] select-none">{item.step}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-1.5">{item.title}</p>
                  <p className="text-xs text-[#9ca3af] leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Data sources footer ──────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Home Office Register", desc: "All ~55k licensed UK sponsors" },
            { label: "Companies House",       desc: "Company status, SIC codes, address" },
            { label: "Likelihood Score",      desc: "Signal-weighted 0–100 rating" },
          ].map((f) => (
            <div key={f.label} className="bg-[#111111] border border-[#2a2a2a] rounded-xl px-4 py-4">
              <div className="text-xs font-semibold text-white uppercase tracking-widest mb-1">{f.label}</div>
              <div className="text-xs text-[#9ca3af]">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
