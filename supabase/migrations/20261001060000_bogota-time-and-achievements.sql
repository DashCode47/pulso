-- Pulso: Bogota time everywhere + achievements never come from a no-show
-- 1. early_bird / night_rider read the class hour in UTC (07:00 Bogota is
--    12:00 UTC), and the weekly/monthly leaderboards reset on UTC
--    boundaries (Sunday 19:00 Bogota). Both now use America/Bogota.
-- 2. Achievement rules live in one place (earned_achievements) so unlocking
--    and revoking can't drift. A no-show on an auto-attended class revokes
--    any count-based achievement it had unlocked, with its XP.
-- 3. One-time cleanup of bookings made before the membership-period rule:
--    members without an active membership are released exactly like an
--    expiry; active members get bookings outside their period cancelled and
--    refunded (they paid a credit for them in good faith).

-- ---------------------------------------------------------------------------
-- achievements
-- ---------------------------------------------------------------------------
create or replace function earned_achievements(p_user_id uuid) returns setof text
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  with rides as (
    select
      count(*) as completed,
      count(*) filter (where extract(hour from c.starts_at at time zone 'America/Bogota') < 9) as early,
      count(*) filter (where extract(hour from c.starts_at at time zone 'America/Bogota') >= 19) as night
    from public.reservations r join public.classes c on c.id = r.class_id
    where r.user_id = p_user_id and r.status = 'attended'
  ), streak as (
    select coalesce((select current_streak_weeks from public.user_stats where user_id = p_user_id), 0) as weeks
  )
  select v.code
  from rides, streak, lateral (values
    ('first_ride', rides.completed >= 1),
    ('ten_rides', rides.completed >= 10),
    ('fifty_rides', rides.completed >= 50),
    ('consistent', streak.weeks >= 4),
    ('on_fire', streak.weeks >= 7),
    ('early_bird', rides.early >= 5),
    ('night_rider', rides.night >= 5)
  ) as v(code, earned)
  where v.earned;
$$;

create or replace function check_achievements(p_user_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_code text;
begin
  for v_code in select earned_achievements(p_user_id) loop
    perform unlock_achievement(p_user_id, v_code);
  end loop;
end;
$$;

-- Streak achievements are left alone: the streak resets by design over time,
-- so "not earned now" doesn't mean "never earned".
-- ponytail: a no-show marked after Monday's streak job doesn't undo that
-- week's streak; mark no-shows the same day.
create or replace function revoke_unearned_achievements(p_user_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_revoked record;
begin
  for v_revoked in
    delete from public.user_achievements ua
    using public.achievements a
    where ua.achievement_id = a.id and ua.user_id = p_user_id
      and a.code in ('first_ride', 'ten_rides', 'fifty_rides', 'early_bird', 'night_rider')
      and a.code not in (select earned_achievements(p_user_id))
    returning a.id, a.xp_reward
  loop
    insert into public.xp_transactions (user_id, amount, type, reference_id)
    values (p_user_id, -v_revoked.xp_reward, 'achievement', v_revoked.id);
  end loop;
end;
$$;

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

  -- close_finished_classes() auto-marks bookings 'attended' right after the
  -- class, awarding XP and achievements: undo both.
  if v_reservation.status = 'attended' then
    insert into public.xp_transactions (user_id, amount, type, reference_id)
    values (v_reservation.user_id, -100, 'class_completed', p_reservation_id);
    perform revoke_unearned_achievements(v_reservation.user_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- leaderboards on Bogota week/month boundaries
-- ---------------------------------------------------------------------------
create or replace view leaderboard_weekly as
  select p.id as user_id, p.full_name, coalesce(sum(x.amount), 0)::int as xp
  from profiles p
  left join xp_transactions x
    on x.user_id = p.id
    and x.created_at >= date_trunc('week', now() at time zone 'America/Bogota') at time zone 'America/Bogota'
  group by p.id, p.full_name
  order by xp desc;

create or replace view leaderboard_monthly as
  select p.id as user_id, p.full_name, coalesce(sum(x.amount), 0)::int as xp
  from profiles p
  left join xp_transactions x
    on x.user_id = p.id
    and x.created_at >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota'
  group by p.id, p.full_name
  order by xp desc;

-- ---------------------------------------------------------------------------
-- one-time cleanup of bookings outside the paid period
-- ---------------------------------------------------------------------------
create or replace function release_uncovered_bookings() returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_member record;
  v_reservation record;
begin
  -- no active membership: same as an expiry (bookings, waitlist, credits)
  for v_member in
    select distinct m.user_id from public.memberships m
    where not exists (select 1 from public.memberships a where a.user_id = m.user_id and a.status = 'active')
  loop
    perform release_member_bookings(v_member.user_id);
  end loop;

  -- active membership: refund only the bookings outside its period
  for v_reservation in
    select r.id, r.user_id, r.class_id, r.bike_id, c.title
    from public.reservations r join public.classes c on c.id = r.class_id
    where r.status = 'booked' and c.starts_at > now()
      and not membership_covers(r.user_id, c.starts_at)
    for update of r
  loop
    update public.reservations set status = 'cancelled', cancelled_at = now() where id = v_reservation.id;

    insert into public.credit_transactions (user_id, amount, type, reference_id)
    values (v_reservation.user_id, 1, 'cancel_refund', v_reservation.id);

    insert into public.notifications (user_id, type, title, body, data)
    values (v_reservation.user_id, 'membership', 'Reserva cancelada',
            format('%s cae fuera del periodo de tu membresia. Te devolvimos el credito.', v_reservation.title),
            jsonb_build_object('reservation_id', v_reservation.id));

    perform promote_from_waitlist(v_reservation.class_id, v_reservation.bike_id);
  end loop;

  update public.waitlist_entries w set status = 'cancelled'
  from public.classes c
  where c.id = w.class_id and w.status = 'waiting' and not membership_covers(w.user_id, c.starts_at);
end;
$$;

select release_uncovered_bookings();

-- ---------------------------------------------------------------------------
-- grants: internal helpers are not callable from the API
-- ---------------------------------------------------------------------------
revoke execute on function earned_achievements(uuid) from public, anon, authenticated;
revoke execute on function revoke_unearned_achievements(uuid) from public, anon, authenticated;
revoke execute on function release_uncovered_bookings() from public, anon, authenticated;
