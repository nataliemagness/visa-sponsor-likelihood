import type { CompanyRecord } from './db/store'

export type GlobalTier = 'named' | 'overseas-entity'

export type GlobalCompanyInfo = {
  isGlobal: boolean
  tier: GlobalTier | null
  note: string | null
}

// Curated list of well-known global firms with dedicated UK presences and immigration teams.
// Deliberately conservative — false positives give unwarranted score boosts.
const KNOWN_GLOBAL_PATTERNS: RegExp[] = [
  // US Big Tech / MAMAA
  /\bapple(?:\s+(?:inc\.?|computer))?\b/i,
  /\bgoogle(?:\s+(?:llc|inc\.?))?\b/i,
  /\balphabet\b/i,
  /\bmeta\s*(?:platforms?)?\b/i,
  /\bamazon\b/i,
  /\bmicrosoft\b/i,
  /\bnetflix\b/i,
  // US Enterprise Software
  /\bsalesforce\b/i,
  /\boracle\b/i,
  /\bsap\b/i,
  /\bservicenow\b/i,
  /\bworkday\b/i,
  /\bsnowflake\b/i,
  /\bdatadog\b/i,
  /\bsplunk\b/i,
  /\bpagerduty\b/i,
  /\bzendesk\b/i,
  /\bhubspot\b/i,
  /\bokta\b/i,
  /\btwilio\b/i,
  /\batlassian\b/i,
  /\bdropbox\b/i,
  /\bdocusign\b/i,
  /\badobe\b/i,
  /\bautodesk\b/i,
  /\bintuit\b/i,
  /\bvmware\b/i,
  /\bzoominfo\b/i,
  // US Security / Cybersecurity
  /\bcrowdstrike\b/i,
  /\bpalo\s+alto\s+networks\b/i,
  /\bfortinet\b/i,
  /\bzscaler\b/i,
  /\bsentinelone\b/i,
  /\brapid7\b/i,
  /\btenable\b/i,
  // US Finance, Banking & Trading
  /\bgoldman\s+sachs\b/i,
  /\bjp\s*morgan\b/i,
  /\bmorgan\s+stanley\b/i,
  /\bblackrock\b/i,
  /\bcitadel\b/i,
  /\bbridgewater\b/i,
  /\bjane\s+street\b/i,
  /\btwo\s+sigma\b/i,
  /\bblackstone\b/i,
  /\bcarlyle\b/i,
  /\bkkr\b/i,
  /\bapollo\s+global\b/i,
  /\bpoint72\b/i,
  // Infrastructure / Cloud
  /\bcloudflare\b/i,
  /\bfastly\b/i,
  /\bakamai\b/i,
  /\brackspace\b/i,
  // US Hardware & Semiconductors
  /\bintel\b/i,
  /\bnvidia\b/i,
  /\bqualcomm\b/i,
  /\bbroadcom\b/i,
  /\barm\s+(?:holdings|limited|ltd)\b/i,
  /\bcisco\b/i,
  /\bhewlett[- ]?packard\b/i,
  /\bdell\b/i,
  /\bibm\b/i,
  // US Fintech & Payments
  /\bstripe\b/i,
  /\bpaypal\b/i,
  /\bbraintree\b/i,
  // UK Global Banks
  /\bhsbc\b/i,
  /\bbarclays\b/i,
  /\bstandard\s+chartered\b/i,
  /\blloyds\s+(?:bank|banking\s+group)\b/i,
  /\bnatwest\b/i,
  // UK Global Corporates
  /\bshell\b/i,
  /\bbritish\s+petroleum\b/i,
  /\bastrazeneca\b/i,
  /\bgsk\b/i,
  /\bglaxosmithkline\b/i,
  /\bunilever\b/i,
  /\bdiageo\b/i,
  /\bbt\s+group\b/i,
  // Big Four & Strategy Consulting
  /\bkpmg\b/i,
  /\bdeloitte\b/i,
  /\bpricewaterhousecoopers\b/i,
  /\bpwc\b/i,
  /\bernst\s*(?:&|and)\s*young\b/i,
  /\bey\b/i,
  /\bmckinsey\b/i,
  /\bbain\s*(?:&|and)\s*company\b/i,
  /\bboston\s+consulting\b/i,
  /\bbcg\b/i,
  /\boliver\s+wyman\b/i,
  /\baccent(?:ure|ure)\b/i,
  // Large Indian IT services
  /\btata\s+consultancy\b/i,
  /\binfosys\b/i,
  /\bwipro\b/i,
  /\bcognizant\b/i,
  /\bhcl\s+(?:technologies|tech)\b/i,
  // Other notable global
  /\bpalantir\b/i,
  /\bdatabricks\b/i,
  /\bopenai\b/i,
  /\banthrop(?:ic)\b/i,
  /\buber\b/i,
  /\bairbnb\b/i,
  /\bspotify\b/i,
  /\bbooking\.com\b/i,
  /\bexpedia\b/i,
  /\btwitter\b/i,
  /\blinkedin\b/i,
]

// Non-UK legal entity suffixes — company was incorporated abroad
const OVERSEAS_SUFFIX_RE = /\b(?:s\.?e\b|n\.?v\b|s\.?a\b|s\.?p\.?a\b|a\/s\b|gmbh\b|a\.?g\b|b\.?v\b|oy\b|a\.?b\b|s\.?a\.?s\b|inc\.?\s*$|corp\.?\s*$|llc\s*$)\b/i

export function detectGlobalCompany(company: CompanyRecord): GlobalCompanyInfo {
  const name = company.name

  // Tier 1: named global firm
  for (const pattern of KNOWN_GLOBAL_PATTERNS) {
    if (pattern.test(name)) {
      return {
        isGlobal: true,
        tier: 'named',
        note: 'Known global company with dedicated immigration infrastructure and routine international hiring.',
      }
    }
  }

  // Tier 2: registered with a foreign legal suffix — overseas branch or SE company
  if (OVERSEAS_SUFFIX_RE.test(name)) {
    return {
      isGlobal: true,
      tier: 'overseas-entity',
      note: 'Foreign-incorporated entity registered in the UK — international hiring is routine.',
    }
  }

  return { isGlobal: false, tier: null, note: null }
}
