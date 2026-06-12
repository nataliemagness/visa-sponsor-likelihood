const ADZUNA_BASE = 'https://api.adzuna.com/v1/api/jobs/gb/search/1'

// Hard cap: no single employer realistically lists this many roles at once.
// Exceeding this threshold means the company filter is likely not restricting results.
const SANITY_LIMIT = 50

export type AdzunaJob = {
  title: string
  company: { display_name: string }
  redirect_url: string
}

export type AdzunaRoleResult = {
  count: number | null
  results: AdzunaJob[]
}

function normalizeCompanyName(name: string): string {
  return name
    .replace(/\b(?:limited\s+liability\s+partnership|llp)\b/gi, '')
    .replace(/\b(?:public\s+limited\s+company|plc)\b/gi, '')
    .replace(/\b(?:limited|ltd\.?)\b/gi, '')
    .replace(/\b(?:incorporated|inc\.?)\b/gi, '')
    .replace(/\b(?:corporation|corp\.?)\b/gi, '')
    .replace(/\bllc\b/gi, '')
    .replace(/\b(?:uk|u\.k\.|united\s+kingdom|england|britain)\b/gi, '')
    .replace(/\b(?:europe|emea|global|international)\b/gi, '')
    .replace(/\b(?:group|holdings?)\b/gi, '')
    .replace(/[(),\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Searches Adzuna for live UK job listings at a specific employer matching a role keyword.
 * Returns { count, results } — count is null if the API is unconfigured, errored, or returned
 * an implausibly large number (company filter not restricting, treat as no data).
 */
export async function fetchAdzunaRoleCount(
  companyName: string,
  role: string,
): Promise<AdzunaRoleResult> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) return { count: null, results: [] }

  const normalized = normalizeCompanyName(companyName)
  const url = new URL(ADZUNA_BASE)
  url.searchParams.set('app_id', appId)
  url.searchParams.set('app_key', appKey)
  url.searchParams.set('what', role)
  url.searchParams.set('company', normalized)
  url.searchParams.set('results_per_page', '10')

  console.log(`[Adzuna] company="${normalized}" what="${role}"`)

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) {
      console.warn(`[Adzuna] HTTP ${res.status} for company="${normalized}"`)
      return { count: null, results: [] }
    }

    const json = await res.json() as { count?: number; results?: AdzunaJob[] }
    const count = json.count ?? 0
    const results = json.results ?? []

    console.log(`[Adzuna] → count=${count}`)
    results.slice(0, 3).forEach((r, i) =>
      console.log(`[Adzuna]   [${i}] company="${r.company?.display_name}" title="${r.title}"`)
    )

    if (count > SANITY_LIMIT) {
      console.warn(
        `[Adzuna] Unreliable: ${count} results for company="${normalized}" role="${role}" — company filter may not be restricting. Returning null.`,
      )
      return { count: null, results: [] }
    }

    return { count, results }
  } catch (err) {
    console.error('[Adzuna] Error:', err)
    return { count: null, results: [] }
  }
}
