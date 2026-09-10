-- ----------------------------------------------------------------------------
-- Prevents the notification generator from spamming duplicate reminders: at
-- most one unread notification per (type, lead) at a time. Once the existing
-- one is marked read, a later run can create a fresh one for the same lead.
-- ----------------------------------------------------------------------------
create unique index if not exists notifications_unread_dedupe_idx
  on notifications (type, related_lead_id)
  where read = false and related_lead_id is not null;
