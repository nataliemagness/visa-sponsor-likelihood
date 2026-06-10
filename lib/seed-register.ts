import type { CompanyRecord } from './db/store'

export type SeedResult = {
  count: number
  skipped: number
  seededAt: string
  csvUrl: string
  companies: CompanyRecord[]
}

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120)
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(field.trim())
      field = ''
    } else if ((ch === '\r' && next === '\n') || (ch === '\n' && !inQuotes)) {
      if (ch === '\r') i++
      row.push(field.trim())
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (row.length > 0) {
    row.push(field.trim())
    if (row.some((f) => f !== '')) rows.push(row)
  }
  return rows
}

async function getCsvUrl(): Promise<string> {
  const res = await fetch(
    'https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers',
    { headers: { 'User-Agent': 'SponsorIQ/1.0' } }
  )
  if (!res.ok) throw new Error(`GOV.UK API returned HTTP ${res.status}`)

  const content = await res.json() as {
    details?: {
      attachments?: Array<{ url?: string; title?: string; content_type?: string }>
      documents?: Array<{ url?: string }>
    }
  }

  const attachments = content.details?.attachments ?? []
  const found =
    attachments.find((a) => a.content_type === 'text/csv') ??
    attachments.find((a) => a.url?.toLowerCase().endsWith('.csv')) ??
    attachments.find((a) => a.title?.toLowerCase().includes('worker'))

  if (found?.url) return found.url

  const docs = content.details?.documents ?? []
  const csvDoc = docs.find((d) => d.url?.toLowerCase().endsWith('.csv'))
  if (csvDoc?.url) return csvDoc.url

  throw new Error(
    `Could not locate CSV in GOV.UK response. Attachment titles: [${attachments.map((a) => a.title).join(', ')}]`
  )
}

export async function runSeed(): Promise<SeedResult> {
  const csvUrl = await getCsvUrl()

  const csvRes = await fetch(csvUrl, { headers: { 'User-Agent': 'SponsorIQ/1.0' } })
  if (!csvRes.ok) throw new Error(`CSV download failed: HTTP ${csvRes.status}`)

  let csvText = await csvRes.text()
  if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1) // strip UTF-8 BOM

  const rows = parseCSV(csvText)
  if (rows.length < 2) throw new Error('CSV appears empty or malformed')

  const headers = rows[0].map((h) => h.toLowerCase().replace(/['"]/g, '').trim())

  const nameIdx = headers.findIndex((h) => h.includes('organisation'))
  const townIdx = headers.findIndex((h) => h.includes('town') || h.includes('city'))
  const countyIdx = headers.findIndex((h) => h.includes('county'))
  const ratingIdx = headers.findIndex(
    (h) => h.includes('rating') || (h.includes('type') && !h.includes('sub'))
  )
  const routeIdx = headers.findIndex((h) => h.includes('route'))
  const subTierIdx = headers.findIndex((h) => h.includes('sub'))

  if (nameIdx === -1) {
    throw new Error(
      `Cannot find Organisation Name column. CSV headers: [${rows[0].join(' | ')}]`
    )
  }

  const now = new Date().toISOString()
  const slugsSeen = new Set<string>()
  const companies: CompanyRecord[] = []
  let skipped = 0

  for (const row of rows.slice(1)) {
    const name = row[nameIdx]?.trim()
    if (!name) { skipped++; continue }

    let slug = nameToSlug(name)
    if (!slug) { skipped++; continue }

    if (slugsSeen.has(slug)) {
      let n = 2
      while (slugsSeen.has(`${slug}-${n}`)) n++
      slug = `${slug}-${n}`
    }
    slugsSeen.add(slug)

    companies.push({
      slug,
      name,
      town: townIdx >= 0 ? (row[townIdx]?.trim() || null) : null,
      county: countyIdx >= 0 ? (row[countyIdx]?.trim() || null) : null,
      sponsorRating: ratingIdx >= 0 ? (row[ratingIdx]?.trim() || null) : null,
      sponsorRoute: routeIdx >= 0 ? (row[routeIdx]?.trim() || null) : null,
      sponsorSubTier: subTierIdx >= 0 ? (row[subTierIdx]?.trim() || null) : null,
      companyNumber: null,
      chStatus: null,
      sicCodes: null,
      registeredAddress: null,
      employeeCount: null,
      employeeAccountsType: null,
      incorporationDate: null,
      chFetchedAt: null,
      lastUpdated: now,
    })
  }

  return { count: companies.length, skipped, seededAt: now, csvUrl, companies }
}
