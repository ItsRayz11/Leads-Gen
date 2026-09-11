-- ----------------------------------------------------------------------------
-- provider_secrets — optional DB-stored API keys, entered from the
-- Integrations page instead of an env var. Values are encrypted application-
-- side (AES-256-GCM, packages/db/secrets.ts) before they ever reach this
-- table — SECRETS_ENCRYPTION_KEY (server-only env var) is what decrypts them,
-- so a database leak alone doesn't expose the underlying keys.
-- ----------------------------------------------------------------------------
create table provider_secrets (
  provider_name text primary key,
  category text not null check (category in ('lead_data', 'ai')),
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

alter table provider_secrets enable row level security;
create policy provider_secrets_authenticated_all on provider_secrets for all to authenticated using (true) with check (true);
