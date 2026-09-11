-- Adds an 'archived' status so a lead can be soft-deleted (hidden from the
-- default All Leads / Pipeline views) without losing its company, evidence,
-- signal, or scoring history. Used first to retire a batch of leads that
-- predates the exact-phrase HN keyword fix (commit a56e99f) and were noise
-- from the old broad-match query, not real opportunities.

alter table leads drop constraint leads_status_check;
alter table leads add constraint leads_status_check check (status in (
  'new', 'researching', 'qualified', 'contacted', 'follow_up', 'replied',
  'meeting', 'negotiation', 'won',
  'no_response', 'rejected', 'not_interested', 'not_a_fit', 'lost', 'on_hold',
  'archived'
));
