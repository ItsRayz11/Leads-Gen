-- ----------------------------------------------------------------------------
-- ai_provider_settings: one row per (use_case, provider) so "assign this
-- provider to this task" (the Settings page's task-routing picker) can be a
-- clean upsert instead of accumulating a duplicate row every time the same
-- use case is reassigned. Not partial: Postgres never treats two NULLs as
-- equal for uniqueness, so rows with use_case IS NULL (unused today, but not
-- disallowed by the column) stay unrestricted while every real use case still
-- gets a single row per provider — and a plain (non-partial) unique index is
-- what supabase-js's upsert(..., { onConflict }) requires, since it can't
-- target a partial index's WHERE clause.
-- ----------------------------------------------------------------------------
create unique index ai_provider_settings_use_case_provider_key
  on ai_provider_settings (use_case, provider);
