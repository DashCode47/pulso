-- Pulso: rankings based on attendance only
-- (Superseded by *general-leaderboard.sql: one all-time ranking by total XP.
-- Kept because it's already applied on the remote project.)
-- 1. Only class XP ('class_completed', including the -100 a no-show writes)
--    counts toward the weekly/monthly ranking. Bonuses (weekly goal, streak,
--    achievements) still raise total XP and level, but don't decide the
--    ranking: the weekly-goal bonus is paid Monday 00:05 and would otherwise
--    start every new week with a head start.
-- 2. XP is attributed to the week/month of the class, not the moment the row
--    was written, so a no-show marked days later is subtracted from the right
--    period.
-- 3. Only members with an active membership are ranked (no admins, no
--    ex-members), with the avatar and a precomputed rank for the app.

create or replace view leaderboard_weekly as
  with class_xp as (
    select x.user_id, sum(x.amount)::int as xp
    from xp_transactions x
    join reservations r on r.id = x.reference_id
    join classes c on c.id = r.class_id
    where x.type = 'class_completed'
      and c.starts_at >= date_trunc('week', now() at time zone 'America/Bogota') at time zone 'America/Bogota'
    group by x.user_id
  )
  select p.id as user_id, p.full_name, coalesce(cx.xp, 0) as xp, p.avatar_url,
         -- ponytail: ties broken alphabetically; switch to "reached it first" if members complain
         row_number() over (order by coalesce(cx.xp, 0) desc, p.full_name)::int as rank
  from profiles p
  left join class_xp cx on cx.user_id = p.id
  where exists (select 1 from memberships m where m.user_id = p.id and m.status = 'active')
  order by rank;

create or replace view leaderboard_monthly as
  with class_xp as (
    select x.user_id, sum(x.amount)::int as xp
    from xp_transactions x
    join reservations r on r.id = x.reference_id
    join classes c on c.id = r.class_id
    where x.type = 'class_completed'
      and c.starts_at >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota'
    group by x.user_id
  )
  select p.id as user_id, p.full_name, coalesce(cx.xp, 0) as xp, p.avatar_url,
         row_number() over (order by coalesce(cx.xp, 0) desc, p.full_name)::int as rank
  from profiles p
  left join class_xp cx on cx.user_id = p.id
  where exists (select 1 from memberships m where m.user_id = p.id and m.status = 'active')
  order by rank;
