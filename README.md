# Lead Intelligence + CRM + Outreach Workspace (private)

A private, personal-use Lead Intelligence + CRM + Business Development Workspace. Not a public product — replaces spreadsheets and scattered notes with one place to discover, qualify, contact, and track leads through to won/lost.

Free/public sources are used by default; paid connectors (Apollo, Hunter, Web3.career, twitterapi.io) are opt-in via API keys and self-disable when unset. See `MEMORY.md`-tracked context in Claude's memory for the business context behind this.

## Stack

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel.
- **Backend**: Supabase (Postgres + Auth + Row Level Security).
- **Discovery pipeline**: a separate `workers/` package (not run inside Vercel serverless functions — scraping is too slow/long-running for that) triggered locally or via GitHub Actions cron, writing into the same Supabase Postgres database the dashboard reads from.

## One-time setup

1. **Supabase**: create a free project at supabase.com.
2. Install the Supabase CLI (`npm i -g supabase` or via your package manager), then from the repo root:
   ```
   supabase link --project-ref <your-project-ref>
   npm run db:push
   ```
   This applies every file in `supabase/migrations/`: `0001_init.sql` (companies, contacts, leads, signals, evidence, scoring, activities, outreach, tasks, notes, saved searches, provider/AI settings, notifications — see that file for the full schema and RLS policies) and `0002_lead_sort_ranks.sql` (generated rank columns so the leads table can sort tier/status/priority/verification/freshness in a meaningful order instead of alphabetically). Re-run `npm run db:push` after pulling changes — until `0002` is applied, sorting the leads table by those five columns errors; sorting by score, dates and text still works.
3. Copy `.env.example` to `.env.local` (for `apps/web`) and to `.env` (for `workers`, or export the same vars in your shell/CI), and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` — used server-side (Next.js route handlers, and the `workers` pipeline) to bypass RLS. Never exposed to the browser, never committed.
4. Install dependencies: `npm install` (run once at the repo root — npm workspaces installs everything).
5. **Create your user**: this app has public signup disabled (it's private, single-user). In the Supabase dashboard, go to Authentication → Users → "Add user" and create yourself an email/password account. Sign in with those credentials at `/login`.
6. Import your existing hand-built CSV to seed the database:
   ```
   npm run import:legacy -- "legacy-leads/Global_Real-Time_High-Quality_Leads_2026-08-29 - START HERE.csv" hiring
   ```
7. Sanity-check the round trip:
   ```
   npm run export:csv -- hiring check-export.csv
   ```
   Compare `check-export.csv` against the original — this is what proves the schema didn't lose anything.

Note: this legacy-CSV importer (`workers/import-export/`) is a one-time migration tool matched to that exact report layout. The in-app **Import** page (`/import`) is a separate, general-purpose CSV import wizard for any future CSV you want to bring in — see "Importing a CSV" below.

## Running the dashboard locally

```
npm run dev:web
```
Open http://localhost:3000 — sign in with the Supabase user you created above.

## Adding companies to monitor (vertical 1 — hiring signals)

The Greenhouse/Lever/Ashby connectors only check companies you list — there's no generic "search all job boards" API. Add board tokens/slugs to:
- `config/target-companies/greenhouse.json`
- `config/target-companies/lever.json`
- `config/target-companies/ashby.json`

(Find a company's token from its careers page URL, e.g. `jobs.lever.co/{token}`.)

CryptoJobsList works with no config (public RSS). Web3.career and the Twitter connector need their own API keys (see below) — everything else runs free.

## Running the pipeline locally

```
npm run run:vertical1
```

## Vertical 3 — Bitget Card affiliate leads (ad/media-buying agencies)

There's no free "discover all ad agencies" API — Clutch and DesignRush have no public API (only paid third-party scrapers, which aren't wired up here), Meta's free Ad Library API only covers political/social/housing/credit ads (not general commercial ad spend), and Google's Custom Search API is closed to new signups. So this vertical works as **seed + enrich**, not discovery: add candidate agencies you already know about (from manual research, referrals, roundup articles you read yourself) to `config/target-companies/agencies.json` as `{ name, website, twitterHandle }`. The pipeline then visits each agency's own public pages (home/about/case-studies/work/clients) looking for disclosed ad-spend figures, channel breadth (Meta/Google/TikTok), prior Web3/crypto client work, and team size, plus an optional Twitter self-description search. Run with:

```
npm run run:vertical3
```

## Vertical 2 — General B2B/B2C

Driven by the `search_configs` table (or `config/search-configs/vertical2.json` as a fallback when that table has no enabled rows) rather than a fixed pipeline — add keyword/industry/geography configs there to reshape what this vertical looks for. Currently has one connector: Hacker News (free, no key, via the public Algolia search API) — matches "Show HN"/"Launch HN" posts (brand-new companies) and hiring-keyword posts within the last 30 days. Run with:

```
npm run run:vertical2
```

## Optional paid connectors

- **Web3.career**: request a free API token at web3.career/web3-jobs-api, set `WEB3_CAREER_API_TOKEN`.
- **Twitter hiring/agency-signal search**: needs a twitterapi.io key (paid, third-party), set `TWITTERAPI_IO_KEY`. Without it, these connectors silently skip themselves.

## Contact enrichment (Hunter / Prospeo / Apollo — optional, paid)

Discovery connectors find companies with a signal; they rarely find a named person. `enrich-contacts` backfills a contact for any lead whose company has a website but no contact yet:

```
npm run enrich:contacts          # all verticals
npm run enrich:contacts hiring   # one vertical only
```

Providers run cheapest-first and stop at the first hit:

- **Hunter** (`HUNTER_API_KEY`) runs first — cheaper, and its free tier gives a small number of domain searches per month. Only emails Hunter's own verification marked `valid` are kept, and only if the person's title looks like a decision-maker (marketing/community/growth/founder/BD).
- **Prospeo** (`PROSPEO_API_KEY`) runs next, only if Hunter found nothing — a domain search with the same two filters applied: Prospeo's own `VALID` email status (its `ACCEPT_ALL`/`UNKNOWN` results are guesses and are discarded) and a decision-maker-looking title. A 402 (out of credits) or 404 (no data for the domain) is treated as "found nothing", not as a pipeline failure.
- **Apollo** (`APOLLO_API_KEY`) runs last, only if the other two found nothing — it searches Apollo's database for a matching title at the domain, then spends one "reveal" credit on the single best match.
- All three are commercial data aggregators, not the agency's own published contact page — a different tier of "public" than eyeballing a company's About page yourself.
- After enrichment, the lead is automatically rescored (every vertical's rules give points for "named contact found") and a new `lead_scores` row is written with the breakdown.

Toggle which providers are active, and see which have keys configured in the environment, at `/integrations` in the dashboard.

## Deploying

- **Vercel**: import `apps/web` as the project root (set "Root Directory" to `apps/web` in Vercel project settings), add the Supabase + optional-provider env vars in Vercel's dashboard.
- **GitHub Actions** (the scraping worker): push this repo to a GitHub repo, then add repo secrets (Settings → Secrets and variables → Actions): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WEB3_CAREER_API_TOKEN`, `TWITTERAPI_IO_KEY`. The `vertical1-hiring.yml` workflow runs daily and can also be triggered manually from the Actions tab.
- Scheduled workflows auto-disable after 60 days with no repo activity — any commit or manual run resets that clock.

## Adding a new vertical or source

Implement the `SourceConnector` interface in `packages/core/types.ts`, drop the file in `workers/connectors/`, add a scoring rule set in `workers/scoring/rules/`, and register the connector in a `workers/pipeline/run-vertical*.ts` file.

## Working the leads table

`/leads` is the main working surface, and every part of its state lives in the URL, so a filtered, sorted, paged view stays a link you can bookmark or share.

- **Sorting** — click a column header. Score and the two date columns start newest/highest first; the rest start best-first. Tier, status, priority, verification and freshness sort by the generated rank columns from migration `0002`, so "best first" means A+ before A and `fresh` before `stale`, not alphabetical order. Company, contact and country aren't sortable: they live on an embedded table, and PostgREST can't order a parent row by an embedded resource's column.
- **Paging** — 25/50/100/200 rows at a time, with the true total from the database rather than a capped read. Every sort carries a tie-break on `id`, so a row can't appear on two pages or on none as you page through.
- **Quick filters** — a title search plus status/tier/vertical selects, alongside (not instead of) the structured filters an interpreted saved search brings in.
- **Columns** — pick which of the 16 columns to show; the layout is saved per browser. Four are hidden by default (lead title, vertical, priority, created date).
- **Bulk edits** — select rows and set status, tier, priority, verification, or a follow-up date on all of them at once. Each change writes a row per lead into the activity timeline, so a bulk edit stays auditable afterwards, and marking leads verified stamps their evidence the same way the single-lead control does. Deliberately narrower than the single-lead form: `title` is half of the `(company_id, title)` unique index, and `score` belongs to the scorer, so neither can be set in bulk.

## Importing a CSV

`/import` is a four-step wizard — upload, map columns, dry run, import — and **nothing is written to the database until the last step**.

1. **Upload** (up to 1000 rows; bigger files belong in the CLI importer). Headers are read and matched against known synonyms.
2. **Map columns** — every mappable field gets a select listing the file's actual headers, with a sample value from the first rows so you can see what a column holds before committing to it. The auto-detected mapping is a starting point you can override completely, including setting a field to "not in this file". Fields cover the company, contact (name, title, email, profile), lead (tier, score, status, signal, service, vertical) and an evidence URL. Options here set the vertical and status used for rows that don't carry one, whether to skip leads already on file, and whether to match companies by name when a row has no website.
3. **Dry run** — reads the database and reports exactly what would happen: how many leads/companies/contacts/evidence rows would be created, which companies already exist (matched on domain), which rows would be skipped and why, and which columns aren't mapped to anything. Row-level notes call out coerced values (an unknown tier, a score outside 0–100) rather than silently fixing them.
4. **Import** — walks the same plan the dry run showed you. A row that fails part-way is reported and the run continues.

Two things worth knowing about how rows are matched:

- `companies.domain` is the dedupe key. Rows in one file that repeat a company always share a single company record — by domain when there is one, otherwise by name, since a repeated name inside a single file is one company. Matching against companies *already in the database* by name is off by default, because two unrelated companies can share a name.
- A lead is "already on file" when the company already has a lead with the same generated title, which is built from the company name plus the buying signal. That's what makes re-importing an updated export safe by default.

Columns you don't map aren't lost: the untouched CSV row is stored on each lead's `vertical_data`.

## Natural-language lead search

`/discovery` and `/saved-searches` take a plain-English query ("crypto projects in Southeast Asia hiring community managers, exclude unpaid internships") and interpret it into **structured filters** — keywords, roles, industries, countries, regions, company sizes, signal types, services, tiers, statuses, freshness, a minimum score and a vertical. Every one of those maps to a real column, so an interpreted search can actually be run.

The flow is deliberately two-step: **interpret → review → save**. The parsed filters appear as editable fields before anything is stored, because a filter you didn't ask for silently hides leads.

- With an AI provider configured for the `search_interpretation` use case, interpretation is done by that model (prompt in `apps/web/lib/ai/search-interpret.ts`, constrained to only fill fields the query implies).
- With no provider configured, the endpoint falls back to deterministic keyword parsing — quoted phrases, `-excluded` terms, an explicit tier, an explicit freshness word, a numeric score threshold — and labels the result **"Keyword fallback"** rather than passing it off as an interpretation. It does not guess at geography or industry.

Each saved search then supports:

- **Run** — applies its filters to the leads already in the database, logs the run to `search_history` (with how many matched and how many are already qualified-or-later), stamps `last_run_at`, and opens the filtered list. `saved_count` is always 0 for a run: this re-queries existing leads, it doesn't discover new ones.
- **Re-interpret** — re-runs interpretation over the original query text; useful once you've configured a provider and want to upgrade a keyword fallback.
- **To discovery** — promotes the filters into a `search_configs` row (enabled), which is the machine-facing table the workers pipeline reads. This is what makes a natural-language search change what discovery looks for, not just what the dashboard filters.

`/leads` honors the same filters as URL params, so a filtered list is a shareable/bookmarkable link.

## AI-assisted lead qualification

Every lead's "Why this lead?" card has an **Assess with AI** button (use case `lead_qualification`). It builds a prompt from only what's on file for that lead — company, contact, recorded signals, evidence, the rule-based score breakdown, and the vertical-specific data the connector collected — and asks for a JSON assessment: a qualification summary, a recommended offer picked from the services you actually sell, a signal strength, plus `fitReasons`, `risks` and `missingInformation`.

Same guarantees as outreach drafting, plus one more:

- **Nothing is written until you press "Save to lead."** Generation is read-only; the draft is editable first, so a wrong judgement is a discarded suggestion rather than a corrupted record.
- The model is told to list what's missing instead of filling gaps with plausible-sounding facts.
- On save, only the three fields the schema has columns for are written (`qualification_summary`, `recommended_offer`, `signal_strength`). The reasoning — fit, risks, open questions, and which provider/model produced it — is stored in the activity timeline's `metadata`, so the judgement stays auditable.

## Analytics

`/analytics` covers three questions beyond the raw counts:

- **Follow-up performance** — reply rate overall, per channel, and *per touch number* (1st / 2nd / 3rd / 4th+ message to the same lead), which is the number that says whether your follow-ups earn their time. Plus overdue follow-ups, ones due today, and leads that are in flight with no next step set. All of it comes from outreach recorded in this app (drafts excluded) — it doesn't read a mailbox, so anything sent without logging it here is invisible.
- **Win/loss analysis** — win rate measured against *decided* leads only (won + lost), so it doesn't drift downwards every time discovery adds leads nobody has worked yet. Broken down by tier and vertical, with a loss-reason breakdown taken from the closing status, and average days from lead creation to won (read from `lead_status_history`).
- **Best sources** — per discovery source: leads, average score, contacted, replied, won, and win rate. A lead is attributed to the source of its *earliest* piece of evidence (the connector that surfaced it); later evidence counts as enrichment, not discovery.

## AI-assisted outreach drafting

Configure at least one AI provider in `/settings` (provider + model + use case, enabled). The use cases this app actually calls are `outreach_drafting`, `lead_qualification` and `search_interpretation`; each is looked up independently, so you can point them at different models (or leave one unconfigured and it degrades honestly). For outreach specifically, that means a row with use case `outreach_drafting` — the actual API key still comes from the environment (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`, or `OPENROUTER_API_KEY`), never from the UI. Once configured, every lead's Outreach section gets a "Generate with AI" button per message type (initial, follow-up, meeting request, etc.) that drafts a message grounded only in that lead's actual company/contact/signal/evidence/offer data — never invented facts — which you can edit before recording. If no provider is enabled/configured, the button returns an honest error instead of a fake draft.

`/settings` also has a real "Test connection" button per AI provider row — it makes one trivial live call and records `last_test_status`/`last_tested_at`, never a fabricated "connected" state.

## Database schema

See `supabase/migrations/0001_init.sql` for the full normalized schema (companies → contacts/leads; leads → signals/evidence/scores/activities/outreach/tasks/notes) and RLS policies. Run `npm run db:types` after any schema change (requires `supabase link` first) to regenerate `packages/db/types.ts`.
