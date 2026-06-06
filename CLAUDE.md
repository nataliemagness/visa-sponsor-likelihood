# Visa Sponsor Likelihood

A Next.js web app that helps job seekers assess the likelihood of UK Skilled Worker Visa sponsorship for a given role. Powered by four real data sources: the UK Home Office Register of Licensed Sponsors, Home Office historic immigration statistics, Companies House, and Adzuna job postings.

## What it does

Two core features:

1. **Role Search** — user provides a role name, seniority, and industry; app returns a ranked table of the top companies most likely to sponsor that role.
2. **Company + Role Lookup** — user provides a specific company name and job title; app returns a 0–100 likelihood score with a signal-by-signal evidence breakdown and a year-over-year sponsorship history chart.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript strict |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Turso (libSQL / edge SQLite) |
| ORM | Drizzle ORM + drizzle-kit |
| Validation | Zod |
| Fuzzy search | fuse.js (client-side company disambiguation) |
| Charts | Recharts |
| CSV parsing | csv-parse (seed scripts only) |
| XLSX parsing | xlsx (seed scripts only — Home Office immigration stats) |

---

## Project Structure

```
visa-sponsor-likelihood/
├── app/
│   ├── layout.tsx                        # Root layout
│   ├── page.tsx                          # Landing page (role search form)
│   ├── globals.css                       # Tailwind v4 @theme
│   ├── search/
│   │   └── page.tsx                      # Role search results (server component)
│   ├── company/
│   │   └── [slug]/
│   │       └── page.tsx                  # Company + role lookup page
│   └── api/
│       ├── role-search/
│       │   └── route.ts                  # GET /api/role-search
│       └── company-lookup/
│           └── route.ts                  # GET /api/company-lookup
│
├── components/
│   ├── ui/                               # shadcn/ui generated components
│   ├── search-form.tsx                   # Role search inputs (role, seniority, industry)
│   ├── company-search-input.tsx          # Debounced combobox with FTS disambiguation
│   ├── results-table.tsx                 # Ranked company table (Feature 1 output)
│   ├── score-card.tsx                    # Large score display with label badge
│   ├── evidence-panel.tsx                # Signal-by-signal breakdown list
│   └── sponsor-history-chart.tsx         # Recharts bar chart (year × sponsored count)
│
├── lib/
│   ├── db/
│   │   ├── client.ts                     # Turso libSQL client singleton
│   │   ├── schema.ts                     # Drizzle schema — single source of truth
│   │   └── queries/
│   │       ├── role-search.ts            # SQL: top sponsors for role/industry
│   │       └── company-lookup.ts         # SQL: scoring inputs for one company
│   ├── scoring/
│   │   ├── score.ts                      # computeScore() — main entry point
│   │   ├── weights.ts                    # WEIGHTS constants
│   │   └── normalise.ts                  # Signal normalisation helpers
│   └── utils.ts                          # slugify, formatPercent, cn()
│
├── scripts/
│   ├── seed-uk.ts                        # Ingest Home Office Register CSV
│   ├── seed-historic-visa.ts             # Ingest Home Office immigration statistics (xlsx)
│   ├── seed-companies-house.ts           # Enrich companies with CH employee/status data
│   ├── seed-adzuna.ts                    # Fetch active job posting counts (top 200 companies)
│   ├── seed-company-meta.ts              # Size tier + industry enrichment (uses CH data)
│   └── data/
│       ├── company-size-overrides.json   # Manual size_tier for ~500 major sponsors
│       └── soc-to-category.ts            # SOC code → role_category mapping dictionary
│
├── types/
│   ├── api.ts                            # API request/response types
│   └── scoring.ts                        # ScoringInput, ScoringResult
│
├── drizzle.config.ts
└── .env.local                            # TURSO_URL, TURSO_AUTH_TOKEN
```

---

## Database Schema

Defined in `lib/db/schema.ts`. Four tables.

### `companies`
One row per organisation. `slug` is the URL-safe identifier derived from the company name.

```ts
id                     integer   PK autoincrement
slug                   text      UNIQUE NOT NULL
name                   text      NOT NULL
city                   text
county                 text
size_tier              text      -- 'startup' | 'smb' | 'mid-market' | 'enterprise' | 'mega-corp'
industry               text      -- normalised industry label (from SIC codes via Companies House)
is_active_uk           integer   DEFAULT 0   -- 1 = currently on Home Office register
uk_rating              text      -- 'A-rated' | 'B-rated' | null
routes                 text      -- JSON array: ["Skilled Worker", "Health and Care Worker"]
companies_house_number text      -- e.g. '01234567' — definitive CH identifier
sic_codes              text      -- JSON array of SIC codes e.g. ['62012', '62020']
employee_count         integer   -- from latest Companies House accounts/confirmation statement
incorporation_date     integer   -- unix timestamp
company_status         text      -- 'active' | 'dissolved' | 'liquidation' | 'dormant'
ch_updated_at          integer
created_at             integer
updated_at             integer
```

### `sponsorship_records`
Annual volume counts per company. For UK, total_sponsored is a proxy derived from job posting signals (the Home Office register does not publish annual counts directly).

```ts
id               integer   PK
company_id       integer   FK -> companies.id
fiscal_year      integer
total_sponsored  integer   DEFAULT 0
UNIQUE(company_id, fiscal_year)
```

### `role_sponsorships`
Company × normalised role category × year. Populated from DOL LCA-equivalent analysis and job title parsing.

```ts
id             integer   PK
company_id     integer   FK -> companies.id
role_category  text      -- e.g. 'software_engineer', 'data_scientist'
seniority_hint text      -- 'senior' | 'lead' | null
fiscal_year    integer
petition_count integer   DEFAULT 0
UNIQUE(company_id, role_category, fiscal_year)
```

### `industry_benchmarks`
Pre-aggregated statistics, recomputed at the end of each seed run from `historic_visa_stats`. Used to normalise the volume signal against the industry.

```ts
id                    integer   PK
industry              text
role_category         text
fiscal_year           integer
avg_sponsorships      real
median_approval_rate  real
p90_sponsorships      real      -- 90th percentile threshold for S1 normalisation
UNIQUE(industry, role_category, fiscal_year)
```

### `historic_visa_stats`
Real annual/quarterly CoS and visa grant counts from Home Office immigration statistics. Aggregated by industry sector and SOC code (not per-employer). Powers `industry_benchmarks`.

```ts
id              integer   PK
year            integer
quarter         integer   -- 1–4, or NULL for annual totals
soc_code        text      -- e.g. '2135' (IT business analysts)
soc_title       text
role_category   text      -- normalised, mapped via scripts/data/soc-to-category.ts
industry_sector text      -- e.g. 'Information and communication'
total_cos       integer   -- Certificates of Sponsorship assigned
total_granted   integer   -- visas actually granted
UNIQUE(year, quarter, soc_code)
```

### `job_posting_signals`
Cached Adzuna job posting counts per company. TTL: 24 hours. Used for S6 (Active Postings) signal.

```ts
id                       integer   PK
company_id               integer   FK -> companies.id
active_sponsorship_count integer   -- Adzuna total_results for sponsored roles
snapshot_date            integer   -- unix timestamp when fetched
expires_at               integer   -- snapshot_date + 86400
```

### `api_quota`
Tracks monthly Adzuna API call count to stay within free tier (250/month).

```ts
id          integer   PK
service     text      -- 'adzuna'
month       text      -- 'YYYY-MM'
call_count  integer   DEFAULT 0
UNIQUE(service, month)
```

**Indexes:**
```sql
CREATE INDEX idx_companies_industry ON companies(industry);
CREATE INDEX idx_sr_company_year    ON sponsorship_records(company_id, fiscal_year);
CREATE INDEX idx_rs_role_year       ON role_sponsorships(role_category, fiscal_year);
CREATE VIRTUAL TABLE companies_fts USING fts5(name, content='companies', content_rowid='id');
```

---

## Likelihood Scoring Algorithm

Implemented in `lib/scoring/score.ts`. The score is a weighted sum of five normalised signals, clamped to `[0, 100]`. All signals are normalised to `[0, 1]` before weighting.

### Signals

**S1 — Sponsorship Volume (weight: 0.35)**
How many workers has this company sponsored relative to the industry's top decile?

```
raw_volume = sum(total_sponsored) for last 3 fiscal years
S1 = clamp(raw_volume / industry_benchmarks.p90_sponsorships, 0, 1)
```

**S2 — Register Status (weight: 0.25)**
UK-specific: is the company currently on the Home Office register, and what rating?

```
S2 = 0.9   if is_active_uk = 1 AND uk_rating = 'A-rated'
   = 0.5   if is_active_uk = 1 AND uk_rating = 'B-rated'
   = 0.0   if is_active_uk = 0
```

**S3 — Role Match (weight: 0.20)**
Does the company have a history of sponsoring this specific role category?

```
role_volume = sum(petition_count) for (company, role_category, last 3 years)

S3 = 0                                            if role_volume = 0
   = 0.5 + 0.5 * clamp(role_volume / 10, 0, 1)  if role_volume > 0
```

The `0.5` floor ensures any prior role-match is meaningfully positive. 10+ role-specific petitions yields the maximum signal.

**S4 — Company Size Tier (weight: 0.12)**

Derived from `companies.employee_count` (Companies House) when available, otherwise falls back to volume heuristic:

```
employee_count < 10    → startup      → 0.30
10–49                  → smb          → 0.45
50–249                 → mid-market   → 0.65
250–999                → enterprise   → 0.85
1000+                  → mega-corp    → 1.00
unknown                              → 0.50
```

**S5 — Recency (weight: 0.05)**
Was the company actively sponsoring in recent years?

```
gap = current_year - most_recent_year_with_sponsorships

S5 = 1.0   if gap = 0
   = 0.8   if gap = 1
   = 0.5   if gap = 2
   = 0.2   if gap > 2
   = 0.0   if no history
```

**S6 — Active Job Postings (weight: 0.10)**

Is the company actively posting sponsored roles right now? Sourced from Adzuna. Gracefully degrades to 0 if no data is available (quota exhausted or company not yet cached).

```
count = job_posting_signals.active_sponsorship_count (if not expired)

S6 = 0                               if no data
   = clamp(count / 5, 0, 1)         if data available
```

5+ active sponsored job postings = maximum signal.

### Final Score

```ts
// lib/scoring/weights.ts
export const WEIGHTS = {
  volume:         0.30,   // was 0.35 — reduced to accommodate S6
  registerStatus: 0.25,
  roleMatch:      0.18,   // was 0.20
  sizeTier:       0.12,
  recency:        0.05,   // was 0.08 — partially replaced by S6
  activePostings: 0.10,   // new — Adzuna signal
} as const;

// lib/scoring/score.ts
const raw = WEIGHTS.volume         * S1
          + WEIGHTS.registerStatus * S2
          + WEIGHTS.roleMatch      * S3
          + WEIGHTS.sizeTier       * S4
          + WEIGHTS.recency        * S5
          + WEIGHTS.activePostings * S6;

const score = Math.round(clamp(raw * 100, 0, 100));
```

### Score Labels

| Range | Label | UI colour |
|---|---|---|
| 80–100 | Very Likely | green |
| 55–79 | Likely | teal |
| 30–54 | Possible | amber |
| 0–29 | Unlikely | red |

### Hard Overrides

| Condition | Score cap | Badge shown |
|---|---|---|
| `is_active_uk = 0` | 15 | "Not currently licensed — would need a fresh sponsor licence" |
| `company_status = 'dissolved'` or `'liquidation'` | 0 | "Company is dissolved — cannot sponsor" |

---

## API

Both endpoints are Next.js Route Handlers. All query parameters are validated with Zod. Responses follow a shared envelope:

```ts
// types/api.ts
type ApiResponse<T> =
  | { success: true;  data: T;      cachedAt: string }
  | { success: false; error: string; code: string }
```

---

### Feature 1: Role Search

**`GET /api/role-search`**

Returns the top N companies ranked by likelihood score for the given role.

**Query params:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `role` | string | yes | Free text, e.g. `"Software Engineer"` |
| `seniority` | `junior \| mid \| senior \| lead` | no | Filters role_sponsorships by seniority_hint |
| `industry` | string | no | Filters companies by industry |
| `limit` | number (1–50) | no | Default 20 |

**Processing:**
1. Map `role` free text → `role_category` via a static dictionary (see `lib/scoring/role-map.ts`). Fall back to FTS5 search on `role_sponsorships.role_category` if no direct match.
2. Query `companies` joined to `role_sponsorships` and `sponsorship_records` for the matching role category.
3. Call `computeScore()` for each candidate.
4. Sort descending by score, return top `limit`.

**Response:**

```ts
type RoleSearchResult = {
  companies: Array<{
    id: number
    slug: string
    name: string
    city: string
    industry: string
    sizeTier: string
    score: number
    scoreLabel: string
    isActiveSponsor: boolean
    totalSponsored3yr: number
  }>
  meta: {
    roleCategory: string
    totalCandidates: number
    cachedAt: string
  }
}
```

---

### Feature 2: Company + Role Lookup

**`GET /api/company-lookup`**

Returns a full likelihood score and evidence breakdown for a specific company and role.

**Query params:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `company` | string | yes | Fuzzy-matched against companies_fts |
| `role` | string | yes | Mapped to role_category as above |
| `seniority` | `junior \| mid \| senior \| lead` | no | |

**Processing:**
1. FTS5 `MATCH` query on `companies_fts` to find the best company match. Return top 3 candidates in `alternativeMatches` so the UI can show a disambiguation banner.
2. Retrieve all scoring inputs for the best match.
3. Call `computeScore()`.
4. Fetch `industry_benchmarks` for the same industry/role for percentile context.
5. Fetch year-by-year `sponsorship_records` for the chart.

**Response:**

```ts
type CompanyLookupResult = {
  company: {
    id: number
    slug: string
    name: string
    city: string
    county: string
    industry: string
    sizeTier: string
    isActiveSponsor: boolean
    ukRating: string | null
    routes: string[]
  }
  score: number
  scoreLabel: string
  signals: {
    volume:         { rawValue: number; normalisedScore: number; weight: number; explanation: string }
    registerStatus: { rawValue: string; normalisedScore: number; weight: number; explanation: string }
    roleMatch:      { rawValue: number; normalisedScore: number; weight: number; explanation: string }
    sizeTier:       { rawValue: string; normalisedScore: number; weight: number; explanation: string }
    recency:        { rawValue: number; normalisedScore: number; weight: number; explanation: string }
  }
  history: Array<{ year: number; totalSponsored: number }>
  industryComparison: {
    industryAvgScore: number
    percentile: number
  }
  alternativeMatches: Array<{ id: number; name: string; slug: string }>
}
```

---

## Key Components

**`SearchForm`** (`components/search-form.tsx`)
Client component. Three inputs: role (text), seniority (Select), industry (Select). On submit, navigates to `/search?role=...&seniority=...&industry=...`.

**`CompanySearchInput`** (`components/company-search-input.tsx`)
shadcn `Command` combobox. Calls `/api/company-lookup?company=...` debounced at 300ms. Shows top FTS5 matches as suggestions.

**`ResultsTable`** (`components/results-table.tsx`)
Server component. Renders a shadcn `Table` with columns: Rank, Company (link to `/company/[slug]`), Industry, Location, 3yr Volume, Score (Progress bar + label Badge). Client-side sort by score column.

**`ScoreCard`** (`components/score-card.tsx`)
Large score display (`74 / 100 — Likely`). Arc or circular progress. Coloured label Badge. Below the score: "X companies in this industry average Y%."

**`EvidencePanel`** (`components/evidence-panel.tsx`)
Five-row breakdown. Each row: signal name, weighted points contribution (e.g. "Register Status: 22.5 / 25 pts"), mini progress bar, plain-English explanation sentence. shadcn `Tooltip` explains the methodology for each signal.

**`SponsorHistoryChart`** (`components/sponsor-history-chart.tsx`)
Recharts `BarChart`. X-axis: fiscal year. Y-axis: total_sponsored. Falls back to a plain table if Recharts is tree-shaken out.

---

## Data Seeding

### `scripts/seed-uk.ts`

**Source:** UK Home Office Register of Licensed Sponsors (Workers)
- Landing page: `https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers`
- The script fetches the page HTML, extracts the current CSV download URL via regex, then downloads the CSV.

**CSV columns used:**
- `Organisation Name` → `companies.name`
- `Town/City` → `companies.city`
- `County` → `companies.county`
- `Type & Rating` → `companies.uk_rating` (e.g. "Worker — A-rated" → "A-rated")
- `Route` → `companies.routes` (JSON array)

**Steps:**
1. Parse CSV with `csv-parse`.
2. Filter to rows where `Route` includes "Skilled Worker" (also retain other routes on the same org as additional entries in the `routes` array).
3. For each org: `slugify(name)`, derive `uk_rating` and `routes[]`.
4. UPSERT into `companies` on `slug`: set `is_active_uk = 1`, update fields, set `updated_at`.
5. After all upserts: `UPDATE companies SET is_active_uk = 0 WHERE updated_at < :runStartTime` — marks orgs that disappeared from the register as inactive.
6. Rebuild FTS5: `INSERT INTO companies_fts(companies_fts) VALUES('rebuild')`.
7. Recompute `industry_benchmarks` via a single aggregate SQL query.

### `scripts/seed-historic-visa.ts`

**Source:** Home Office Immigration Statistics — "Work" series xlsx files
- Landing page: `https://www.gov.uk/government/statistical-data-sets/immigration-statistics-data-tables-entry-clearance`
- Relevant files: `visa_work_06` (CoS assigned by route, sector, SOC code per year/quarter)

**Steps:**
1. Fetch the landing page HTML, extract xlsx download URLs via regex
2. Parse xlsx files with the `xlsx` npm package
3. Filter to Skilled Worker route rows only
4. Map SOC codes → `role_category` using the dictionary in `scripts/data/soc-to-category.ts`
5. Upsert into `historic_visa_stats`
6. Recompute `industry_benchmarks` from this real data (single aggregate SQL query)

### `scripts/seed-companies-house.ts`

**Source:** Companies House API — `https://developer.company-information.service.gov.uk/`
- Free API key required (register at developer.company-information.service.gov.uk)
- Rate limit: 600 requests per 5 minutes — batch in groups of 100 with a 10s pause between batches

**Steps:**
1. For each company in our DB without a `companies_house_number`:
   - `GET /search/companies?q={name}&items_per_page=3`
   - Score the top 3 candidates by name similarity + city match; pick if score ≥ 0.7
   - `GET /company/{number}` for status, SIC codes, incorporation date
   - Extract `employee_count` from the latest confirmation statement if present
2. Upsert enriched fields into `companies`
3. Write unmatched companies (score < 0.7) to `scripts/data/ch-unmatched.log` for manual review

### `scripts/seed-adzuna.ts`

**Source:** Adzuna Jobs API — `https://api.adzuna.com/v1/api/jobs/gb/search`
- Free tier: 250 calls/month — only runs against the top 200 companies by sponsorship volume

**Query:** `?what=visa+sponsorship+skilled+worker&employer={name}&where=uk&results_per_page=1`
Uses `total_results` from the response (no need to page through listings).

**Steps:**
1. Select top 200 companies ordered by `sponsorship_records.total_sponsored DESC`
2. For each, call Adzuna and store result in `job_posting_signals` (expires_at = now + 30 days for seeded data)
3. Increment `api_quota` counter for the current month

### `scripts/seed-company-meta.ts`

**Steps:**
1. Apply manual overrides from `scripts/data/company-size-overrides.json` for ~500 well-known sponsors
2. For companies with `employee_count` from Companies House: derive `size_tier` from the employee count bands (overrides the volume heuristic)
3. For remaining companies with no CH data: fall back to volume heuristic (≥1000 → `mega-corp`, etc.)
4. Set `industry` from SIC codes where not already set (SIC 62xxx → 'tech', SIC 86xxx → 'healthcare', etc.)

### Commands

```bash
npm run seed:uk          # Home Office register CSV → companies table
npm run seed:historic    # Home Office immigration stats xlsx → historic_visa_stats + industry_benchmarks
npm run seed:ch          # Companies House API → enrich companies (employee_count, status, SIC codes)
npm run seed:adzuna      # Adzuna API → job_posting_signals for top 200 companies
npm run seed:meta        # size_tier + industry inference (uses CH data as primary source)
npm run seed:all         # all of the above in sequence
```

Run `seed:all` before first deploy. Recommended refresh schedule:
- `seed:uk` — monthly (Home Office updates the register ~monthly)
- `seed:historic` — quarterly (immigration statistics published quarterly)
- `seed:ch` — monthly (company status/size can change)
- `seed:adzuna` — monthly (stays within 250-call free tier)

---

## Environment Variables

```bash
# .env.local
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token-here

COMPANIES_HOUSE_API_KEY=your-key-here   # free — register at developer.company-information.service.gov.uk
ADZUNA_APP_ID=your-app-id               # free — register at developer.adzuna.com
ADZUNA_APP_KEY=your-app-key
```

For local development, create a local Turso database with `turso db create visa-sponsor-likelihood` and get credentials with `turso db tokens create visa-sponsor-likelihood`.

---

## Dev Commands

```bash
npm run dev           # Next.js dev server at http://localhost:3000
npm run build         # Production build
npm run seed:all      # Seed database from live Home Office data
npm run db:generate   # Generate Drizzle migration files from schema changes
npm run db:migrate    # Apply pending migrations
npm run db:studio     # Open Drizzle Studio (visual DB browser)
```

---

## Initial Setup

```bash
npx create-next-app@latest visa-sponsor-likelihood --typescript --tailwind --app --src-dir=false
cd visa-sponsor-likelihood
npx shadcn@latest init
npm install drizzle-orm @libsql/client drizzle-kit zod csv-parse xlsx fuse.js recharts
npm install -D tsx
npm run db:generate
npm run db:migrate
npm run seed:all
npm run dev
```

---

## Verification

After `npm run seed:all` and `npm run dev`:

1. **Role Search** — search "Software Engineer" with industry "tech". Expect a ranked table with major tech consultancies (Tata, Infosys, Cognizant, Capgemini) near the top.
2. **Company Lookup — high score** — look up "Tata Consultancy Services" + "Software Engineer". Expect score ≥ 85 with all signals green.
3. **Company Lookup — not licensed** — look up a small company not on the register. Expect score ≤ 15 and the "Not currently licensed" badge visible.
4. **Disambiguation** — type a partial/misspelled company name in the combobox. Expect FTS5 suggestions to appear within 300ms.
5. **Build** — `npm run build` should complete with zero TypeScript errors.
6. **Historic data** — open Drizzle Studio (`npm run db:studio`), confirm `historic_visa_stats` has rows across multiple years and `industry_benchmarks` has non-zero `p90_sponsorships` values.
7. **Companies House** — look up "Tata Consultancy Services": expect `employee_count > 1000`, `company_status = 'active'`, `sic_codes` non-empty.
8. **Dissolved company gate** — look up a dissolved company: expect score = 0 and "Company is dissolved" badge.
9. **Adzuna S6 signal** — look up a large active tech employer: expect `active_sponsorship_count > 0` in the evidence panel.
10. **Adzuna quota guard** — temporarily set `ADZUNA_APP_KEY` to an invalid value: expect the score to still return (S6 = 0 gracefully), no crash or 500 error.

---

## Scoring Calibration Notes

The weights in `lib/scoring/weights.ts` were chosen based on the relative predictive power of each signal for the UK context:

- **S2 (Register Status) is the hardest gate** — a company not on the register cannot sponsor at all, hence capping to 15.
- **S1 (Volume)** is the primary differentiator between licensed sponsors — a company with 5,000 annual sponsorships is categorically different from one with 3. Now powered by real `historic_visa_stats` data.
- **S3 (Role Match)** matters most for niche roles — a company that only sponsors healthcare workers is unlikely to sponsor a software engineer even if they're large.
- **S6 (Active Postings)** is the strongest recency signal — a company posting sponsored roles right now is qualitatively different from one that last appeared on the register 2 years ago.
- **Companies House status** is a pre-score hard gate — a dissolved company gets 0 before any signals are computed.

To retune weights: edit `WEIGHTS` in `lib/scoring/weights.ts`, run `npm run build`, then verify the calibration examples in the Verification section above still produce sensible scores.
