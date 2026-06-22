export type BusinessModel =
  | 'tech'
  | 'finance'
  | 'professional'
  | 'legal'
  | 'biotech'
  | 'healthcare'
  | 'hospitality'
  | 'retail'
  | 'manufacturing'
  | 'other'

export type RoleCategory =
  | 'tech_sales'
  | 'tech_dev'
  | 'tech_product'
  | 'healthcare'
  | 'finance'
  | 'consulting'
  | 'legal'
  | 'general'

// Which business models are a good fit for each role category
const ROLE_ALLOWED_MODELS: Record<RoleCategory, BusinessModel[]> = {
  tech_sales:    ['tech', 'professional', 'finance'],
  tech_dev:      ['tech', 'biotech', 'finance', 'professional'],
  tech_product:  ['tech', 'finance', 'professional'],
  healthcare:    ['healthcare', 'biotech'],
  finance:       ['finance', 'professional', 'tech'],
  consulting:    ['professional', 'finance', 'tech'],
  legal:         ['legal', 'professional', 'finance'],
  general:       ['tech', 'finance', 'professional', 'legal', 'biotech', 'healthcare', 'manufacturing', 'retail', 'hospitality', 'other'],
}

// ── SIC-based classification ──────────────────────────────────────────────────

function classifyBySIC(sicCodes: string[]): BusinessModel | null {
  for (const sic of sicCodes) {
    const div = parseInt(sic.slice(0, 2), 10)
    const sec4 = parseInt(sic.slice(0, 4), 10)

    if (div === 69 && sic.slice(0, 4) === '6910') return 'legal'
    if (div >= 62 && div <= 63) return 'tech'
    if (div === 58 && sec4 >= 5821 && sec4 <= 5829) return 'tech'
    if (div === 61) return 'tech'
    if (div === 64 || div === 65 || div === 66) return 'finance'
    if (div === 69 || div === 70 || div === 71 || div === 73 || div === 74) return 'professional'
    if (div === 72 || (div >= 20 && div <= 21)) return 'biotech'
    if (div === 86 || div === 87 || div === 88) return 'healthcare'
    if (div === 55 || div === 56) return 'hospitality'
    if (div === 47) return 'retail'
    if (div >= 10 && div <= 33) return 'manufacturing'
  }
  return null
}

// ── Name-based classification ─────────────────────────────────────────────────

const LEGAL_NAME_RE = /\b(?:solicitors?|barristers?|law\s+firm|legal\s+services|attorneys?[\s-]at[\s-]law|chambers\b)\b|&\s*partners\b\s*(?:llp|solicitors)/i
const NAMED_LAW_FIRMS_RE = /\b(?:clifford\s+chance|linklaters|freshfields|slaughter\s+and\s+may|allen\s+&\s+overy|hogan\s+lovells|herbert\s+smith|ashurst|norton\s+rose|bird\s+&\s+bird|eversheds|pinsent\s+masons|cms\b|dla\s+piper|baker\s+mckenzie|dentons|sidley|latham\s+&\s+watkins|kirkland|white\s+&\s+case|simpson\s+thacher|weil\s+gotshal|skadden|cleary|cravath|sullivan\s+&\s+cromwell|paul\s+weiss|milbank|ropes\s+&\s+gray|shearman|jones\s+day)\b/i
const TECH_NAME_RE = /\b(?:software|tech|digital|data|ai|cloud|cyber|analytics|platform|systems|solutions|code|dev|labs?)\b/i
const FINANCE_NAME_RE = /\b(?:bank|capital|asset|invest|financial|wealth|fund|equity|credit|insurance|fintech)\b/i
const HEALTHCARE_NAME_RE = /\b(?:health|care|medical|clinic|hospital|pharma|nhs|therapeutics|biotech|life\s*sciences)\b/i
const HOSPITALITY_NAME_RE = /\b(?:hotel|restaurant|hospitality|catering|food|beverage|pub|bar)\b/i

function classifyByName(name: string): BusinessModel {
  const n = name.toLowerCase()
  if (NAMED_LAW_FIRMS_RE.test(name) || LEGAL_NAME_RE.test(name)) return 'legal'
  if (TECH_NAME_RE.test(n)) return 'tech'
  if (FINANCE_NAME_RE.test(n)) return 'finance'
  if (HEALTHCARE_NAME_RE.test(n)) return 'healthcare'
  if (HOSPITALITY_NAME_RE.test(n)) return 'hospitality'
  return 'other'
}

export function classifyBusiness(
  name: string,
  sicCodes?: string[] | null,
): BusinessModel {
  if (sicCodes && sicCodes.length > 0) {
    const fromSIC = classifyBySIC(sicCodes)
    if (fromSIC) return fromSIC
  }
  return classifyByName(name)
}

// ── Role category ─────────────────────────────────────────────────────────────

const TECH_DEV_RE = [
  /\b(?:software|backend|frontend|full[\s-]?stack|engineer|developer|architect|devops|cloud|platform|sre|data\s+engineer|machine\s+learning|ml|ai)\b/i,
]
const TECH_PRODUCT_RE = [
  /\b(?:product\s+manager|product\s+owner|ux|ui|design|scrum|agile|delivery\s+manager|programme\s+manager|project\s+manager)\b/i,
]
const TECH_SALES_RE = [
  /\b(?:account\s+executive|account\s+manager|sales\s+engineer|solutions\s+engineer|pre[\s-]?sales|business\s+development|customer\s+success)\b/i,
]
const HEALTHCARE_RE = [
  /\b(?:nurse|doctor|physician|consultant\s+(?:in|for)|clinical|pharmacist|therapist|surgeon|radiographer|paramedic)\b/i,
]
const FINANCE_RE = [
  /\b(?:analyst|quant|trader|portfolio|risk|compliance|actuary|audit|accountant|cfo|finance\s+manager|investment)\b/i,
]
const CONSULTING_RE = [
  /\b(?:consultant|associate|manager|senior\s+manager|principal|director|strategy|advisory|transformation)\b/i,
]
const LEGAL_RE: RegExp[] = [
  /\blawyer\b/i,
  /\bsolicitor\b/i,
  /\bbarrister\b/i,
  /\bparalegal\b/i,
  /\blegal\s+(?:counsel|advisor|assistant|secretary|executive|analyst|manager|officer)\b/i,
  /\bgeneral\s+counsel\b/i,
  /\bin[\s-]house\s+counsel\b/i,
  /\battorney\b/i,
  /\btrainee\s+solicitor\b/i,
  /\bconveyancer\b/i,
]

export function getRoleCategory(role: string): RoleCategory {
  for (const re of LEGAL_RE) if (re.test(role)) return 'legal'
  for (const re of TECH_DEV_RE) if (re.test(role)) return 'tech_dev'
  for (const re of TECH_PRODUCT_RE) if (re.test(role)) return 'tech_product'
  for (const re of TECH_SALES_RE) if (re.test(role)) return 'tech_sales'
  for (const re of HEALTHCARE_RE) if (re.test(role)) return 'healthcare'
  for (const re of FINANCE_RE) if (re.test(role)) return 'finance'
  for (const re of CONSULTING_RE) if (re.test(role)) return 'consulting'
  return 'general'
}

export function isRoleModelMatch(role: RoleCategory, model: BusinessModel): boolean {
  return ROLE_ALLOWED_MODELS[role]?.includes(model) ?? false
}
