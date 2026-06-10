const CH_BASE = 'https://api.company-information.service.gov.uk'

export type CHData = {
  companyNumber: string
  chStatus: string
  sicCodes: string[]
  registeredAddress: string
  employeeCount: number | null
  employeeAccountsType: string | null
  incorporationDate: string | null
}

// CH doesn't expose headcount directly; infer a midpoint from accounts category.
// This is an estimate — the accounts type tells us the size filing threshold met.
const ACCOUNTS_TYPE_EMPLOYEE_ESTIMATE: Record<string, number> = {
  'dormant':                   1,
  'micro-entity':              5,
  'total-exemption-small':    30,
  'total-exemption-full':     30,
  'small':                    30,
  'unaudited-abridged':       30,
  'partial-exemption':       150,
  'medium':                  150,
  'full':                    400,
  'large':                   400,
  'group':                  1500,
  'package':                1500,
}

function authHeader(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY ?? ''
  return 'Basic ' + Buffer.from(`${key}:`).toString('base64')
}

async function chFetch(path: string) {
  return fetch(`${CH_BASE}${path}`, {
    headers: { Authorization: authHeader() },
    signal: AbortSignal.timeout(6000),
  })
}

export async function fetchCHByName(name: string): Promise<CHData | null> {
  if (!process.env.COMPANIES_HOUSE_API_KEY) return null
  try {
    const res = await chFetch(`/search/companies?q=${encodeURIComponent(name)}&items_per_page=5`)
    if (!res.ok) return null

    const json = await res.json() as {
      items?: Array<{
        company_number: string
        title: string
        company_status?: string
        address_snippet?: string
        date_of_creation?: string
      }>
    }

    const items = json.items ?? []
    if (items.length === 0) return null

    const exact = items.find((i) => i.title.toUpperCase() === name.toUpperCase())
    const match = exact ?? items[0]

    // Get full detail for SIC codes and address
    const detail = await fetchCHDetail(match.company_number)

    return {
      companyNumber: match.company_number,
      chStatus: detail?.chStatus ?? match.company_status ?? 'unknown',
      sicCodes: detail?.sicCodes ?? [],
      registeredAddress: detail?.registeredAddress ?? match.address_snippet ?? '',
      employeeCount: detail?.employeeCount ?? null,
      employeeAccountsType: detail?.employeeAccountsType ?? null,
      incorporationDate: detail?.incorporationDate ?? match.date_of_creation ?? null,
    }
  } catch {
    return null
  }
}

async function fetchCHDetail(number: string): Promise<{
  chStatus: string
  sicCodes: string[]
  registeredAddress: string
  employeeCount: number | null
  employeeAccountsType: string | null
  incorporationDate: string | null
} | null> {
  try {
    const res = await chFetch(`/company/${number}`)
    if (!res.ok) return null

    const d = await res.json() as {
      company_status?: string
      sic_codes?: string[]
      registered_office_address?: {
        address_line_1?: string
        address_line_2?: string
        locality?: string
        postal_code?: string
        country?: string
      }
      date_of_creation?: string
      accounts?: {
        last_accounts?: { type?: string }
      }
    }

    const a = d.registered_office_address ?? {}
    const address = [a.address_line_1, a.address_line_2, a.locality, a.postal_code, a.country]
      .filter(Boolean)
      .join(', ')

    const accountsType = d.accounts?.last_accounts?.type?.toLowerCase() ?? null
    const employeeCount = accountsType
      ? (ACCOUNTS_TYPE_EMPLOYEE_ESTIMATE[accountsType] ?? null)
      : null

    return {
      chStatus: d.company_status ?? 'unknown',
      sicCodes: d.sic_codes ?? [],
      registeredAddress: address,
      employeeCount,
      employeeAccountsType: accountsType,
      incorporationDate: d.date_of_creation ?? null,
    }
  } catch {
    return null
  }
}
