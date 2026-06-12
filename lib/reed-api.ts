const REED_BASE = 'https://www.reed.co.uk/api/1.0'

function authHeader(): string {
  const key = process.env.REED_API_KEY ?? ''
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64')
}

function normalizeForReed(name: string): string {
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

async function reedSearch(employer: string, keywords: string): Promise<number | null> {
  const url =
    `${REED_BASE}/search?employer=${encodeURIComponent(employer)}` +
    `&keywords=${encodeURIComponent(keywords)}&resultsToTake=1`
  const res = await fetch(url, {
    headers: { Authorization: authHeader() },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null
  const json = await res.json() as { totalResults?: number }
  return json.totalResults ?? 0
}

/**
 * Returns the number of sponsored job listings for the given employer on Reed.
 * Tries "visa sponsorship" first, then "skilled worker visa" as a fallback.
 * Returns null on API error (key missing, network failure, timeout) — callers
 * must treat null as "no data" rather than "zero jobs".
 *
 * Note: Reed's employer filter is used for a broad "does this company sponsor?" signal.
 * For role-specific counts use fetchAdzunaRoleCount (lib/adzuna-api.ts) instead —
 * Reed's employer filter does not reliably restrict to a single employer.
 */
export async function fetchSponsoredJobCount(companyName: string): Promise<number | null> {
  if (!process.env.REED_API_KEY) return null
  const normalized = normalizeForReed(companyName)
  try {
    const primary = await reedSearch(normalized, 'visa sponsorship')
    if (primary === null) return null
    if (primary > 0) return primary

    // Primary returned 0 — try alternate phrasing before concluding zero
    const fallback = await reedSearch(normalized, 'skilled worker visa')
    if (fallback === null) return primary // keep the 0 rather than null
    return Math.max(primary, fallback)
  } catch {
    return null
  }
}
