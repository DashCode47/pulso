-- Pulso: membership rules
-- 1. A booking must fall inside the membership's paid period
--    (cycle_start..cycle_end). book_class() only checked "not expired today",
--    so a member expiring on the 5th could spend their credits on classes on
--    the 20th, and a future-dated start could be used right away.
-- 2. Dates are the studio's (America/Bogota), not UTC: after 7pm in Bogota
--    current_date was already tomorrow, blocking bookings on a membership's
--    last day and expiring it ~1.5h early.
-- 3. Leftover credits don't roll over: every new cycle starts from exactly
--    credits_per_cycle, and expiring/cancelling zeroes the balance.
-- 4. Expiring or cancelling a membership releases the member's future
--    bookings (promoting the waitlist) and waitlist spots.
-- 5. Renewing twice to the same start date is a no-op (double-click guard).
-- 6. cycle_end is inclusive, so a cycle is start + 1 month - 1 day.
-- 7. Smaller fixes: no-show also works after the class was auto-marked
--    attended (reverts its XP), credit adjustments can't go negative, and
--    weekly streaks use Bogota weeks and break for expired members.

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function studio_today() returns date
language sql stable as $$
  select (now() at time zone 'America/Bogota')::date;
$$;

-- Lock-free check; callers that need the lock take it on the membership row.
create or replace function membership_covers(p_user_id uuid, p_starts_at timestamptz) returns boolean
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select exists (
    select 1 from public.memberships
    where user_id = p_user_id and status = 'active'
      and (p_starts_at at time zone 'America/Bogota')::date between cycle_start and cycle_end
  );
$$;

alter table credit_transactions drop constraint credit_transactions_type_check;
alter table credit_transactions add constraint credit_transactions_type_check
  check (type in ('grant', 'booking', 'cancel_refund', 'no_show_penalty', 'admin_adjustment', 'cycle_reset'));

create or replace function reset_credit_balance(p_user_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_balance int;
begin
  select coalesce(sum(amount), 0) into v_balance from public.credit_transactions where user_id = p_user_id;
  if v_balance > 0 then
    insert into public.credit_transactions (user_id, amount, type, note)
    values (p_user_id, -v_balance, 'cycle_reset', 'Creditos no usados del ciclo anterior');
  end if;
end;
$$;

-- No refunds for the released bookings: the balance is zeroed right after.
create or replace function release_member_bookings(p_user_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_reservation record;
begin
  update public.waitlist_entries set status = 'cancelled' where user_id = p_user_id and status = 'waiting';

  for v_reservation in
    select r.id, r.class_id, r.bike_id from public.reservations r
    join public.classes c on c.id = r.class_id
    where r.user_id = p_user_id and r.status = 'booked' and c.starts_at > now()
    for update of r
  loop
    update public.reservations set status = 'cancelled', cancelled_at = now() where id = v_reservation.id;
    perform promote_from_waitlist(v_reservation.class_id, v_reservation.bike_id);
  end loop;

  perform reset_credit_balance(p_user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- cycle dates
-- ---------------------------------------------------------------------------
alter table memberships alter column cycle_start set default studio_today();

-- cycle_end is always derived from cycle_start (an explicit cycle_end on
-- insert is overwritten). Recomputed when cycle_start changes or the
-- membership is (re)activated -- not on plain plan edits, so those don't move
-- existing rows' dates. Reactivating with the same old start date therefore
-- fails with cycle_already_over instead of "active" with a past cycle_end.
create or replace function set_membership_cycle_end() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT'
     or new.cycle_start is distinct from old.cycle_start
     or (new.status = 'active' and old.status <> 'active') then
    new.cycle_end := new.cycle_start + interval '1 month' - interval '1 day';
    if new.cycle_end < studio_today() then
      raise exception 'cycle_already_over';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- assign / renew / cancel
-- ---------------------------------------------------------------------------
drop function admin_create_membership(uuid, text, int, int, date);
create function admin_create_membership(
  p_user_id uuid,
  p_plan_name text,
  p_credits_per_cycle int,
  p_weekly_goal int,
  p_cycle_start date default studio_today()
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

  perform reset_credit_balance(p_user_id);
  insert into public.credit_transactions (user_id, amount, type, reference_id)
  values (p_user_id, p_credits_per_cycle, 'grant', v_membership.id);

  insert into public.notifications (user_id, type, title, body)
  values (p_user_id, 'credits', 'Membresia activada', format('Recibiste %s creditos.', p_credits_per_cycle));

  return v_membership;
end;
$$;
revoke execute on function admin_create_membership(uuid, text, int, int, date) from public, anon;
grant execute on function admin_create_membership(uuid, text, int, int, date) to authenticated;

drop function admin_grant_credits_bulk(uuid[], date);
create function admin_grant_credits_bulk(p_user_ids uuid[], p_cycle_start date default studio_today()) returns void
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
    update public.memberships set cycle_start = p_cycle_start, status = 'active' where id = v_membership.id;

    perform reset_credit_balance(v_membership.user_id);
    insert into public.credit_transactions (user_id, amount, type, reference_id)
    values (v_membership.user_id, v_membership.credits_per_cycle, 'grant', v_membership.id);

    insert into public.notifications (user_id, type, title, body)
    values (v_membership.user_id, 'credits', 'Membresia renovada', format('Recibiste %s creditos.', v_membership.credits_per_cycle));
  end loop;
end;
$$;
revoke execute on function admin_grant_credits_bulk(uuid[], date) from public, anon;
grant execute on function admin_grant_credits_bulk(uuid[], date) to authenticated;

create or replace function admin_cancel_membership(p_membership_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_user_id uuid;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;

  update public.memberships set status = 'cancelled'
  where id = p_membership_id and status <> 'cancelled'
  returning user_id into v_user_id;
  if v_user_id is null then
    return;
  end if;

  perform release_member_bookings(v_user_id);

  insert into public.notifications (user_id, type, title, body)
  values (v_user_id, 'membership', 'Membresia cancelada', 'Tus reservas futuras fueron canceladas.');
end;
$$;
revoke execute on function admin_cancel_membership(uuid) from public, anon;
grant execute on function admin_cancel_membership(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- expiry: runs right after midnight in Bogota (05:10 UTC)
-- ---------------------------------------------------------------------------
create or replace function expire_lapsed_memberships() returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_membership record;
begin
  for v_membership in
    update public.memberships set status = 'expired'
    where status = 'active' and cycle_end < studio_today()
    returning user_id
  loop
    perform release_member_bookings(v_membership.user_id);

    insert into public.notifications (user_id, type, title, body)
    values (v_membership.user_id, 'membership', 'Membresia vencida', 'Renuevala en recepcion para seguir reservando.');
  end loop;
end;
$$;

select cron.unschedule('expire-lapsed-memberships');
select cron.schedule('expire-lapsed-memberships', '10 5 * * *', $$select expire_lapsed_memberships()$$);

-- ---------------------------------------------------------------------------
-- booking gates: the class date must be inside the paid period
-- ---------------------------------------------------------------------------
create or replace function book_class(p_class_id uuid, p_bike_id uuid) returns reservations
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_class public.classes%rowtype;
  v_balance int;
  v_booked_count int;
  v_reservation public.reservations%rowtype;
begin
  if not exists (select 1 from public.memberships where user_id = auth.uid() and status = 'active') then
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
  if not membership_covers(auth.uid(), v_class.starts_at) then
    raise exception 'membership_not_valid_for_class';
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

create or replace function join_waitlist(p_class_id uuid) returns waitlist_entries
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_class public.classes%rowtype;
  v_entry public.waitlist_entries%rowtype;
begin
  if not exists (select 1 from public.memberships where user_id = auth.uid() and status = 'active') then
    raise exception 'no_active_membership';
  end if;

  select * into v_class from public.classes where id = p_class_id;
  if not found or v_class.status <> 'scheduled' or v_class.starts_at <= now() then
    raise exception 'class_not_available';
  end if;
  if not membership_covers(auth.uid(), v_class.starts_at) then
    raise exception 'membership_not_valid_for_class';
  end if;
  -- past the cutoff nobody can cancel, so no spot will ever free up
  if now() > v_class.starts_at - cancellation_cutoff() then
    raise exception 'waitlist_closed';
  end if;
  if exists (select 1 from public.reservations where class_id = p_class_id and user_id = auth.uid() and status = 'booked') then
    raise exception 'already_booked';
  end if;

  insert into public.waitlist_entries (class_id, user_id) values (p_class_id, auth.uid())
  returning * into v_entry;
  return v_entry;
exception when unique_violation then
  raise exception 'already_on_waitlist';
end;
$$;

create or replace function promote_from_waitlist(p_class_id uuid, p_bike_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_entry record;
  v_reservation public.reservations%rowtype;
  v_starts_at timestamptz := (select starts_at from public.classes where id = p_class_id);
begin
  for v_entry in
    select * from public.waitlist_entries
    where class_id = p_class_id and status = 'waiting'
    order by created_at
    for update skip locked
  loop
    -- Same lock book_class() takes. skip locked: if this member is mid-booking
    -- right now, move on instead of risking a deadlock with their transaction.
    perform 1 from public.memberships
    where user_id = v_entry.user_id and status = 'active'
    for update skip locked;
    continue when not found;
    continue when not membership_covers(v_entry.user_id, v_starts_at);
    -- ponytail: members without credits are skipped, not removed -- they stay
    -- first in line for the next spot once they're topped up.
    continue when (select coalesce(sum(amount), 0) from public.credit_transactions where user_id = v_entry.user_id) < 1;

    begin
      insert into public.reservations (class_id, user_id, bike_id)
      values (p_class_id, v_entry.user_id, p_bike_id)
      returning * into v_reservation;
    exception when unique_violation then
      continue; -- already booked this class some other way
    end;

    insert into public.credit_transactions (user_id, amount, type, reference_id)
    values (v_entry.user_id, -1, 'booking', v_reservation.id);

    insert into public.notifications (user_id, type, title, body, data)
    select v_entry.user_id, 'waitlist_promoted', 'Tienes lugar!',
           format('Se libero un cupo en %s y ya esta reservado para ti.', c.title),
           jsonb_build_object('reservation_id', v_reservation.id, 'class_id', p_class_id)
    from public.classes c where c.id = p_class_id;
    return;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- smaller fixes
-- ---------------------------------------------------------------------------
-- close_finished_classes() auto-marks every booking 'attended' within ~15 min
-- of the class ending, so no-show must also work on 'attended' rows.
-- ponytail: achievements unlocked by the reverted class stay unlocked.
create or replace function mark_no_show(p_reservation_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_reservation public.reservations%rowtype;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v_reservation from public.reservations where id = p_reservation_id for update;
  if not found or v_reservation.status not in ('booked', 'attended') then
    raise exception 'reservation_not_markable';
  end if;

  update public.reservations set status = 'no_show' where id = p_reservation_id;

  if v_reservation.status = 'attended' then
    insert into public.xp_transactions (user_id, amount, type, reference_id)
    values (v_reservation.user_id, -100, 'class_completed', p_reservation_id);
  end if;
end;
$$;

create or replace function admin_adjust_credits(p_user_id uuid, p_amount int, p_note text default null) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;
  if (select coalesce(sum(amount), 0) from public.credit_transactions where user_id = p_user_id) + p_amount < 0 then
    raise exception 'negative_balance';
  end if;
  insert into public.credit_transactions (user_id, amount, type, note)
  values (p_user_id, p_amount, 'admin_adjustment', p_note);
end;
$$;

-- Bogota weeks (Monday 00:00 local), run right after midnight Monday in
-- Bogota. Expired members are evaluated too so their streak breaks instead
-- of freezing; distinct on guards against a user with several rows.
create or replace function update_weekly_streaks() returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_week_end timestamptz := date_trunc('week', now() at time zone 'America/Bogota') at time zone 'America/Bogota';
  v_week_start timestamptz := v_week_end - interval '1 week';
  v_member record;
  v_completed int;
  v_met boolean;
  v_new_streak int;
begin
  for v_member in
    select distinct on (user_id) user_id, weekly_goal from public.memberships
    where status in ('active', 'expired')
    order by user_id, created_at desc
  loop
    select count(*) into v_completed
    from public.reservations r join public.classes c on c.id = r.class_id
    where r.user_id = v_member.user_id and r.status = 'attended'
      and c.starts_at >= v_week_start and c.starts_at < v_week_end;

    v_met := v_completed >= v_member.weekly_goal;

    update public.user_stats
    set current_streak_weeks = case when v_met then current_streak_weeks + 1 else 0 end,
        updated_at = now()
    where user_id = v_member.user_id
    returning current_streak_weeks into v_new_streak;

    update public.user_stats set max_streak_weeks = greatest(max_streak_weeks, v_new_streak) where user_id = v_member.user_id;

    if v_met then
      insert into public.xp_transactions (user_id, amount, type) values (v_member.user_id, 100, 'weekly_goal');
      if v_new_streak > 1 then
        insert into public.xp_transactions (user_id, amount, type) values (v_member.user_id, 50, 'streak_bonus');
      end if;
      insert into public.notifications (user_id, type, title, body)
      values (v_member.user_id, 'streak', 'Racha mantenida!', format('%s semanas seguidas cumpliendo tu objetivo.', v_new_streak));
    end if;

    perform check_achievements(v_member.user_id);
  end loop;
end;
$$;

select cron.unschedule('update-weekly-streaks');
select cron.schedule('update-weekly-streaks', '5 5 * * 1', $$select update_weekly_streaks()$$);

-- ---------------------------------------------------------------------------
-- grants: internal helpers are not callable from the API
-- ---------------------------------------------------------------------------
revoke execute on function membership_covers(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function reset_credit_balance(uuid) from public, anon, authenticated;
revoke execute on function release_member_bookings(uuid) from public, anon, authenticated;
revoke execute on function set_membership_cycle_end() from public, anon, authenticated;
