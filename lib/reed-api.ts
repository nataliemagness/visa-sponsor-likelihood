const REED_BASE = 'https://www.reed.co.uk/api/1.0'

function authHeader(): string {
  const key = process.env.REED_API_KEY ?? ''
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64')
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
 */
export async function fetchSponsoredJobCount(companyName: string): Promise<number | null> {
  if (!process.env.REED_API_KEY) return null
  try {
    const primary = await reedSearch(companyName, 'visa sponsorship')
    if (primary === null) return null
    if (primary > 0) return primary

    // Primary returned 0 — try alternate phrasing before concluding zero
    const fallback = await reedSearch(companyName, 'skilled worker visa')
    if (fallback === null) return primary // keep the 0 rather than null
    return Math.max(primary, fallback)
  } catch {
    return null
  }
}

/**
 * Returns the total number of live job listings at an employer matching a specific role
 * title or keywords. Not filtered to sponsored roles — used to detect whether a company
 * actively hires for a given role type at all.
 * Returns null on API error.
 */
export async function fetchRoleJobCount(companyName: string, role: string): Promise<number | null> {
  if (!process.env.REED_API_KEY) return null
  try {
    return await reedSearch(companyName, role)
  } catch {
    return null
  }
}
