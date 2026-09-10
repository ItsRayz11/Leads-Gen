-- ----------------------------------------------------------------------------
-- Seed the People Data Labs row the Integrations page toggles, matching the
-- other lead/data providers seeded in 0003. Starts enabled so wiring up the
-- toggle doesn't change existing behavior — it runs whenever PDL_API_KEY is
-- present in the environment, same as the others.
-- ----------------------------------------------------------------------------
insert into provider_connections (provider_name, category, enabled)
values
  ('pdl', 'lead_data', true)
on conflict (provider_name) do nothing;
