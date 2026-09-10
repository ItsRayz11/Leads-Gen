-- ----------------------------------------------------------------------------
-- Records why a lead's tier sits below what its overall score alone would
-- give. Scoring gates a tier on the dimensions that decide whether a lead can
-- be *acted on*: a lead with no named contact cannot be worked today however
-- attractive it looks, and one with no buying signal is a name on a list.
--
-- Without this column an 85-scoring lead showing as a B looks like a bug.
-- Null means the tier is exactly what the score gives.
-- ----------------------------------------------------------------------------
alter table lead_scores add column if not exists tier_limited_by text;
