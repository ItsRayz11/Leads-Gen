-- ----------------------------------------------------------------------------
-- 0015_live_search_providers — lets a live_search config pick which AI
-- provider(s) actually run the grounded web search (Gemini/OpenAI/Anthropic
-- each have their own, and searching with more than one finds more real
-- companies than any single one alone). Null/empty means "use the default"
-- (Gemini only), so existing rows and every other vertical are unaffected.
-- ----------------------------------------------------------------------------

alter table search_configs add column live_search_providers text[];

alter table search_configs add constraint search_configs_live_search_providers_check
  check (
    live_search_providers is null
    or live_search_providers <@ array['google', 'openai', 'anthropic']::text[]
  );
