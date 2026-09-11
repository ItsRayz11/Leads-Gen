-- Pin search_path on the two functions from 0001 that were missing it
-- (handle_new_user already had it) so they can't be tricked by a
-- session-local search_path change, and stop handle_new_user being
-- callable directly via REST RPC — it's only meant to run as the
-- on_auth_user_created trigger.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.log_lead_status_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into lead_status_history (lead_id, old_status, new_status)
    values (new.id, old.status, new.status);
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
