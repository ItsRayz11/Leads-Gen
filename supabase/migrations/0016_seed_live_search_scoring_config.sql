-- ----------------------------------------------------------------------------
-- 0016_seed_live_search_scoring_config — live_search was left out of
-- 0007_scoring_config.sql's seed (it didn't exist yet), so the Settings page
-- rendered no card for it and only the hardcoded score.ts default applied,
-- uneditable, unlike the other three verticals. Seeds the same weights
-- score.ts already uses (VERTICAL_DIMENSION_WEIGHTS.live_search) so adding
-- this row changes nothing until someone actually edits it.
-- ----------------------------------------------------------------------------

insert into scoring_config (vertical, dimension_weights, tier_thresholds)
values
  (
    'live_search',
    '{"fit":30,"evidence":25,"intent":20,"freshness":15,"contactability":10}',
    '[{"tier":"A+","min":85},{"tier":"A","min":70},{"tier":"B","min":50},{"tier":"C","min":25},{"tier":"Low Priority","min":0}]'
  )
on conflict (vertical) do nothing;
