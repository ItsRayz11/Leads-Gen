-- Sort-rank columns for the /leads table.
--
-- tier, status, priority, verification_status and freshness are `text` with a
-- CHECK constraint rather than Postgres enums, so ORDER BY on them is
-- alphabetical: freshness would sort "aging, fresh, recent, stale" and status
-- "contacted, follow_up, lost, meeting, ...". Neither ordering means anything
-- to a human reading the table.
--
-- These generated columns give each of those a real rank, ascending = best /
-- earliest-in-the-pipeline first, so the table can sort on something
-- meaningful without a second lookup table or a client-side re-sort that
-- would fight pagination. They are STORED and derived, so nothing writes to
-- them and existing rows are backfilled by the ALTER itself.

alter table leads
  add column tier_rank smallint generated always as (
    case tier
      when 'A+' then 0
      when 'A' then 1
      when 'B' then 2
      when 'C' then 3
      when 'Low Priority' then 4
      else 9
    end
  ) stored,

  add column status_rank smallint generated always as (
    case status
      when 'new' then 0
      when 'researching' then 1
      when 'qualified' then 2
      when 'contacted' then 3
      when 'follow_up' then 4
      when 'replied' then 5
      when 'meeting' then 6
      when 'negotiation' then 7
      when 'won' then 8
      when 'on_hold' then 9
      when 'no_response' then 10
      when 'not_a_fit' then 11
      when 'not_interested' then 12
      when 'rejected' then 13
      when 'lost' then 14
      else 99
    end
  ) stored,

  add column priority_rank smallint generated always as (
    case priority
      when 'urgent' then 0
      when 'high' then 1
      when 'normal' then 2
      when 'low' then 3
      else 9
    end
  ) stored,

  add column verification_rank smallint generated always as (
    case verification_status
      when 'verified' then 0
      when 'partially_verified' then 1
      when 'needs_verification' then 2
      when 'unverified' then 3
      else 9
    end
  ) stored,

  add column freshness_rank smallint generated always as (
    case freshness
      when 'fresh' then 0
      when 'recent' then 1
      when 'aging' then 2
      when 'stale' then 3
      when 'unknown' then 4
      else 9
    end
  ) stored;

create index leads_tier_rank_idx on leads (tier_rank);
create index leads_status_rank_idx on leads (status_rank);
create index leads_freshness_rank_idx on leads (freshness_rank);
