import Link from "next/link"
import { SearchForm } from "@/components/search-form"
import { CompanySearch } from "@/components/company-search"
import { countCompanies, getSeededAt } from "@/lib/db/store"

export default function Home() {
  const total = countCompanies()
  const seededAt = getSeededAt()

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Nav */}
      <nav className="border-b border-[#2a2a2a] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-sm font-bold tracking-tight text-white">SponsorIQ</span>
          <Link href="/admin" className="text-xs text-[#9ca3af] hover:text-white transition-colors">
            Admin
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-20 pb-28">
        {/* Badge */}
        <div className="mb-5">
          <span className="inline-flex items-center gap-2 bg-[#6C47FF]/10 border border-[#6C47FF]/30 text-[#6C47FF] text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6C47FF] animate-pulse" />
            UK Skilled Worker Visa
          </span>
        </div>

        {/* Hero */}
        <h1 className="text-5xl sm:text-6xl font-bold text-white mb-5 leading-[1.08] tracking-tight">
          Will they sponsor<br />your visa?
        </h1>
        <p className="text-base text-[#9ca3af] mb-4 max-w-xl leading-relaxed">
          Search any UK employer to see their Skilled Worker Visa sponsorship likelihood — backed by the Home Office Register and Companies House.
        </p>

        {total > 0 ? (
          <p className="text-sm text-[#9ca3af] mb-12">
            <span className="text-white font-medium">{total.toLocaleString()}</span> licensed sponsors indexed
            {seededAt
              ? ` · updated ${new Date(seededAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
              : ""}
          </p>
        ) : (
          <p className="text-sm text-[#f59e0b]/80 mb-12">
            No data loaded yet —{" "}
            <Link href="/admin" className="underline underline-offset-2 hover:text-[#f59e0b]">
              seed the register
            </Link>{" "}
            to get started
          </p>
        )}

        {/* Search card */}
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8 mb-4">
          <h2 className="text-base font-semibold text-white mb-1">Find top sponsoring companies</h2>
          <p className="text-sm text-[#9ca3af] mb-6">Enter a role to see which companies are most likely to sponsor it.</p>
          <SearchForm />
        </div>

        {/* Company lookup */}
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8 mb-12">
          <h2 className="text-base font-semibold text-white mb-1">Look up a specific company</h2>
          <p className="text-sm text-[#9ca3af] mb-6">
            {total > 0
              ? "Search any licensed UK sponsor to see their likelihood score."
              : "Seed real data to search across 55k+ licensed UK sponsors."}
          </p>
          <CompanySearch />
        </div>

        {/* Data sources */}
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
