-- ----------------------------------------------------------------------------
-- Covering indexes for the foreign keys that didn't have one.
--
-- Postgres indexes the *referenced* side of a foreign key automatically (it's
-- a primary key), but never the referencing column. Without an index there,
-- two things degrade as the tables grow:
--
--   1. Every delete or key update on the parent row has to sequentially scan
--      the child table to enforce the constraint. Deleting one contact scans
--      all of `leads`, `notes`, `outreach` and `tasks`.
--   2. Joins that start from the child side (an activity's author, a lead's
--      primary contact, a search run's saved search) can't use an index.
--
-- These are the fifteen the Supabase database linter flagged
-- (lint 0001_unindexed_foreign_keys). Index-only additions: no column,
-- constraint or row is changed, and `if not exists` keeps the file safe to
-- re-run against a database that already has them.
-- ----------------------------------------------------------------------------

create index if not exists activities_created_by_idx
  on activities (created_by);

create index if not exists lead_signals_evidence_idx
  on lead_signals (evidence_id);

create index if not exists lead_status_history_changed_by_idx
  on lead_status_history (changed_by);

create index if not exists lead_tags_tag_idx
  on lead_tags (tag_id);

create index if not exists leads_primary_contact_idx
  on leads (primary_contact_id);

create index if not exists notes_contact_idx
  on notes (contact_id);

create index if not exists notes_created_by_idx
  on notes (created_by);

create index if not exists notifications_related_lead_idx
  on notifications (related_lead_id);

create index if not exists outreach_contact_idx
  on outreach (contact_id);

create index if not exists search_history_saved_search_idx
  on search_history (saved_search_id);

create index if not exists search_results_matched_company_idx
  on search_results (matched_company_id);

create index if not exists search_results_matched_lead_idx
  on search_results (matched_lead_id);

create index if not exists tasks_company_idx
  on tasks (company_id);

create index if not exists tasks_contact_idx
  on tasks (contact_id);

create index if not exists tasks_outreach_idx
  on tasks (outreach_id);
