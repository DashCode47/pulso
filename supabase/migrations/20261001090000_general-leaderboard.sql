-- Pulso: one all-time ranking + "te superaron" notifications
-- 1. leaderboard_weekly / leaderboard_monthly are replaced by a single
--    all-time `leaderboard` ordered by total XP -- the same number that
--    drives the level, so every XP source counts (classes, weekly goal,
--    streaks, achievements). Default view privileges (owner's, like the old
--    views) so it can read everyone's stats while user_stats stays "read own".
-- 2. Only active members with XP are ranked. rank() so a tie shares the
--    position: being tied isn't being overtaken.
-- 3. notify_overtaken() diffs the ranking against the last snapshot and
--    notifies whoever dropped while their own XP didn't go down (your own
--    no-show lowering your XP isn't "being overtaken").

drop view if exists leaderboard_weekly;
drop view if exists leaderboard_monthly;

create view leaderboard as
  select p.id as user_id, p.full_name, p.avatar_url, s.total_xp as xp,
         rank() over (order by s.total_xp desc)::int as rank
  from profiles p
  join user_stats s on s.user_id = p.id
  where s.total_xp > 0
    and exists (select 1 from memberships m where m.user_id = p.id and m.status = 'active')
  order by rank, p.full_name;

grant select on leaderboard to authenticated;

-- ---------------------------------------------------------------------------
-- overtaken notifications
-- ---------------------------------------------------------------------------
-- internal: RLS on, no policies, no grants
create table leaderboard_snapshot (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rank int not null,
  xp int not null
);
alter table leaderboard_snapshot enable row level security;

-- ponytail: one generic message per run, no names of who passed you; add
-- them if members ask "who?".
create or replace function notify_overtaken() returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  insert into public.notifications (user_id, type, title, body, data)
  select l.user_id, 'leaderboard', 'Te superaron en el ranking',
         format('Bajaste al puesto #%s. ¡Reserva una clase y recupéralo!', l.rank),
         jsonb_build_object('rank', l.rank)
  from public.leaderboard l
  join public.leaderboard_snapshot s on s.user_id = l.user_id
  where l.rank > s.rank and l.xp >= s.xp;

  delete from public.leaderboard_snapshot where true;
  insert into public.leaderboard_snapshot (user_id, rank, xp)
  select user_id, rank, xp from public.leaderboard;
end;
$$;

revoke execute on function notify_overtaken() from public, anon, authenticated;

-- first run only takes the snapshot (nothing to diff against yet)
select notify_overtaken();

-- a few minutes after close-finished-classes (*/15) so a class's XP is in
select cron.schedule('notify-overtaken', '7,22,37,52 * * * *', $$select notify_overtaken()$$);
