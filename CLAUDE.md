# Visa Sponsor Likelihood

A Next.js web app that helps job seekers assess the likelihood of UK Skilled Worker Visa sponsorship for a given role. Powered by the UK Home Office Register of Licensed Sponsors.

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
│   ├── seed-company-meta.ts              # Size tier + industry enrichment
│   └── data/
│       └── company-size-overrides.json   # Manual size_tier for ~500 major sponsors
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
id            integer   PK autoincrement
slug          text      UNIQUE NOT NULL
name          text      NOT NULL
city          text
county        text
size_tier     text      -- 'startup' | 'smb' | 'mid-market' | 'enterprise' | 'mega-corp'
industry      text      -- normalised industry label
is_active_uk  integer   DEFAULT 0   -- 1 = currently on Home Office register
uk_rating     text      -- 'A-rated' | 'B-rated' | null
routes        text      -- JSON array: ["Skilled Worker", "Health and Care Worker"]
created_at    integer
updated_at    integer
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
Pre-aggregated statistics, recomputed at the end of each seed run. Used to normalise the volume signal against the industry.

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

```
startup      → 0.30
smb          → 0.45
mid-market   → 0.65
enterprise   → 0.85
mega-corp    → 1.00
unknown      → 0.50
```

**S5 — Recency (weight: 0.08)**
Was the company actively sponsoring in recent years?

```
gap = current_year - most_recent_year_with_sponsorships

S5 = 1.0   if gap = 0
   = 0.8   if gap = 1
   = 0.5   if gap = 2
   = 0.2   if gap > 2
   = 0.0   if no history
```

### Final Score

```ts
// lib/scoring/weights.ts
export const WEIGHTS = {
  volume:         0.35,
  registerStatus: 0.25,
  roleMatch:      0.20,
  sizeTier:       0.12,
  recency:        0.08,
} as const;

// lib/scoring/score.ts
const raw = WEIGHTS.volume         * S1
          + WEIGHTS.registerStatus * S2
          + WEIGHTS.roleMatch      * S3
          + WEIGHTS.sizeTier       * S4
          + WEIGHTS.recency        * S5;

const score = Math.round(clamp(raw * 100, 0, 100));
```

### Score Labels

| Range | Label | UI colour |
|---|---|---|
| 80–100 | Very Likely | green |
| 55–79 | Likely | teal |
| 30–54 | Possible | amber |
| 0–29 | Unlikely | red |

### Hard Override

If `is_active_uk = 0`, cap score at `15` regardless of other signals and display a prominent badge: **"Not currently licensed — company would need a fresh sponsor licence application."**

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

### `scripts/seed-company-meta.ts`

**Steps:**
1. Apply manual overrides from `scripts/data/company-size-overrides.json` (slug → size_tier mapping for ~500 major sponsors like NHS trusts, banks, tech giants).
2. For remaining companies with no override: classify size_tier from `total_sponsored` volume heuristic:
   - ≥1000 → `mega-corp`, 200–999 → `enterprise`, 50–199 → `mid-market`, 10–49 → `smb`, <10 → `startup`
3. Infer `industry` from `routes` array + company name keyword matching where not already set.

### Commands

```bash
npm run seed:uk      # fetch + parse Home Office CSV, upsert companies
npm run seed:meta    # enrich size_tier and industry
npm run seed:all     # seed:uk && seed:meta
```

Run `seed:all` before first deploy, then again whenever new data is published (the Home Office updates the register roughly monthly).

---

## Environment Variables

```bash
# .env.local
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token-here
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
npm install drizzle-orm @libsql/client drizzle-kit zod csv-parse fuse.js recharts
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

---

## Scoring Calibration Notes

The weights in `lib/scoring/weights.ts` were chosen based on the relative predictive power of each signal for the UK context:

- **S2 (Register Status) is the hardest gate** — a company not on the register cannot sponsor at all, hence capping to 15.
- **S1 (Volume)** is the primary differentiator between licensed sponsors — a company with 5,000 annual sponsorships is categorically different from one with 3.
- **S3 (Role Match)** matters most for niche roles — a company that only sponsors healthcare workers is unlikely to sponsor a software engineer even if they're large.

To retune weights: edit `WEIGHTS` in `lib/scoring/weights.ts`, run `npm run build`, then verify the calibration examples in the Verification section above still produce sensible scores.
