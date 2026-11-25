-- Pulso: admin-chosen membership end date
-- cycle_end was always start + 1 month - 1 day. The admin can now set it
-- explicitly (e.g. 15-day or 3-month plans); NULL still means "1 month".

-- cycle_end rules:
--   * NULL                                   -> start + 1 month - 1 day
--   * unchanged, but start moved/reactivated -> start + 1 month - 1 day
--   * explicitly set/changed                 -> kept as given
create or replace function set_membership_cycle_end() returns trigger
language plpgsql as $$
begin
  if new.cycle_end is null
     or (tg_op = 'UPDATE' and new.cycle_end is not distinct from old.cycle_end
         and (new.cycle_start is distinct from old.cycle_start
              or (new.status = 'active' and old.status <> 'active'))) then
    new.cycle_end := new.cycle_start + interval '1 month' - interval '1 day';
  elsif tg_op = 'UPDATE' and new.cycle_end is not distinct from old.cycle_end then
    return new; -- dates untouched (plain plan edit / cancel / expire)
  end if;

  if new.cycle_end < new.cycle_start then
    raise exception 'cycle_end_before_start';
  end if;
  if new.cycle_end < studio_today() then
    raise exception 'cycle_already_over';
  end if;
  return new;
end;
$$;

-- Also fire when only cycle_end changes, so it gets validated.
drop trigger memberships_set_cycle_end on memberships;
create trigger memberships_set_cycle_end
before insert or update of cycle_start, cycle_end, status on memberships
for each row execute function set_membership_cycle_end();

drop function admin_create_membership(uuid, text, int, int, date);
create function admin_create_membership(
  p_user_id uuid,
  p_plan_name text,
  p_credits_per_cycle int,
  p_weekly_goal int,
  p_cycle_start date default studio_today(),
  p_cycle_end date default null
) returns memberships
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_membership public.memberships%rowtype;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;

  insert into public.memberships (user_id, plan_name, credits_per_cycle, weekly_goal, cycle_start, cycle_end)
  values (p_user_id, p_plan_name, p_credits_per_cycle, p_weekly_goal, p_cycle_start, p_cycle_end)
  returning * into v_membership;

  perform reset_credit_balance(p_user_id);
  insert into public.credit_transactions (user_id, amount, type, reference_id)
  values (p_user_id, p_credits_per_cycle, 'grant', v_membership.id);

  insert into public.notifications (user_id, type, title, body)
  values (p_user_id, 'credits', 'Membresia activada', format('Recibiste %s creditos.', p_credits_per_cycle));

  return v_membership;
end;
$$;
revoke execute on function admin_create_membership(uuid, text, int, int, date, date) from public, anon;
grant execute on function admin_create_membership(uuid, text, int, int, date, date) to authenticated;

drop function admin_grant_credits_bulk(uuid[], date);
create function admin_grant_credits_bulk(
  p_user_ids uuid[],
  p_cycle_start date default studio_today(),
  p_cycle_end date default null
) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_membership record;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;

  for v_membership in
    select * from public.memberships
    where user_id = any(p_user_ids) and status in ('active', 'expired')
      -- already renewed to this start date: a double click, not a new payment
      and not (status = 'active' and cycle_start = p_cycle_start)
    for update -- waits out an in-flight book_class() before resetting credits
  loop
    -- NULL cycle_end -> trigger derives start + 1 month - 1 day
    update public.memberships set cycle_start = p_cycle_start, cycle_end = p_cycle_end, status = 'active'
    where id = v_membership.id;

    perform reset_credit_balance(v_membership.user_id);
    insert into public.credit_transactions (user_id, amount, type, reference_id)
    values (v_membership.user_id, v_membership.credits_per_cycle, 'grant', v_membership.id);

    insert into public.notifications (user_id, type, title, body)
    values (v_membership.user_id, 'credits', 'Membresia renovada', format('Recibiste %s creditos.', v_membership.credits_per_cycle));
  end loop;
end;
$$;
revoke execute on function admin_grant_credits_bulk(uuid[], date, date) from public, anon;
grant execute on function admin_grant_credits_bulk(uuid[], date, date) to authenticated;
