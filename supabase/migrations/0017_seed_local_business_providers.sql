-- ----------------------------------------------------------------------------
-- Seed the 3 new "general" vertical connectors' toggle rows, matching the
-- pattern in 0006_seed_pdl_provider.sql. Starts enabled so wiring up the
-- toggle doesn't change existing behavior — each connector still no-ops
-- until its API key/credentials are actually configured.
-- ----------------------------------------------------------------------------
insert into provider_connections (provider_name, category, enabled)
values
  ('serper', 'lead_data', true),
  ('decodo', 'lead_data', true),
  ('firecrawl', 'lead_data', true)
on conflict (provider_name) do nothing;
