-- ============================================================================
-- Lead Intelligence + CRM + Outreach Workspace — initial schema
-- Private single-user app. RLS is enabled everywhere and scoped to
-- "authenticated" (any signed-in user of this Supabase project, which will
-- only ever be you) rather than per-row ownership, since there is no
-- multi-tenant requirement.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles — mirrors auth.users, gives us a stable FK target for created_by
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- companies
-- ----------------------------------------------------------------------------
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  website text,
  domain text, -- normalized (no protocol/www), primary dedupe key
  description text,
  industry text,
  category text,
  country text,
  region text,
  city text,
  company_size text,
  founded_year integer,
  funding text,
  social_profiles jsonb not null default '{}'::jsonb, -- { twitter, linkedin, discord, telegram, ... }
  github_url text,
  other_profiles jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index companies_domain_unique on companies (domain) where domain is not null;
create index companies_name_idx on companies using gin (to_tsvector('simple', name));
create index companies_country_idx on companies (country);
create index companies_industry_idx on companies (industry);
create index companies_updated_at_idx on companies (updated_at desc);

-- ----------------------------------------------------------------------------
-- company_sources — evidence trail of which source(s) surfaced a company,
-- so the same company found via multiple connectors gets one row, many sources
-- ----------------------------------------------------------------------------
create table company_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  source_name text not null, -- e.g. 'greenhouse', 'web3.career', 'manual'
  source_url text,
  first_seen_at timestamptz not null default now()
);

create index company_sources_company_idx on company_sources (company_id);

-- ----------------------------------------------------------------------------
-- contacts — public, human-verified contact info only (never guessed)
-- ----------------------------------------------------------------------------
create table contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies (id) on delete set null,
  name text,
  first_name text,
  last_name text,
  job_title text,
  department text,
  profile_url text, -- public professional profile (LinkedIn/X/etc.)
  email text, -- only ever populated from a source that confirmed it's public/valid
  contact_method text, -- 'email' | 'twitter' | 'telegram' | 'company_form' | 'linkedin' | custom
  contact_value text,
  source text, -- connector or 'manual'
  verification_status text not null default 'unverified'
    check (verification_status in ('verified', 'partially_verified', 'needs_verification', 'unverified')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_company_idx on contacts (company_id);
create index contacts_name_idx on contacts using gin (to_tsvector('simple', coalesce(name, '')));

-- ----------------------------------------------------------------------------
-- leads — an opportunity, not the same thing as a company (a company can
-- have multiple concurrent opportunities: KOL marketing, card affiliate, ...)
-- ----------------------------------------------------------------------------
create table leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  primary_contact_id uuid references contacts (id) on delete set null,
  vertical text not null check (vertical in ('hiring', 'general', 'card_affiliate')),
  title text not null, -- short human label, e.g. "Community Manager hiring signal"
  opportunity_type text, -- 'kol_marketing' | 'affiliate' | 'community_mgmt' | 'card_affiliate' | custom
  service_type text,
  score integer not null default 0,
  tier text check (tier in ('A+', 'A', 'B', 'C', 'Low Priority')),
  status text not null default 'new' check (status in (
    'new', 'researching', 'qualified', 'contacted', 'follow_up', 'replied',
    'meeting', 'negotiation', 'won',
    'no_response', 'rejected', 'not_interested', 'not_a_fit', 'lost', 'on_hold'
  )),
  priority text default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  buying_signal_summary text,
  signal_strength text check (signal_strength in ('weak', 'moderate', 'strong')),
  signal_date date,
  freshness text check (freshness in ('fresh', 'recent', 'aging', 'stale', 'unknown')),
  verification_status text not null default 'unverified'
    check (verification_status in ('verified', 'partially_verified', 'needs_verification', 'unverified')),
  recommended_offer text,
  qualification_summary text,
  owner text,
  source_type text check (source_type in ('free', 'paid')),
  vertical_data jsonb not null default '{}'::jsonb, -- vertical-specific structured fields the scorer reads
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz
);

create unique index leads_company_title_unique on leads (company_id, title);
create index leads_score_idx on leads (score desc);
create index leads_status_idx on leads (status);
create index leads_tier_idx on leads (tier);
create index leads_vertical_idx on leads (vertical);
create index leads_next_follow_up_idx on leads (next_follow_up_at);
create index leads_created_at_idx on leads (created_at desc);
create index leads_updated_at_idx on leads (updated_at desc);

-- ----------------------------------------------------------------------------
-- evidence — every signal must be backed by a real, checkable source
-- ----------------------------------------------------------------------------
create table evidence (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  source text not null, -- connector name or 'manual'
  url text,
  source_title text,
  source_type text, -- 'careers_page' | 'job_board' | 'news' | 'social' | 'website' | custom
  description text not null,
  signal_supported text, -- free-text label of which signal this backs
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  verified_at timestamptz,
  freshness text check (freshness in ('fresh', 'recent', 'aging', 'stale', 'unknown')),
  confidence numeric(3, 2) check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now()
);

create index evidence_lead_idx on evidence (lead_id);
create index evidence_discovered_at_idx on evidence (discovered_at desc);

-- ----------------------------------------------------------------------------
-- lead_signals — structured buying signals (a lead can have several)
-- ----------------------------------------------------------------------------
create table lead_signals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  signal_type text not null, -- 'hiring' | 'launch' | 'expansion' | 'fundraising' | 'partnership' | custom
  signal_strength text check (signal_strength in ('weak', 'moderate', 'strong')),
  signal_description text not null,
  signal_date date,
  source text,
  evidence_id uuid references evidence (id) on delete set null,
  confidence numeric(3, 2) check (confidence >= 0 and confidence <= 1),
  verification_status text not null default 'unverified'
    check (verification_status in ('verified', 'partially_verified', 'needs_verification', 'unverified')),
  freshness text check (freshness in ('fresh', 'recent', 'aging', 'stale', 'unknown')),
  is_primary boolean not null default false,
  raw_payload jsonb, -- untouched original connector response, for audit/debug only
  created_at timestamptz not null default now()
);

create index lead_signals_lead_idx on lead_signals (lead_id);
create index lead_signals_type_idx on lead_signals (signal_type);
create index lead_signals_date_idx on lead_signals (signal_date);

-- ----------------------------------------------------------------------------
-- lead_scores — transparent score breakdown, one row per computed score
-- (history is kept; the leads.score/tier columns always mirror the latest row)
-- ----------------------------------------------------------------------------
create table lead_scores (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  intent_score integer,
  fit_score integer,
  evidence_score integer,
  freshness_score integer,
  contactability_score integer,
  company_quality_score integer,
  overall_score integer not null,
  tier text,
  breakdown jsonb not null default '[]'::jsonb, -- [{ label, points }]
  is_human_override boolean not null default false,
  override_reason text,
  computed_at timestamptz not null default now()
);

create index lead_scores_lead_idx on lead_scores (lead_id, computed_at desc);

-- ----------------------------------------------------------------------------
-- lead_status_history — audit trail of every status change
-- ----------------------------------------------------------------------------
create table lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  old_status text,
  new_status text not null,
  reason text,
  changed_by uuid references profiles (id),
  changed_at timestamptz not null default now()
);

create index lead_status_history_lead_idx on lead_status_history (lead_id);

-- ----------------------------------------------------------------------------
-- tags / lead_tags
-- ----------------------------------------------------------------------------
create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text
);

create table lead_tags (
  lead_id uuid not null references leads (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (lead_id, tag_id)
);

-- ----------------------------------------------------------------------------
-- activities — full timeline per lead/company/contact
-- ----------------------------------------------------------------------------
create table activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads (id) on delete cascade,
  company_id uuid references companies (id) on delete cascade,
  contact_id uuid references contacts (id) on delete cascade,
  type text not null, -- 'created' | 'research' | 'note' | 'contacted' | 'email' | 'dm' |
                       -- 'follow_up' | 'reply' | 'meeting' | 'proposal' | 'status_change' |
                       -- 'verification' | custom
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index activities_lead_idx on activities (lead_id, occurred_at desc);
create index activities_company_idx on activities (company_id, occurred_at desc);
create index activities_contact_idx on activities (contact_id, occurred_at desc);

-- ----------------------------------------------------------------------------
-- outreach — a record of contact attempts (prep/tracking, not mass-sending)
-- ----------------------------------------------------------------------------
create table outreach (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  contact_id uuid references contacts (id) on delete set null,
  channel text not null, -- 'email' | 'x' | 'telegram' | 'linkedin' | 'whatsapp' | custom
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  message text,
  recipient text,
  result text, -- 'sent' | 'no_response' | 'replied' | 'bounced' | custom
  status text not null default 'draft' check (status in ('draft', 'sent', 'replied', 'no_response', 'bounced')),
  sent_at timestamptz,
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index outreach_lead_idx on outreach (lead_id, sent_at desc);
create index outreach_follow_up_idx on outreach (follow_up_date);

-- ----------------------------------------------------------------------------
-- tasks
-- ----------------------------------------------------------------------------
create table tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads (id) on delete cascade,
  company_id uuid references companies (id) on delete cascade,
  contact_id uuid references contacts (id) on delete cascade,
  outreach_id uuid references outreach (id) on delete set null,
  title text not null,
  due_date date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_due_date_idx on tasks (due_date);
create index tasks_status_idx on tasks (status);
create index tasks_lead_idx on tasks (lead_id);

-- ----------------------------------------------------------------------------
-- notes
-- ----------------------------------------------------------------------------
create table notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads (id) on delete cascade,
  company_id uuid references companies (id) on delete cascade,
  contact_id uuid references contacts (id) on delete cascade,
  body text not null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_lead_idx on notes (lead_id, created_at desc);
create index notes_company_idx on notes (company_id, created_at desc);
create index notes_body_idx on notes using gin (to_tsvector('simple', body));

-- ----------------------------------------------------------------------------
-- search_configs — machine-facing discovery configuration read by the
-- workers pipeline (distinct from saved_searches, which is the user-facing
-- Lead Discovery UI concept)
-- ----------------------------------------------------------------------------
create table search_configs (
  id uuid primary key default gen_random_uuid(),
  vertical text not null check (vertical in ('hiring', 'general', 'card_affiliate')),
  name text not null,
  keywords text[],
  industries text[],
  geography text[],
  exclude_keywords text[],
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- saved_searches — user-facing Lead Discovery searches (structured + NL)
-- ----------------------------------------------------------------------------
create table saved_searches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  query_text text, -- original natural-language input, if any
  filters jsonb not null default '{}'::jsonb, -- interpreted structured filters
  vertical text,
  created_at timestamptz not null default now(),
  last_run_at timestamptz
);

-- ----------------------------------------------------------------------------
-- search_history — every discovery run, saved or ad hoc
-- ----------------------------------------------------------------------------
create table search_history (
  id uuid primary key default gen_random_uuid(),
  saved_search_id uuid references saved_searches (id) on delete set null,
  query_text text,
  filters jsonb not null default '{}'::jsonb,
  results_count integer not null default 0,
  qualified_count integer not null default 0,
  saved_count integer not null default 0,
  run_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- search_results — raw hits from a discovery run, before promotion to a lead
-- ----------------------------------------------------------------------------
create table search_results (
  id uuid primary key default gen_random_uuid(),
  search_history_id uuid not null references search_history (id) on delete cascade,
  raw_lead jsonb not null,
  matched_company_id uuid references companies (id) on delete set null,
  matched_lead_id uuid references leads (id) on delete set null,
  created_at timestamptz not null default now()
);

create index search_results_history_idx on search_results (search_history_id);

-- ----------------------------------------------------------------------------
-- provider_connections — optional paid lead/data providers (Apollo, Hunter, ...)
-- API keys themselves live in server-side env vars, never in this table.
-- ----------------------------------------------------------------------------
create table provider_connections (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null unique, -- 'apollo' | 'hunter' | 'prospeo' | 'web3_career' | 'twitterapi_io' | custom
  category text not null check (category in ('lead_data', 'ai')),
  enabled boolean not null default false,
  priority integer not null default 0,
  last_test_status text, -- 'ok' | 'error' | 'not_tested'
  last_tested_at timestamptz,
  usage_info jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ai_provider_settings — which AI provider/model handles which task
-- ----------------------------------------------------------------------------
create table ai_provider_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null, -- 'openai' | 'anthropic' | 'google' | 'openrouter' | custom
  model text,
  use_case text, -- 'lead_research' | 'lead_scoring' | 'outreach_drafting' | custom
  enabled boolean not null default false,
  priority integer not null default 0,
  last_test_status text,
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- notifications — dashboard reminders
-- ----------------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- 'follow_up_due' | 'follow_up_overdue' | 'needs_verification' | 'high_intent_lead' | custom
  title text not null,
  body text,
  related_lead_id uuid references leads (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_read_idx on notifications (read, created_at desc);

-- ============================================================================
-- updated_at triggers
-- ============================================================================
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_set_updated_at before update on companies
  for each row execute procedure public.set_updated_at();
create trigger contacts_set_updated_at before update on contacts
  for each row execute procedure public.set_updated_at();
create trigger leads_set_updated_at before update on leads
  for each row execute procedure public.set_updated_at();
create trigger outreach_set_updated_at before update on outreach
  for each row execute procedure public.set_updated_at();
create trigger tasks_set_updated_at before update on tasks
  for each row execute procedure public.set_updated_at();
create trigger notes_set_updated_at before update on notes
  for each row execute procedure public.set_updated_at();
create trigger ai_provider_settings_set_updated_at before update on ai_provider_settings
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- lead status history trigger — auto-log every status change
-- ============================================================================
create function public.log_lead_status_change()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into lead_status_history (lead_id, old_status, new_status)
    values (new.id, old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger leads_log_status_change after update on leads
  for each row execute procedure public.log_lead_status_change();

-- ============================================================================
-- Row Level Security — private single-user app: any authenticated user
-- (i.e. you, signed in via Supabase Auth) has full access; anonymous
-- (unauthenticated) requests are denied everywhere.
-- ============================================================================
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'profiles', 'companies', 'company_sources', 'contacts', 'leads',
      'evidence', 'lead_signals', 'lead_scores', 'lead_status_history',
      'tags', 'lead_tags', 'activities', 'outreach', 'tasks', 'notes',
      'search_configs', 'saved_searches', 'search_history', 'search_results',
      'provider_connections', 'ai_provider_settings', 'notifications'
    ])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true);',
      t || '_authenticated_all', t
    );
  end loop;
end $$;
