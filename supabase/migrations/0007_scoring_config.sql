-- ----------------------------------------------------------------------------
-- Per-vertical scoring config, editable from the Settings page instead of
-- only in workers/scoring/score.ts. `dimension_weights` mirrors
-- VERTICAL_DIMENSION_WEIGHTS (how much each 0-100 dimension score counts
-- toward the overall score) and `tier_thresholds` mirrors TIER_THRESHOLDS
-- (score cutoffs, highest first) — both seeded to the code's current
-- defaults so writing this table doesn't change any lead's score until
-- someone actually edits a row.
--
-- Rule *definitions* (which signals earn points) stay in code — only the
-- weights and cutoffs numbers move here, since those are what "tuning" means
-- without turning this into a rules engine.
-- ----------------------------------------------------------------------------
create table scoring_config (
  vertical text primary key check (vertical in ('hiring', 'general', 'card_affiliate')),
  dimension_weights jsonb not null,
  tier_thresholds jsonb not null,
  updated_at timestamptz not null default now()
);

insert into scoring_config (vertical, dimension_weights, tier_thresholds)
values
  (
    'hiring',
    '{"intent":30,"companyQuality":20,"contactability":15,"freshness":15,"evidence":10,"fit":10}',
    '[{"tier":"A+","min":85},{"tier":"A","min":70},{"tier":"B","min":50},{"tier":"C","min":25},{"tier":"Low Priority","min":0}]'
  ),
  (
    'general',
    '{"intent":25,"fit":20,"evidence":20,"freshness":20,"contactability":15}',
    '[{"tier":"A+","min":85},{"tier":"A","min":70},{"tier":"B","min":50},{"tier":"C","min":25},{"tier":"Low Priority","min":0}]'
  ),
  (
    'card_affiliate',
    '{"fit":30,"companyQuality":25,"intent":20,"contactability":15,"evidence":10}',
    '[{"tier":"A+","min":85},{"tier":"A","min":70},{"tier":"B","min":50},{"tier":"C","min":25},{"tier":"Low Priority","min":0}]'
  )
on conflict (vertical) do nothing;

alter table scoring_config enable row level security;
create policy scoring_config_authenticated_all on scoring_config
  for all to authenticated using (true) with check (true);
