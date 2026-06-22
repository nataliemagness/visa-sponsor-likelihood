"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

type Status = { count: number; seededAt: string | null }

type RegisterResult = {
  success: boolean
  count?: number
  skipped?: number
  csvUrl?: string
  duration?: number
  error?: string
}

type HistoricResult = {
  success: boolean
  benchmarks?: { industries: number; years: number[]; xlsxUrl: string }
  ch?: { fetched: number; failed: number; alreadyHad: number; skippedLimit: number }
  duration?: number
  error?: string
}

export default function AdminPage() {
  const [status, setStatus] = useState<Status | null>(null)

  const [seeding, setSeeding] = useState(false)
  const [registerResult, setRegisterResult] = useState<RegisterResult | null>(null)

  const [seedingHistoric, setSeedingHistoric] = useState(false)
  const [historicResult, setHistoricResult] = useState<HistoricResult | null>(null)

  useEffect(() => {
    fetch("/api/seed/status")
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ count: 0, seededAt: null }))
  }, [])

  async function handleSeed() {
    setSeeding(true)
    setRegisterResult(null)
    try {
      const res = await fetch("/api/seed", { method: "POST" })
      const data = (await res.json()) as RegisterResult
      setRegisterResult(data)
      if (data.success) setStatus({ count: data.count ?? 0, seededAt: new Date().toISOString() })
    } catch {
      setRegisterResult({ success: false, error: "Network error — check the browser console" })
    } finally {
      setSeeding(false)
    }
  }

  async function handleHistoric() {
    setSeedingHistoric(true)
    setHistoricResult(null)
    try {
      const res = await fetch("/api/seed/historic", { method: "POST" })
      const data = (await res.json()) as HistoricResult
      setHistoricResult(data)
    } catch {
      setHistoricResult({ success: false, error: "Network error — check the browser console" })
    } finally {
      setSeedingHistoric(false)
    }
  }

  const registerNotSeeded = status !== null && status.count === 0

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <nav className="border-b border-[#2a2a2a] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold tracking-tight text-white">SponsorIQ</Link>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#9ca3af] bg-[#1a1a1a] border border-[#2a2a2a] px-2.5 py-1 rounded-full">
            Admin
          </span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">Data Admin</h1>
          <p className="text-[#9ca3af] text-sm">Seed and manage real data from public UK government sources.</p>
        </div>

        {/* Status bar */}
        {status && (
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl px-6 py-5 mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#9ca3af] mb-1">Companies in database</p>
              <p className="text-3xl font-bold text-white tabular-nums">{status.count.toLocaleString()}</p>
            </div>
            {status.seededAt && (
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#9ca3af] mb-1">Last seeded</p>
                <p className="text-sm text-white">
                  {new Date(status.seededAt).toLocaleString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 1 — Sponsor Register */}
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#6C47FF] bg-[#6C47FF]/10 border border-[#6C47FF]/30 px-2 py-0.5 rounded-full">Step 1</span>
            <h2 className="text-base font-semibold text-white">UK Sponsor Register</h2>
          </div>
          <p className="text-sm text-[#9ca3af] max-w-md leading-relaxed mb-4">
            Downloads the latest CSV from the Home Office Register of Licensed Sponsors — all ~55k companies licensed to sponsor Skilled Worker visas.
          </p>
          <p className="text-xs text-[#9ca3af]/40 font-mono break-all mb-6">
            gov.uk/government/publications/register-of-licensed-sponsors-workers
          </p>

          <button
            onClick={handleSeed}
            disabled={seeding}
            className={`w-full py-3 px-5 rounded-full text-sm font-semibold transition-all ${
              seeding
                ? "bg-[#6C47FF]/30 text-[#6C47FF]/60 cursor-not-allowed"
                : "bg-[#6C47FF] hover:bg-[#5a3de0] text-white cursor-pointer"
            }`}
          >
            {seeding ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-[#6C47FF]/40 border-t-[#6C47FF] rounded-full animate-spin" />
                Downloading & seeding — 15–60 seconds…
              </span>
            ) : "Seed real data"}
          </button>

          {registerResult && (
            <div className={`mt-4 text-sm rounded-xl px-4 py-3.5 border ${
              registerResult.success
                ? "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30"
                : "bg-red-500/10 text-red-400 border-red-500/30"
            }`}>
              {registerResult.success ? (
                <>
                  <span className="font-semibold">Done.</span> Imported{" "}
                  <span className="font-mono">{registerResult.count?.toLocaleString()}</span> companies
                  {registerResult.skipped ? <>, skipped <span className="font-mono">{registerResult.skipped}</span></> : null}{" "}
                  in {registerResult.duration}s.
                  {registerResult.csvUrl && (
                    <div className="mt-1.5 text-xs opacity-60 font-mono break-all">{registerResult.csvUrl}</div>
                  )}
                </>
              ) : (
                <><span className="font-semibold">Error:</span> {registerResult.error}</>
              )}
            </div>
          )}
        </div>

        {/* Step 2 — Industry Benchmarks + CH batch */}
        <div className={`bg-[#111111] border rounded-2xl p-6 mb-4 transition-colors ${
          registerNotSeeded ? "border-[#2a2a2a] opacity-60" : "border-[#2a2a2a]"
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#9ca3af] bg-[#1a1a1a] border border-[#2a2a2a] px-2 py-0.5 rounded-full">Step 2</span>
            <h2 className="text-base font-semibold text-white">Industry Benchmarks + CH Enrichment</h2>
          </div>
          <p className="text-sm text-[#9ca3af] max-w-xl leading-relaxed mb-3">
            Downloads the Home Office Work Sponsorship CoS XLSX to build industry-level sponsorship benchmarks, then pre-fetches Companies House data (status, SIC codes, employee tier) for the next 300 unenriched companies.
          </p>
          <div className="text-xs text-[#9ca3af]/40 font-mono break-all mb-2">
            gov.uk/government/statistical-data-sets/managed-migration-datasets
          </div>
          <p className="text-xs text-[#9ca3af] mb-6">
            Note: the CoS dataset publishes industry-level aggregates, not per-employer counts. Industry rates feed the 30% volume signal. Run again whenever a new quarterly release is published.
          </p>

          {registerNotSeeded && (
            <p className="text-xs text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-xl px-3 py-2 mb-4">
              Complete Step 1 first — the register must be seeded before enrichment can run.
            </p>
          )}

          <button
            onClick={handleHistoric}
            disabled={seedingHistoric || registerNotSeeded}
            className={`w-full py-3 px-5 rounded-full text-sm font-semibold transition-all ${
              seedingHistoric
                ? "bg-[#6C47FF]/30 text-[#6C47FF]/60 cursor-not-allowed"
                : registerNotSeeded
                ? "bg-[#1a1a1a] text-[#9ca3af] cursor-not-allowed"
                : "bg-[#6C47FF] hover:bg-[#5a3de0] text-white cursor-pointer"
            }`}
          >
            {seedingHistoric ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-[#6C47FF]/40 border-t-[#6C47FF] rounded-full animate-spin" />
                Building benchmarks + fetching CH — up to 5 minutes…
              </span>
            ) : "Seed industry benchmarks + CH data"}
          </button>

          {historicResult && (
            <div className={`mt-4 text-sm rounded-xl px-4 py-3.5 border ${
              historicResult.success
                ? "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30"
                : "bg-red-500/10 text-red-400 border-red-500/30"
            }`}>
              {historicResult.success ? (
                <div className="space-y-1">
                  <p>
                    <span className="font-semibold">Done</span> in {historicResult.duration}s.
                  </p>
                  {historicResult.benchmarks && (
                    <p>
                      Industry benchmarks: <span className="font-mono">{historicResult.benchmarks.industries}</span> sectors
                      {" "}(years: {historicResult.benchmarks.years?.join(", ")})
                    </p>
                  )}
                  {historicResult.ch && (
                    <p>
                      CH enrichment: <span className="font-mono">{historicResult.ch.fetched}</span> fetched
                      {historicResult.ch.failed > 0 && <>, <span className="font-mono">{historicResult.ch.failed}</span> failed</>}
                      {historicResult.ch.skippedLimit > 0 && <>, <span className="font-mono">{historicResult.ch.skippedLimit}</span> deferred (run again to continue)</>}
                    </p>
                  )}
                </div>
              ) : (
                <><span className="font-semibold">Error:</span> {historicResult.error}</>
              )}
            </div>
          )}
        </div>

        {/* Info card */}
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-1">Scoring signals</h2>
          <p className="text-sm text-[#9ca3af] mb-4 leading-relaxed">
            After seeding, each company score uses seven signals with these weights:
          </p>
          <div className="space-y-2">
            {[
              { label: "Licence rating (A/B)",        weight: "30%", note: "From register" },
              { label: "Company status",               weight: "20%", note: "From Companies House" },
              { label: "Industry sponsorship rate",    weight: "20%", note: "From CoS XLSX" },
              { label: "Live sponsored jobs (Reed)",   weight: "10%", note: "Reed.co.uk API" },
              { label: "Company size",                 weight: "10%", note: "From Companies House" },
              { label: "Company maturity",             weight:  "5%", note: "From Companies House" },
              { label: "Sponsor route scope",          weight:  "5%", note: "From register" },
            ].map(({ label, weight, note }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-[#9ca3af]">{label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[#9ca3af]/50">{note}</span>
                  <span className="font-mono font-semibold text-white w-8 text-right">{weight}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
