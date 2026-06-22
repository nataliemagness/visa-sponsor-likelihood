import type { BusinessModel } from './company-classifier'

export type IndustryFilterOption = {
  value: string
  label: string
}

export const INDUSTRY_FILTER_OPTIONS: IndustryFilterOption[] = [
  { value: 'tech',          label: 'Technology'     },
  { value: 'finance',       label: 'Finance'        },
  { value: 'healthcare',    label: 'Healthcare'     },
  { value: 'legal',         label: 'Legal'          },
  { value: 'professional',  label: 'Professional'   },
  { value: 'biotech',       label: 'Biotech'        },
  { value: 'manufacturing', label: 'Manufacturing'  },
  { value: 'hospitality',   label: 'Hospitality'    },
  { value: 'retail',        label: 'Retail'         },
]

// Maps filter option values to BusinessModel array for filtering
export const INDUSTRY_BM_MAP: Record<string, BusinessModel[]> = {
  tech:          ['tech'],
  finance:       ['finance'],
  healthcare:    ['healthcare'],
  legal:         ['legal'],
  professional:  ['professional'],
  biotech:       ['biotech'],
  manufacturing: ['manufacturing'],
  hospitality:   ['hospitality'],
  retail:        ['retail'],
}
