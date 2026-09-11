-- ----------------------------------------------------------------------------
-- 0014_add_live_search_vertical — adds a 4th vertical, "live_search", driven
-- by a real-time AI web search (Gemini's Google Search grounding) instead of
-- a fixed connector list. Free-text discovery requests that don't fit
-- hiring/general/card_affiliate no longer have to be forced into one of
-- those three or blocked from running at all.
-- ----------------------------------------------------------------------------

alter table leads drop constraint leads_vertical_check;
alter table leads add constraint leads_vertical_check
  check (vertical in ('hiring', 'general', 'card_affiliate', 'live_search'));

alter table search_configs drop constraint search_configs_vertical_check;
alter table search_configs add constraint search_configs_vertical_check
  check (vertical in ('hiring', 'general', 'card_affiliate', 'live_search'));

alter table scoring_config drop constraint scoring_config_vertical_check;
alter table scoring_config add constraint scoring_config_vertical_check
  check (vertical in ('hiring', 'general', 'card_affiliate', 'live_search'));
