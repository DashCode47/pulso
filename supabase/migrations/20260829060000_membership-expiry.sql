-- Pulso: membership expiry
-- "active" meant active forever until an admin manually paused/cancelled --
-- no automatic lapse if a member simply never got renewed. Now every
-- membership carries a cycle_end (1 calendar month from cycle_start), and a
-- daily cron expires anyone whose cycle_end has passed. book_class() also
-- checks cycle_end directly (not just status), so a membership can't be used
-- to book on the exact day it lapses, before the cron gets to it.

alter table memberships add column cycle_end date;
update memberships set cycle_end = cycle_start + interval '1 month' where cycle_end is null;
alter table memberships alter column cycle_end set not null;
alter table memberships drop constraint memberships_status_check;
alter table memberships add constraint memberships_status_check check (status in ('active', 'paused', 'cancelled', 'expired'));

-- admin_create_membership() now sets cycle_end alongside cycle_start.
create or replace function admin_create_membership(
  p_user_id uuid,
  p_plan_name text,
  p_credits_per_cycle int,
  p_weekly_goal int
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
  values (p_user_id, p_plan_name, p_credits_per_cycle, p_weekly_goal, current_date, current_date + interval '1 month')
  returning * into v_membership;

  insert into public.credit_transactions (user_id, amount, type, reference_id)
  values (p_user_id, p_credits_per_cycle, 'grant', v_membership.id);

  insert into public.notifications (user_id, type, title, body)
  values (p_user_id, 'credits', 'Membresia activada', format('Recibiste %s creditos.', p_credits_per_cycle));

  return v_membership;
end;
$$;

-- admin_grant_credits_bulk() renews cycle_end (not just cycle_start) --
-- renewing credits is what actually extends how long the membership is valid.
create or replace function admin_grant_credits_bulk(p_user_ids uuid[]) returns void
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
    set cycle_start = current_date, cycle_end = current_date + interval '1 month', status = 'active'
    where id = v_membership.id;

    insert into public.notifications (user_id, type, title, body)
    values (v_membership.user_id, 'credits', 'Creditos renovados', format('Recibiste %s creditos este mes.', v_membership.credits_per_cycle));
  end loop;
end;
$$;

-- book_class() also gates on cycle_end, not just status -- a membership can
-- lapse today and this closes the same-day gap before the expiry cron runs.
create or replace function book_class(p_class_id uuid, p_bike_id uuid) returns reservations
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_class public.classes%rowtype;
  v_balance int;
  v_booked_count int;
  v_reservation public.reservations%rowtype;
begin
  if not exists (select 1 from public.memberships where user_id = auth.uid() and status = 'active' and cycle_end >= current_date) then
    raise exception 'no_active_membership';
  end if;
  -- serializes concurrent booking calls from the same user so a double-tap
  -- can't spend the same credit twice
  perform 1 from public.memberships where user_id = auth.uid() and status = 'active' for update;

  select * into v_class from public.classes where id = p_class_id for update;
  if v_class is null or v_class.status <> 'scheduled' then
    raise exception 'class_not_available';
  end if;
  if v_class.starts_at <= now() then
    raise exception 'class_already_started';
  end if;

  select count(*) into v_booked_count from public.reservations where class_id = p_class_id and status = 'booked';
  if v_booked_count >= v_class.capacity then
    raise exception 'class_not_available';
  end if;

  select coalesce(sum(amount), 0) into v_balance from public.credit_transactions where user_id = auth.uid();
  if v_balance < 1 then
    raise exception 'insufficient_credits';
  end if;

  begin
    insert into public.reservations (class_id, user_id, bike_id)
    values (p_class_id, auth.uid(), p_bike_id)
    returning * into v_reservation;
  exception when unique_violation then
    raise exception 'bike_or_class_unavailable';
  end;

  insert into public.credit_transactions (user_id, amount, type, reference_id)
  values (auth.uid(), -1, 'booking', v_reservation.id);

  insert into public.notifications (user_id, type, title, body, data)
  values (auth.uid(), 'booking_confirmed', 'Reserva confirmada',
          format('Tu clase %s esta reservada.', v_class.title),
          jsonb_build_object('reservation_id', v_reservation.id));

  if v_balance - 1 <= 2 then
    insert into public.notifications (user_id, type, title, body)
    values (auth.uid(), 'credits_low', 'Pocos creditos', format('Te quedan %s creditos.', v_balance - 1));
  end if;

  return v_reservation;
end;
$$;

-- Daily cron: lapse anyone past their cycle_end that the admin hasn't
-- renewed. Paused/cancelled memberships are untouched -- those are already
-- explicit admin decisions, not lapses.
create or replace function expire_lapsed_memberships() returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  update public.memberships set status = 'expired'
  where status = 'active' and cycle_end < current_date;
end;
$$;
revoke execute on function expire_lapsed_memberships() from public;

select cron.schedule('expire-lapsed-memberships', '30 3 * * *', $$select expire_lapsed_memberships()$$);
