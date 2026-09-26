-- Pulso: booking hardening + auto-promoting waitlist + configurable cancel window
--
-- 1. Availability was computed client-side from `reservations`, but RLS only
--    lets a member read their OWN rows -- so every bike looked free and no
--    class ever looked full to a non-admin. Two members "collided" because
--    the app never showed them the other's booking. class_availability()
--    (SECURITY DEFINER) returns the real picture without exposing who booked.
-- 2. cancel_reservation() didn't lock the row: a double-tapped cancel could
--    refund the credit twice.
-- 3. Cancel window moves from a hardcoded 2h to studio_settings (default 12h).
-- 4. Waitlist switches from "15-min offer to claim" to auto-promotion: nothing
--    delivers push notifications yet, so offers expired unseen. A freed spot
--    now goes straight to the first waiting member with credits. Since spots
--    only free up via member cancellation (which closes at the cutoff), a
--    promoted member always still has time to cancel themselves.

-- ---------------------------------------------------------------------------
-- studio_settings: single row (id is always true)
-- ---------------------------------------------------------------------------
create table studio_settings (
  id boolean primary key default true check (id),
  cancellation_cutoff_hours int not null default 12 check (cancellation_cutoff_hours between 0 and 168)
);
insert into studio_settings default values;

alter table studio_settings enable row level security;
create policy "read settings" on studio_settings for select to authenticated using (true);
create policy "admin update settings" on studio_settings for update to authenticated
  using (is_admin()) with check (is_admin());
grant select, update on studio_settings to authenticated;

create or replace function cancellation_cutoff() returns interval
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select make_interval(hours => cancellation_cutoff_hours) from public.studio_settings;
$$;

-- ---------------------------------------------------------------------------
-- availability for every upcoming class, in one round trip
-- ---------------------------------------------------------------------------
create or replace function class_availability()
returns table (
  class_id uuid,
  taken_bike_ids uuid[],
  booked_count int,
  my_reservation_id uuid,
  my_bike_id uuid,
  my_waitlist_entry_id uuid,
  my_waitlist_position int,
  cancel_deadline timestamptz
)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select
    c.id,
    coalesce(array_agg(r.bike_id) filter (where r.id is not null), '{}'),
    count(r.id)::int,
    (array_agg(r.id) filter (where r.user_id = auth.uid()))[1],
    (array_agg(r.bike_id) filter (where r.user_id = auth.uid()))[1],
    w.id,
    w.position,
    c.starts_at - cancellation_cutoff()
  from public.classes c
  left join public.reservations r on r.class_id = c.id and r.status = 'booked'
  left join lateral (
    select we.id,
      (select count(*) from public.waitlist_entries w2
       where w2.class_id = c.id and w2.status = 'waiting' and w2.created_at <= we.created_at)::int as position
    from public.waitlist_entries we
    where we.class_id = c.id and we.user_id = auth.uid() and we.status = 'waiting'
  ) w on true
  where c.status = 'scheduled' and c.starts_at > now()
  group by c.id, c.starts_at, w.id, w.position;
$$;

-- ---------------------------------------------------------------------------
-- waitlist
-- ---------------------------------------------------------------------------
-- Booking (directly or via promotion) takes you off that class's waitlist.
create or replace function clear_waitlist_on_booking() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  update public.waitlist_entries set status = 'claimed', bike_id = new.bike_id
  where class_id = new.class_id and user_id = new.user_id and status = 'waiting';
  return null;
end;
$$;
create trigger reservations_clear_waitlist
  after insert on reservations
  for each row execute function clear_waitlist_on_booking();

create or replace function promote_from_waitlist(p_class_id uuid, p_bike_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_entry record;
  v_reservation public.reservations%rowtype;
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
    where user_id = v_entry.user_id and status = 'active' and cycle_end >= current_date
    for update skip locked;
    continue when not found;
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

create or replace function join_waitlist(p_class_id uuid) returns waitlist_entries
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_class public.classes%rowtype;
  v_entry public.waitlist_entries%rowtype;
begin
  if not exists (select 1 from public.memberships where user_id = auth.uid() and status = 'active' and cycle_end >= current_date) then
    raise exception 'no_active_membership';
  end if;

  select * into v_class from public.classes where id = p_class_id;
  if not found or v_class.status <> 'scheduled' or v_class.starts_at <= now() then
    raise exception 'class_not_available';
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

create or replace function leave_waitlist(p_waitlist_entry_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  update public.waitlist_entries set status = 'cancelled'
  where id = p_waitlist_entry_id and user_id = auth.uid() and status = 'waiting';
  if not found then
    raise exception 'waitlist_entry_not_found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancellation
-- ---------------------------------------------------------------------------
create or replace function cancel_reservation(p_reservation_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_reservation public.reservations%rowtype;
begin
  -- row lock: a concurrent second cancel waits here, then sees 'cancelled'
  -- and fails instead of refunding twice
  select * into v_reservation from public.reservations
  where id = p_reservation_id and user_id = auth.uid()
  for update;
  if not found then
    raise exception 'reservation_not_found';
  end if;
  if v_reservation.status <> 'booked' then
    raise exception 'reservation_not_active';
  end if;

  if now() > (select starts_at from public.classes where id = v_reservation.class_id) - cancellation_cutoff() then
    raise exception 'cancellation_window_closed';
  end if;

  update public.reservations set status = 'cancelled', cancelled_at = now() where id = p_reservation_id;

  insert into public.credit_transactions (user_id, amount, type, reference_id)
  values (auth.uid(), 1, 'cancel_refund', p_reservation_id);

  perform promote_from_waitlist(v_reservation.class_id, v_reservation.bike_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- retire the offer/claim flow
-- ---------------------------------------------------------------------------
select cron.unschedule('expire-waitlist-offers');
drop function claim_waitlist_offer(uuid);
drop function expire_waitlist_offers();
drop function offer_next_waitlist(uuid, uuid);
update waitlist_entries set status = 'cancelled' where status = 'offered';

-- ---------------------------------------------------------------------------
-- grants (Supabase grants EXECUTE to PUBLIC/anon/authenticated by default --
-- see harden-function-grants migration)
-- ---------------------------------------------------------------------------
revoke execute on function cancellation_cutoff() from public, anon, authenticated;
revoke execute on function clear_waitlist_on_booking() from public, anon, authenticated;
revoke execute on function promote_from_waitlist(uuid, uuid) from public, anon, authenticated;

revoke execute on function class_availability() from public, anon;
grant execute on function class_availability() to authenticated;
revoke execute on function join_waitlist(uuid) from public, anon;
grant execute on function join_waitlist(uuid) to authenticated;
revoke execute on function leave_waitlist(uuid) from public, anon;
grant execute on function leave_waitlist(uuid) to authenticated;
revoke execute on function cancel_reservation(uuid) from public, anon;
grant execute on function cancel_reservation(uuid) to authenticated;
