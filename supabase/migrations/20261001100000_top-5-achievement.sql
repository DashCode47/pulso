-- Pulso: "Top 3" becomes "Top 5", "50 Rides" becomes "20 Rides" + copy fixes
-- 1. top_3 ("finish a season in the Top 3") was never awarded: the ranking is
--    now a single all-time one with no seasons. It becomes top_5: reach the
--    Top 5 of the general ranking at any time. Checked like every other
--    achievement (after each class and in the Monday streak job), so you earn
--    it with the XP that puts you there. Kept once earned: dropping out of the
--    Top 5 later doesn't revoke it (revoke_unearned_achievements only touches
--    count-based ones).
-- 2. fifty_rides becomes twenty_rides (studio's call). Same rules otherwise:
--    a no-show that drops you below 20 revokes it, like the other
--    count-based ones.
-- 3. Spanish descriptions get their accents and lose the "streak" anglicism.
--    Names stay in English on purpose.

update achievements
set code = 'top_5', name = 'Top 5', description = 'Entra al Top 5 del ranking'
where code = 'top_3';

update achievements
set code = 'twenty_rides', name = '20 Rides', description = 'Completa 20 clases'
where code = 'fifty_rides';

update achievements set description = 'Mantén una racha de 7 semanas' where code = 'on_fire';
update achievements set description = 'Completa 5 clases desde las 19:00' where code = 'night_rider';

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
    ('twenty_rides', rides.completed >= 20),
    ('consistent', streak.weeks >= 4),
    ('on_fire', streak.weeks >= 7),
    ('early_bird', rides.early >= 5),
    ('night_rider', rides.night >= 5),
    ('top_5', exists (select 1 from public.leaderboard l where l.user_id = p_user_id and l.rank <= 5))
  ) as v(code, earned)
  where v.earned;
$$;

-- same function as before, with twenty_rides in the count-based list
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
      and a.code in ('first_ride', 'ten_rides', 'twenty_rides', 'early_bird', 'night_rider')
      and a.code not in (select earned_achievements(p_user_id))
    returning a.id, a.xp_reward
  loop
    insert into public.xp_transactions (user_id, amount, type, reference_id)
    values (p_user_id, -v_revoked.xp_reward, 'achievement', v_revoked.id);
  end loop;
end;
$$;

revoke execute on function earned_achievements(uuid) from public, anon, authenticated;
revoke execute on function revoke_unearned_achievements(uuid) from public, anon, authenticated;

-- members who already qualify (Top 5, 20+ classes) get them now instead of
-- after their next class
select check_achievements(user_id) from user_stats;
