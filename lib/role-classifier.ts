export type RoleRisk = 'high' | 'low' | 'neutral'

export type RoleClassification = {
  risk: RoleRisk
  label: string
  detail: string
}

const HIGH_PATTERNS: RegExp[] = [
  // Software & tech engineering
  /\b(?:software|backend|front[- ]?end|full[- ]?stack|devops|cloud|platform|mobile|ios|android|site\s+reliability|sre|security|cyber|network|systems|embedded|firmware|solutions|infrastructure)\s+engineer(?:ing)?\b/i,
  /\b(?:software\s+)?developer\b/i,
  /\b(?:machine\s+learning|ml\b|ai\b|nlp)\s+(?:engineer|scientist|researcher)\b/i,
  /\bquant(?:itative)?\s+(?:analyst|researcher|developer|trader)\b/i,
  // Data
  /\bdata\s+(?:scientist|analyst|engineer|architect|specialist)\b/i,
  /\b(?:business\s+intelligence|bi\s+(?:developer|analyst)|analytics\s+engineer)\b/i,
  // Healthcare
  /\bnurse(?:s|d|ry|practitioner|specialist)?\b/i,
  /\b(?:staff\s+)?(?:doctor|physician|gp\b|registrar|surgeon|anaesthetist|radiologist|cardiologist|oncologist|psychiatrist|neurologist|dermatologist|gastroenterologist|haematologist|respiratory\s+consultant)\b/i,
  /\b(?:pharmacist|physiotherapist|occupational\s+therapist|paramedic|radiographer|midwife|sonographer|optometrist|dental\s+surgeon|dentist)\b/i,
  // Finance & professional services
  /\b(?:management\s+|chartered\s+)?accountant\b/i,
  /\b(?:financial\s+(?:analyst|controller|manager)|finance\s+(?:analyst|manager))\b/i,
  /\b(?:actuar(?:y|ial)|risk\s+analyst|credit\s+analyst)\b/i,
  /\b(?:solicitor|barrister|lawyer)\b/i,
  // Engineering (non-software)
  /\b(?:structural|civil|mechanical|electrical|chemical|aerospace|petroleum|geotechnical|process)\s+engineer(?:ing)?\b/i,
  // Research
  /\bresearch\s+(?:scientist|engineer|analyst|associate|fellow)\b/i,
  /\b(?:clinical\s+)?scientist\b/i,
  // General analyst (broadly sponsored across many industries)
  /\banalyst\b/i,
]

const LOW_PATTERNS: RegExp[] = [
  // Sales & BD
  /\bsdr\b/i,
  /\bbdr\b/i,
  /\bsales\s+development\b/i,
  /\bbusiness\s+development\s+rep(?:resentative)?\b/i,
  /\baccount\s+executive\b/i,
  /\baccount\s+manager\b/i,
  /\bsales\s+(?:executive|manager|rep(?:resentative)?|director|associate|lead)\b/i,
  /\binside\s+sales\b/i,
  // Marketing & comms
  /\bmarketing\s+(?:manager|executive|coordinator|specialist|director|associate|lead)\b/i,
  /\bsocial\s+media\s+(?:manager|executive|specialist|coordinator)\b/i,
  /\b(?:content\s+(?:writer|creator|manager|strategist)|copywriter)\b/i,
  /\bbrand\s+(?:manager|executive|director)\b/i,
  /\b(?:pr\s+(?:manager|executive)|public\s+relations)\b/i,
  /\bcommunications\s+(?:manager|executive|director)\b/i,
  /\bgrowth\s+(?:manager|hacker|marketing)\b/i,
  // Operations & admin
  /\boperations\s+(?:manager|coordinator|executive|director|lead)\b/i,
  /\boffice\s+manager\b/i,
  /\bfacilities\s+(?:manager|coordinator)\b/i,
  /\b(?:executive|personal)\s+assistant\b/i,
  /\badmin(?:istrative)?\s+(?:assistant|executive|officer)\b/i,
  // HR & people
  /\b(?:hr|human\s+resources)\s+(?:manager|advisor|director|coordinator|business\s+partner)\b/i,
  /\bpeople\s+(?:partner|manager|director)\b/i,
  /\b(?:talent\s+acquisition|talent\s+partner|recruiter|headhunter|sourcer)\b/i,
  // Customer-facing
  /\bcustomer\s+(?:success|support|service|experience)\s*(?:manager|executive|specialist|rep(?:resentative)?|lead)?\b/i,
  /\bclient\s+(?:success|services|manager|executive)\b/i,
  // Business development (non-technical)
  /\bbusiness\s+development\s+(?:manager|director|executive|lead)\b/i,
  /\bpartnerships\s+(?:manager|executive|director)\b/i,
]

export function classifyRole(role: string): RoleClassification {
  const r = role.trim()

  for (const pattern of HIGH_PATTERNS) {
    if (pattern.test(r)) {
      return {
        risk: 'high',
        label: 'Commonly sponsored role',
        detail:
          'This role type is regularly sponsored on Skilled Worker visas. Candidates in this field routinely secure sponsorship from UK employers with a sponsor licence.',
      }
    }
  }

  for (const pattern of LOW_PATTERNS) {
    if (pattern.test(r)) {
      return {
        risk: 'low',
        label: 'Rarely sponsored role',
        detail:
          'This role type is infrequently sponsored on Skilled Worker visas. Sales, marketing, and operations roles are typically filled domestically and are unlikely to attract sponsorship.',
      }
    }
  }

  return {
    risk: 'neutral',
    label: 'Sponsorship varies for this role',
    detail:
      'Sponsorship likelihood for this role depends on the specific company, industry, and seniority level.',
  }
}
