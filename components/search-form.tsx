"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function SearchForm() {
  const router = useRouter()
  const [role, setRole] = useState("")
  const [seniority, setSeniority] = useState("")
  const [route, setRoute] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!role.trim()) return
    const params = new URLSearchParams({ role })
    if (seniority) params.set("seniority", seniority)
    if (route) params.set("industry", route)
    router.push(`/search?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-2xl">
      <input
        type="text"
        placeholder="Job title — e.g. Software Engineer, Data Scientist"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="h-12 px-4 rounded-xl text-sm text-white placeholder-[#9ca3af] bg-[#1a1a1a] border border-[#2a2a2a] focus:outline-none focus:border-[#6C47FF] focus:ring-1 focus:ring-[#6C47FF] transition-colors"
      />
      <div className="flex gap-3">
        <select
          value={seniority}
          onChange={(e) => setSeniority(e.target.value)}
          className="flex-1 h-11 px-3 rounded-xl text-sm text-[#9ca3af] bg-[#1a1a1a] border border-[#2a2a2a] focus:outline-none focus:border-[#6C47FF] transition-colors appearance-none cursor-pointer"
        >
          <option value="">Seniority (any)</option>
          <option value="junior">Junior</option>
          <option value="mid">Mid-level</option>
          <option value="senior">Senior</option>
          <option value="lead">Lead / Principal</option>
        </select>
        <select
          value={route}
          onChange={(e) => setRoute(e.target.value)}
          className="flex-1 h-11 px-3 rounded-xl text-sm text-[#9ca3af] bg-[#1a1a1a] border border-[#2a2a2a] focus:outline-none focus:border-[#6C47FF] transition-colors appearance-none cursor-pointer"
        >
          <option value="">Route (any)</option>
          <option value="skilled worker">Skilled Worker</option>
          <option value="health">Health &amp; Care</option>
          <option value="senior">Senior / Specialist</option>
          <option value="intra">Intra-company</option>
        </select>
      </div>
      <button
        type="submit"
        className="h-12 rounded-full text-sm font-semibold text-white bg-[#6C47FF] hover:bg-[#5a3de0] transition-colors cursor-pointer"
      >
        Find sponsors →
      </button>
    </form>
  )
}
