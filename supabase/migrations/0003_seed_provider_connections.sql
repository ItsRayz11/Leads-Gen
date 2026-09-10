-- ----------------------------------------------------------------------------
-- Seed the rows the Integrations page toggles.
--
-- These start enabled so wiring the toggle up doesn't change how an existing
-- workspace behaves: a lead/data provider still runs when its API key is
-- present in the environment. Switching a row off is what now actually stops
-- the connector — see workers/provider-gate.ts.
--
-- Only 'lead_data' rows are seeded. Which AI provider handles which task is
-- driven by ai_provider_settings (Settings page); a second switch here would
-- just be a second place to look when the AI stops answering.
-- ----------------------------------------------------------------------------
insert into provider_connections (provider_name, category, enabled)
values
  ('web3_career',   'lead_data', true),
  ('twitterapi_io', 'lead_data', true),
  ('hunter',        'lead_data', true),
  ('apollo',        'lead_data', true),
  ('prospeo',       'lead_data', true)
on conflict (provider_name) do nothing;
