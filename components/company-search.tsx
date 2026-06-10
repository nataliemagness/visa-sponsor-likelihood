"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"

type Result = {
  slug: string
  name: string
  town: string | null
  county: string | null
  sponsorRoute: string | null
}

export function CompanySearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Result[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    fetch(`/api/companies/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data: { results: Result[] }) => {
        setResults(data.results)
        setOpen(data.results.length > 0)
        setActive(-1)
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(query), 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, search])

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  function navigate(slug: string) {
    setOpen(false)
    setQuery("")
    router.push(`/company/${slug}`)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault()
      navigate(results[active].slug)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Company name — e.g. Tata Consultancy, Deloitte"
          autoComplete="off"
          className="w-full h-12 px-4 rounded-xl text-sm text-white placeholder-[#9ca3af] bg-[#1a1a1a] border border-[#2a2a2a] focus:outline-none focus:border-[#6C47FF] focus:ring-1 focus:ring-[#6C47FF] transition-colors"
        />
        {loading && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <span className="w-4 h-4 border-2 border-[#6C47FF]/30 border-t-[#6C47FF] rounded-full animate-spin inline-block" />
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          className="absolute z-50 top-[calc(100%+6px)] left-0 right-0 bg-[#111111] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-xl"
          role="listbox"
        >
          {results.map((r, i) => {
            const loc = [r.town, r.county].filter(Boolean).join(", ")
            return (
              <li
                key={r.slug}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => { e.preventDefault(); navigate(r.slug) }}
                onPointerEnter={() => setActive(i)}
                className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors border-b border-[#2a2a2a] last:border-0 ${
                  i === active ? "bg-[#6C47FF]/10" : "hover:bg-[#1a1a1a]"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{r.name}</p>
                  {(loc || r.sponsorRoute) && (
                    <p className="text-xs text-[#9ca3af] truncate mt-0.5">
                      {[loc, r.sponsorRoute].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <span className="text-[#9ca3af] text-sm ml-3 shrink-0">→</span>
              </li>
            )
          })}
        </ul>
      )}

      {open && results.length === 0 && !loading && query.trim().length > 0 && (
        <div className="absolute z-50 top-[calc(100%+6px)] left-0 right-0 bg-[#111111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-[#9ca3af] shadow-xl">
          No companies found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  )
}
