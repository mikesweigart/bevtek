-- 24-hour hold expiry — lazy sweep.
--
-- Ready-for-pickup holds (status = 'confirmed') that sit past their
-- hold_until get auto-flipped to 'expired'. We don't run a cron here;
-- the /holds page calls this RPC on every load, and staff land on that
-- page dozens of times per shift, so stale rows clear themselves
-- without a scheduler dependency. Pending / in_progress rows are left
-- alone — those need human attention regardless of clock.

create or replace function public.expire_stale_holds()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.hold_requests
  set status = 'expired'
  where status = 'confirmed'
    and hold_until is not null
    and hold_until < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.expire_stale_holds() to authenticated;

-- Also expose a helper so the staff queue query can avoid a second
-- round trip — reads expire-then-select in one call.
create or replace function public.hold_queue_tick()
returns json
language sql
security definer
set search_path = public
stable
as $$
  select json_build_object(
    'ok', true,
    'now', now()
  );
$$;

grant execute on function public.hold_queue_tick() to authenticated;
