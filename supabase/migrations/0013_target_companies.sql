-- ----------------------------------------------------------------------------
-- target_companies — the company/board lists the job-board connectors
-- (Greenhouse, Lever, Ashby) and the card-affiliate agency-website connector
-- check, entered from the Integrations page instead of hand-edited JSON files
-- under config/target-companies/. A running deployment (Vercel in
-- particular) can't write back to its own repo files, so this is what makes
-- "add a company" actually take effect without a code change + redeploy.
--
-- Each connector still falls back to reading its config/target-companies/*.json
-- file when this table has no enabled rows for it (see workers/target-companies.ts)
-- so a deployment that seeded companies via the JSON file keeps working
-- until/unless someone adds rows here.
-- ----------------------------------------------------------------------------
create table target_companies (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('greenhouse', 'lever', 'ashby', 'agency')),
  -- Greenhouse/Lever/Ashby: the board token/company slug/board name from the
  -- job board URL. Agency: the website URL (its natural unique key).
  identifier text not null,
  -- Optional friendly name shown in the UI. For 'agency' rows this is the
  -- agency's display name (shown instead of the raw website).
  label text,
  -- Per-source extra fields that don't fit a shared column — currently just
  -- 'agency' rows' optional twitterHandle.
  extra jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (source, identifier)
);

alter table target_companies enable row level security;
create policy target_companies_authenticated_all on target_companies for all to authenticated using (true) with check (true);
