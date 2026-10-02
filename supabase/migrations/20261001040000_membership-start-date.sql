-- Pulso: admin-chosen membership start date
-- Assigning/renewing always started the cycle "today" -- a member who paid on
-- the 25th but got entered on the 28th lost 3 days. The admin now picks
-- cycle_start, and cycle_end is derived from it by a trigger so every write
-- path (RPCs and plain admin updates) stays consistent.

create or replace function set_membership_cycle_end() returns trigger
language plpgsql as $$
begin
  new.cycle_end := new.cycle_start + interval '1 month';
  return new;
end;
$$;

create trigger memberships_set_cycle_end
before insert or update of cycle_start, status on memberships
for each row execute function set_membership_cycle_end();

drop function admin_create_membership(uuid, text, int, int);
create function admin_create_membership(
  p_user_id uuid,
  p_plan_name text,
  p_credits_per_cycle int,
  p_weekly_goal int,
  p_cycle_start date default current_date
) returns memberships
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_membership public.memberships%rowtype;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;

  insert into public.memberships (user_id, plan_name, credits_per_cycle, weekly_goal, cycle_start)
  values (p_user_id, p_plan_name, p_credits_per_cycle, p_weekly_goal, p_cycle_start)
  returning * into v_membership;

  insert into public.credit_transactions (user_id, amount, type, reference_id)
  values (p_user_id, p_credits_per_cycle, 'grant', v_membership.id);

  insert into public.notifications (user_id, type, title, body)
  values (p_user_id, 'credits', 'Membresia activada', format('Recibiste %s creditos.', p_credits_per_cycle));

  return v_membership;
end;
$$;
revoke execute on function admin_create_membership(uuid, text, int, int, date) from public;
grant execute on function admin_create_membership(uuid, text, int, int, date) to authenticated;

drop function admin_grant_credits_bulk(uuid[]);
create function admin_grant_credits_bulk(p_user_ids uuid[], p_cycle_start date default current_date) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_membership record;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;

  for v_membership in
    select * from public.memberships where user_id = any(p_user_ids) and status in ('active', 'expired')
  loop
    insert into public.credit_transactions (user_id, amount, type)
    values (v_membership.user_id, v_membership.credits_per_cycle, 'grant');

    update public.memberships
    set cycle_start = p_cycle_start, status = 'active'
    where id = v_membership.id;

    insert into public.notifications (user_id, type, title, body)
    values (v_membership.user_id, 'credits', 'Creditos renovados', format('Recibiste %s creditos este mes.', v_membership.credits_per_cycle));
  end loop;
end;
$$;
revoke execute on function admin_grant_credits_bulk(uuid[], date) from public;
grant execute on function admin_grant_credits_bulk(uuid[], date) to authenticated;
