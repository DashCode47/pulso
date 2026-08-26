-- Pulso: business logic
-- Every write to credits, XP, reservations, and waitlist happens through the
-- SECURITY DEFINER functions below, called via supabase.rpc(...) from the
-- client. RLS + missing GRANTs on the base tables deny direct client writes
-- to them (see previous migration), so there is no way to bypass this logic
-- from a compromised or buggy client.
--
-- Postgres grants EXECUTE on every new function to PUBLIC by default, which
-- would make internal helpers (unscoped by auth.uid(), trusting their
-- caller) directly callable by any authenticated user. The REVOKEs at the
-- bottom of this file close that off; only the user-facing RPCs keep an
-- explicit GRANT.

-- ---------------------------------------------------------------------------
-- level formula: flat 500 XP per level. Tune the divisor here if the pacing
-- feels off -- nothing else in the schema depends on the exact curve.
-- ---------------------------------------------------------------------------
create or replace function xp_to_level(p_xp int) returns int
language sql immutable as $$
  select greatest(1, floor(p_xp / 500.0)::int + 1);
$$;

-- ---------------------------------------------------------------------------
-- user_stats is a read cache rebuilt from the ledgers on every write, never
-- edited directly. This trades a few redundant recomputes (irrelevant at
-- 60-80 users) for zero risk of the cache drifting from the ledgers.
-- ---------------------------------------------------------------------------
create or replace function sync_user_stats() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_user_id uuid := coalesce(new.user_id, old.user_id);
  v_xp int;
begin
  select coalesce(sum(amount), 0) into v_xp from public.xp_transactions where user_id = v_user_id;

  insert into public.user_stats (user_id, total_xp, current_level, classes_completed, credits_balance, updated_at)
  values (
    v_user_id,
    v_xp,
    xp_to_level(v_xp),
    (select count(*) from public.reservations where user_id = v_user_id and status = 'attended'),
    (select coalesce(sum(amount), 0) from public.credit_transactions where user_id = v_user_id),
    now()
  )
  on conflict (user_id) do update set
    total_xp = excluded.total_xp,
    current_level = excluded.current_level,
    classes_completed = excluded.classes_completed,
    credits_balance = excluded.credits_balance,
    updated_at = now();
  return null;
end;
$$;

create trigger sync_stats_on_xp
  after insert on xp_transactions
  for each row execute function sync_user_stats();

create trigger sync_stats_on_credit
  after insert on credit_transactions
  for each row execute function sync_user_stats();

create trigger sync_stats_on_reservation
  after update of status on reservations
  for each row when (new.status = 'attended' or old.status = 'attended')
  execute function sync_user_stats();

-- seed a zeroed stats row as soon as a membership exists, so later ledger
-- inserts always have a row to UPSERT into and the weekly-streak job never
-- skips a member for lack of a row.
create or replace function seed_user_stats() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  insert into public.user_stats (user_id) values (new.user_id) on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger memberships_seed_user_stats
  after insert on memberships
  for each row execute function seed_user_stats();

-- ---------------------------------------------------------------------------
-- achievements
-- ---------------------------------------------------------------------------
create or replace function unlock_achievement(p_user_id uuid, p_code text) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_achievement public.achievements%rowtype;
begin
  select * into v_achievement from public.achievements where code = p_code;
  if v_achievement is null then
    return;
  end if;

  insert into public.user_achievements (user_id, achievement_id)
  values (p_user_id, v_achievement.id)
  on conflict (user_id, achievement_id) do nothing;

  if found then
    insert into public.xp_transactions (user_id, amount, type, reference_id)
    values (p_user_id, v_achievement.xp_reward, 'achievement', v_achievement.id);

    insert into public.notifications (user_id, type, title, body, data)
    values (p_user_id, 'achievement', 'Nuevo logro desbloqueado', v_achievement.name,
            jsonb_build_object('achievement_id', v_achievement.id));
  end if;
end;
$$;

create or replace function check_achievements(p_user_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_stats public.user_stats%rowtype;
  v_early_bird_count int;
  v_night_rider_count int;
begin
  select * into v_stats from public.user_stats where user_id = p_user_id;
  if v_stats is null then
    return;
  end if;

  if v_stats.classes_completed >= 1 then perform unlock_achievement(p_user_id, 'first_ride'); end if;
  if v_stats.classes_completed >= 10 then perform unlock_achievement(p_user_id, 'ten_rides'); end if;
  if v_stats.classes_completed >= 50 then perform unlock_achievement(p_user_id, 'fifty_rides'); end if;
  if v_stats.current_streak_weeks >= 7 then perform unlock_achievement(p_user_id, 'on_fire'); end if;
  if v_stats.current_streak_weeks >= 4 then perform unlock_achievement(p_user_id, 'consistent'); end if;

  select count(*) into v_early_bird_count
  from public.reservations r join public.classes c on c.id = r.class_id
  where r.user_id = p_user_id and r.status = 'attended' and extract(hour from c.starts_at) < 9;
  if v_early_bird_count >= 5 then perform unlock_achievement(p_user_id, 'early_bird'); end if;

  select count(*) into v_night_rider_count
  from public.reservations r join public.classes c on c.id = r.class_id
  where r.user_id = p_user_id and r.status = 'attended' and extract(hour from c.starts_at) >= 19;
  if v_night_rider_count >= 5 then perform unlock_achievement(p_user_id, 'night_rider'); end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- waitlist
-- ---------------------------------------------------------------------------
create or replace function offer_next_waitlist(p_class_id uuid, p_bike_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_entry public.waitlist_entries%rowtype;
begin
  select * into v_entry from public.waitlist_entries
  where class_id = p_class_id and status = 'waiting'
  order by created_at
  limit 1
  for update skip locked;

  if v_entry is null then
    return;
  end if;

  update public.waitlist_entries
  set status = 'offered', bike_id = p_bike_id, offer_expires_at = now() + interval '15 minutes'
  where id = v_entry.id;

  insert into public.notifications (user_id, type, title, body, data)
  values (v_entry.user_id, 'waitlist_offer', 'Se libero una bicicleta',
          'Tienes 15 minutos para reclamarla.',
          jsonb_build_object('waitlist_entry_id', v_entry.id, 'class_id', p_class_id));
end;
$$;

create or replace function expire_waitlist_offers() returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_entry record;
begin
  for v_entry in select * from public.waitlist_entries where status = 'offered' and offer_expires_at < now() loop
    update public.waitlist_entries set status = 'expired' where id = v_entry.id;
    perform offer_next_waitlist(v_entry.class_id, v_entry.bike_id);
  end loop;
end;
$$;

create or replace function join_waitlist(p_class_id uuid) returns waitlist_entries
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_entry public.waitlist_entries%rowtype;
begin
  insert into public.waitlist_entries (class_id, user_id) values (p_class_id, auth.uid())
  returning * into v_entry;
  return v_entry;
exception when unique_violation then
  raise exception 'already_on_waitlist';
end;
$$;
grant execute on function join_waitlist(uuid) to authenticated;

create or replace function leave_waitlist(p_waitlist_entry_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  update public.waitlist_entries set status = 'cancelled'
  where id = p_waitlist_entry_id and user_id = auth.uid() and status in ('waiting', 'offered');
end;
$$;
grant execute on function leave_waitlist(uuid) to authenticated;

create or replace function claim_waitlist_offer(p_waitlist_entry_id uuid) returns reservations
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_entry public.waitlist_entries%rowtype;
  v_reservation public.reservations%rowtype;
  v_balance int;
begin
  perform 1 from public.memberships where user_id = auth.uid() and status = 'active' for update;

  select * into v_entry from public.waitlist_entries
  where id = p_waitlist_entry_id and user_id = auth.uid() and status = 'offered';
  if v_entry is null or v_entry.offer_expires_at < now() then
    raise exception 'offer_not_available';
  end if;

  select coalesce(sum(amount), 0) into v_balance from public.credit_transactions where user_id = auth.uid();
  if v_balance < 1 then
    raise exception 'insufficient_credits';
  end if;

  begin
    insert into public.reservations (class_id, user_id, bike_id)
    values (v_entry.class_id, auth.uid(), v_entry.bike_id)
    returning * into v_reservation;
  exception when unique_violation then
    raise exception 'bike_or_class_unavailable';
  end;

  insert into public.credit_transactions (user_id, amount, type, reference_id)
  values (auth.uid(), -1, 'booking', v_reservation.id);

  update public.waitlist_entries set status = 'claimed' where id = p_waitlist_entry_id;

  return v_reservation;
end;
$$;
grant execute on function claim_waitlist_offer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- booking
-- ---------------------------------------------------------------------------
create or replace function book_class(p_class_id uuid, p_bike_id uuid) returns reservations
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_class public.classes%rowtype;
  v_balance int;
  v_reservation public.reservations%rowtype;
begin
  if not exists (select 1 from public.memberships where user_id = auth.uid() and status = 'active') then
    raise exception 'no_active_membership';
  end if;
  -- serializes concurrent booking calls from the same user so a double-tap
  -- can't spend the same credit twice
  perform 1 from public.memberships where user_id = auth.uid() and status = 'active' for update;

  select * into v_class from public.classes where id = p_class_id;
  if v_class is null or v_class.status <> 'scheduled' then
    raise exception 'class_not_available';
  end if;
  if v_class.starts_at <= now() then
    raise exception 'class_already_started';
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
grant execute on function book_class(uuid, uuid) to authenticated;

create or replace function cancel_reservation(p_reservation_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_reservation public.reservations%rowtype;
  v_class public.classes%rowtype;
  v_cutoff interval := interval '2 hours'; -- tune here if the studio wants a different window
begin
  select * into v_reservation from public.reservations where id = p_reservation_id and user_id = auth.uid();
  if v_reservation is null then
    raise exception 'reservation_not_found';
  end if;
  if v_reservation.status <> 'booked' then
    raise exception 'reservation_not_active';
  end if;

  select * into v_class from public.classes where id = v_reservation.class_id;
  if v_class.starts_at - now() < v_cutoff then
    raise exception 'cancellation_window_closed';
  end if;

  update public.reservations set status = 'cancelled', cancelled_at = now() where id = p_reservation_id;

  insert into public.credit_transactions (user_id, amount, type, reference_id)
  values (auth.uid(), 1, 'cancel_refund', p_reservation_id);

  perform offer_next_waitlist(v_reservation.class_id, v_reservation.bike_id);
end;
$$;
grant execute on function cancel_reservation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- attendance -- there is no check-in hardware/QR, so the default is
-- optimistic: a booked reservation becomes "attended" automatically once the
-- class ends. Staff only has to act on the exception (mark a no-show), never
-- on the common case.
-- ---------------------------------------------------------------------------
create or replace function award_class_completion(p_reservation_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id from public.reservations where id = p_reservation_id;

  insert into public.xp_transactions (user_id, amount, type, reference_id)
  values (v_user_id, 100, 'class_completed', p_reservation_id);

  perform check_achievements(v_user_id);
end;
$$;

create or replace function close_finished_classes() returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_class record;
  v_reservation record;
begin
  for v_class in
    select * from public.classes
    where status = 'scheduled' and starts_at + (duration_minutes || ' minutes')::interval < now()
  loop
    for v_reservation in select * from public.reservations where class_id = v_class.id and status = 'booked' loop
      update public.reservations set status = 'attended' where id = v_reservation.id;
      perform award_class_completion(v_reservation.id);
    end loop;

    update public.classes set status = 'completed' where id = v_class.id;
  end loop;
end;
$$;

create or replace function mark_no_show(p_reservation_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;
  update public.reservations set status = 'no_show' where id = p_reservation_id and status = 'booked';
end;
$$;
grant execute on function mark_no_show(uuid) to authenticated;

create or replace function admin_adjust_credits(p_user_id uuid, p_amount int, p_note text default null) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;
  insert into public.credit_transactions (user_id, amount, type, note)
  values (p_user_id, p_amount, 'admin_adjustment', p_note);
end;
$$;
grant execute on function admin_adjust_credits(uuid, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- weekly streaks -- evaluated every Monday for the week that just ended.
-- ---------------------------------------------------------------------------
create or replace function update_weekly_streaks() returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_week_start timestamptz := date_trunc('week', now()) - interval '1 week';
  v_week_end timestamptz := date_trunc('week', now());
  v_member record;
  v_completed int;
  v_met boolean;
  v_new_streak int;
begin
  for v_member in select user_id, weekly_goal from public.memberships where status = 'active' loop
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

-- ---------------------------------------------------------------------------
-- monthly credit grant -- runs daily, fires for whichever memberships have
-- their cycle anniversary today.
-- ponytail: day-31 anniversaries skip short months instead of rolling to the
-- 1st; fine for a manually-managed 60-80 member gym, revisit if billing gets
-- automated.
-- ---------------------------------------------------------------------------
create or replace function grant_monthly_credits() returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_membership record;
begin
  for v_membership in
    select * from public.memberships where status = 'active' and extract(day from cycle_start) = extract(day from now())
  loop
    insert into public.credit_transactions (user_id, amount, type) values (v_membership.user_id, v_membership.credits_per_cycle, 'grant');
    insert into public.notifications (user_id, type, title, body)
    values (v_membership.user_id, 'credits', 'Creditos renovados', format('Recibiste %s creditos este mes.', v_membership.credits_per_cycle));
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- class reminders -- 1 hour before start, once per reservation.
-- ---------------------------------------------------------------------------
create or replace function queue_class_reminders() returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  insert into public.notifications (user_id, type, title, body, data)
  select r.user_id, 'reminder', 'Tu clase empieza pronto', format('%s comienza en 1 hora.', c.title),
         jsonb_build_object('reservation_id', r.id, 'class_id', c.id)
  from public.reservations r
  join public.classes c on c.id = r.class_id
  where r.status = 'booked'
    and c.starts_at between now() + interval '55 minutes' and now() + interval '65 minutes'
    and not exists (
      select 1 from public.notifications n where n.type = 'reminder' and n.data ->> 'reservation_id' = r.id::text
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- Lock down internal helpers. Postgres grants EXECUTE on every new function
-- to PUBLIC by default -- these functions trust their caller (arbitrary
-- user_id/class_id args, no auth.uid() scoping) or exist purely for
-- triggers/cron, so leaving them PUBLIC-executable would let any
-- authenticated user call them directly (e.g. award themselves an
-- achievement, or force early XP/streak processing for everyone).
-- ---------------------------------------------------------------------------
revoke execute on function offer_next_waitlist(uuid, uuid) from public;
revoke execute on function expire_waitlist_offers() from public;
revoke execute on function award_class_completion(uuid) from public;
revoke execute on function close_finished_classes() from public;
revoke execute on function unlock_achievement(uuid, text) from public;
revoke execute on function check_achievements(uuid) from public;
revoke execute on function update_weekly_streaks() from public;
revoke execute on function grant_monthly_credits() from public;
revoke execute on function queue_class_reminders() from public;
revoke execute on function sync_user_stats() from public;
revoke execute on function seed_user_stats() from public;

-- ---------------------------------------------------------------------------
-- Scheduled jobs. Requires the pg_cron extension enabled under
-- Database > Extensions on hosted Supabase projects.
-- Not scheduled here: "leaderboard overtaken" notifications -- needs a
-- ranking snapshot to diff against, add if the studio actually wants it.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule('close-finished-classes', '*/15 * * * *', $$select close_finished_classes()$$);
select cron.schedule('expire-waitlist-offers', '*/5 * * * *', $$select expire_waitlist_offers()$$);
select cron.schedule('queue-class-reminders', '*/5 * * * *', $$select queue_class_reminders()$$);
select cron.schedule('grant-monthly-credits', '0 3 * * *', $$select grant_monthly_credits()$$);
select cron.schedule('update-weekly-streaks', '5 0 * * 1', $$select update_weekly_streaks()$$);
