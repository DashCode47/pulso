-- Pulso: achievements configurable from the admin panel
-- Until now each achievement's rule was hardcoded by `code` in
-- earned_achievements(), and the app mirrored the targets. Rules become data:
-- every card picks a rule type from a fixed list plus its own numbers, so
-- the admin can create any number of cards ("1 class", "20 classes", "10
-- classes with Ana"...) without a migration.
--
-- Rules (rule -> what `threshold` means):
--   classes_total            N attended classes
--   classes_before_hour      N classes starting before `hour` (Bogota)
--   classes_from_hour        N classes starting at/after `hour` (Bogota)
--   classes_with_instructor  N classes with `instructor_id`
--   distinct_instructors     classes with N different instructors
--   classes_on_weekday       N classes on `weekday` (ISO: 1 = Monday)
--   classes_in_week          N classes within one Bogota week
--   streak_weeks             N consecutive weeks meeting the weekly goal
--   leaderboard_top          be in the Top N of the ranking
--
-- Dates (Bogota calendar days, both inclusive):
--   starts_on null = "all time": every class ever counts. With a date, only
--   classes from that day on count, and the card stays hidden until then.
--   ends_on null = open-ended. With a date it's a limited card: only classes
--   up to that day count, and members who didn't earn it stop seeing it
--   after it ends.
--   Streak cards with dates count consecutive weeks inside the window (weeks
--   that already ended, goal = the member's current weekly_goal); without
--   dates they use the streak already tracked in user_stats. Ranking cards
--   with dates only unlock while today is inside the window.
--
-- Product rules:
--   - Achievement XP is permanent: a no-show no longer revokes achievements
--     (it still takes back the class's own 100 XP).
--   - A card can't be edited once anyone has unlocked it (achievement_locked).
--   - Removing a card is a soft delete (deleted_at): it disappears for
--     everyone, members keep the XP. Removed cards can't come back.
--   - Creating or editing a card re-checks every member right away, so
--     anyone who already qualifies gets it without waiting for their next
--     class.

-- ---------------------------------------------------------------------------
-- schema
-- ---------------------------------------------------------------------------
alter table achievements
  alter column code drop not null, -- legacy cards keep theirs; new ones have none
  add column rule text,
  add column threshold int,
  add column hour smallint,
  add column instructor_id uuid references instructors(id),
  add column weekday smallint,
  add column starts_on date,
  add column ends_on date,
  add column icon text not null default 'trophy',
  add column deleted_at timestamptz,
  add column created_at timestamptz not null default now();

update achievements a set rule = v.rule, threshold = v.threshold, hour = v.hour, icon = v.icon
from (values
  ('first_ride', 'classes_total', 1, null::smallint, 'bicycle'),
  ('ten_rides', 'classes_total', 10, null, 'bicycle'),
  ('twenty_rides', 'classes_total', 20, null, 'medal'),
  ('consistent', 'streak_weeks', 4, null, 'flag'),
  ('on_fire', 'streak_weeks', 7, null, 'fire'),
  ('early_bird', 'classes_before_hour', 5, 9, 'sun'),
  ('night_rider', 'classes_from_hour', 5, 19, 'moon'),
  ('top_5', 'leaderboard_top', 5, null, 'ranking')
) as v(code, rule, threshold, hour, icon)
where a.code = v.code;

alter table achievements
  alter column rule set not null,
  alter column threshold set not null,
  add constraint achievements_rule_check check (rule in (
    'classes_total', 'classes_before_hour', 'classes_from_hour', 'classes_with_instructor',
    'distinct_instructors', 'classes_on_weekday', 'classes_in_week', 'streak_weeks', 'leaderboard_top')),
  add constraint achievements_threshold_check check (threshold > 0),
  add constraint achievements_xp_check check (xp_reward >= 0),
  add constraint achievements_name_check check (btrim(name) <> ''),
  add constraint achievements_hour_check check (
    (hour is not null) = (rule in ('classes_before_hour', 'classes_from_hour')) and (hour is null or hour between 0 and 23)),
  add constraint achievements_instructor_check check ((instructor_id is not null) = (rule = 'classes_with_instructor')),
  add constraint achievements_weekday_check check (
    (weekday is not null) = (rule = 'classes_on_weekday') and (weekday is null or weekday between 1 and 7)),
  add constraint achievements_dates_check check (starts_on is null or ends_on is null or ends_on >= starts_on),
  add constraint achievements_icon_check check (icon in (
    'trophy', 'medal', 'bicycle', 'fire', 'flag', 'lightning', 'sun', 'moon', 'ranking', 'users', 'calendar', 'clock'));

-- ---------------------------------------------------------------------------
-- rule engine
-- ---------------------------------------------------------------------------
-- One row per live card (not removed, already started): the member's
-- progress toward it and whether it's earned. progress is the rank for
-- leaderboard_top (null = not ranked), a count for every other rule.
create or replace function achievement_progress(p_user_id uuid)
returns table (achievement_id uuid, progress int, earned boolean)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  with rides as (
    select c.starts_at at time zone 'America/Bogota' as local_at, c.instructor_id
    from public.reservations r join public.classes c on c.id = r.class_id
    where r.user_id = p_user_id and r.status = 'attended'
  ), ctx as (
    select
      (now() at time zone 'America/Bogota')::date as today,
      date_trunc('week', now() at time zone 'America/Bogota') as this_monday,
      coalesce((select m.weekly_goal from public.memberships m where m.user_id = p_user_id
                order by m.created_at desc limit 1), 3) as weekly_goal,
      coalesce((select greatest(s.max_streak_weeks, s.current_streak_weeks) from public.user_stats s
                where s.user_id = p_user_id), 0) as tracked_streak,
      (select l.rank::int from public.leaderboard l where l.user_id = p_user_id) as rank
  ), cards as (
    select a.*, ctx.*,
      coalesce(a.starts_on, '-infinity'::date) as win_from,
      coalesce(a.ends_on, 'infinity'::date) as win_to
    from public.achievements a, ctx
    where a.deleted_at is null and (a.starts_on is null or a.starts_on <= ctx.today)
  ), measured as (
    select k.id, k.rule, k.threshold, k.rank, k.today, k.win_from, k.win_to,
      case k.rule
        when 'classes_total' then c.total
        when 'classes_before_hour' then c.before_hour
        when 'classes_from_hour' then c.from_hour
        when 'classes_with_instructor' then c.with_instructor
        when 'distinct_instructors' then c.instructors
        when 'classes_on_weekday' then c.on_weekday
        when 'classes_in_week' then (
          select coalesce(max(q.n), 0) from (
            select count(*) as n from rides w
            where w.local_at::date between k.win_from and k.win_to
            group by date_trunc('week', w.local_at)
          ) q)
        when 'streak_weeks' then
          case when k.starts_on is null and k.ends_on is null then k.tracked_streak
          else (
            -- longest run of consecutive finished weeks meeting the goal
            select coalesce(max(g.len), 0) from (
              select count(*) as len from (
                select q.wk - (row_number() over (order by q.wk))::int * interval '1 week' as grp
                from (
                  select date_trunc('week', w.local_at) as wk from rides w
                  where w.local_at::date between k.win_from and k.win_to and w.local_at < k.this_monday
                  group by 1 having count(*) >= k.weekly_goal
                ) q
              ) r group by r.grp
            ) g)
          end
        when 'leaderboard_top' then k.rank
      end::int as progress
    from cards k
    cross join lateral (
      select
        count(*) as total,
        count(*) filter (where extract(hour from w.local_at) < k.hour) as before_hour,
        count(*) filter (where extract(hour from w.local_at) >= k.hour) as from_hour,
        count(*) filter (where w.instructor_id = k.instructor_id) as with_instructor,
        count(distinct w.instructor_id) as instructors,
        count(*) filter (where extract(isodow from w.local_at) = k.weekday) as on_weekday
      from rides w
      where w.local_at::date between k.win_from and k.win_to
    ) c
  )
  select m.id, m.progress,
    case when m.rule = 'leaderboard_top'
      then coalesce(m.progress <= m.threshold and m.today between m.win_from and m.win_to, false)
      else m.progress >= m.threshold
    end
  from measured m;
$$;

create or replace function check_achievements(p_user_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_card record;
begin
  for v_card in
    select a.id, a.name, a.xp_reward
    from public.achievement_progress(p_user_id) p
    join public.achievements a on a.id = p.achievement_id
    where p.earned
      and not exists (select 1 from public.user_achievements ua where ua.user_id = p_user_id and ua.achievement_id = a.id)
  loop
    insert into public.user_achievements (user_id, achievement_id)
    values (p_user_id, v_card.id)
    on conflict (user_id, achievement_id) do nothing;

    if found then
      if v_card.xp_reward > 0 then
        insert into public.xp_transactions (user_id, amount, type, reference_id)
        values (p_user_id, v_card.xp_reward, 'achievement', v_card.id);
      end if;

      insert into public.notifications (user_id, type, title, body, data)
      values (p_user_id, 'achievement', 'Nuevo logro desbloqueado', v_card.name,
              jsonb_build_object('achievement_id', v_card.id));
    end if;
  end loop;
end;
$$;

-- Achievement XP is permanent now: drop the revoke path and the code-keyed
-- helpers it relied on.
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
  -- class and awards its XP: take that back. Achievements stay.
  if v_reservation.status = 'attended' then
    insert into public.xp_transactions (user_id, amount, type, reference_id)
    values (v_reservation.user_id, -100, 'class_completed', p_reservation_id);
  end if;
end;
$$;

drop function revoke_unearned_achievements(uuid);
drop function earned_achievements(uuid);
drop function unlock_achievement(uuid, text);

-- ---------------------------------------------------------------------------
-- member read: live cards with progress, in one call
-- ---------------------------------------------------------------------------
create or replace function my_achievements()
returns table (
  id uuid, name text, description text, xp_reward int, icon text, rule text,
  starts_on date, ends_on date, unlocked boolean, progress int, threshold int
)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select a.id, a.name, a.description, a.xp_reward, a.icon, a.rule,
         a.starts_on, a.ends_on, ua.id is not null, p.progress, a.threshold
  from public.achievements a
  left join public.user_achievements ua on ua.achievement_id = a.id and ua.user_id = auth.uid()
  left join public.achievement_progress(auth.uid()) p on p.achievement_id = a.id
  where a.deleted_at is null
    and (a.starts_on is null or a.starts_on <= (now() at time zone 'America/Bogota')::date)
    and (ua.id is not null or a.ends_on is null or a.ends_on >= (now() at time zone 'America/Bogota')::date)
  order by a.name;
$$;

-- ---------------------------------------------------------------------------
-- admin writes: edit lock + immediate re-check
-- ---------------------------------------------------------------------------
create or replace function guard_achievement_update() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if old.deleted_at is not null then
    raise exception 'achievement_deleted';
  end if;
  if (to_jsonb(new) - 'deleted_at') is distinct from (to_jsonb(old) - 'deleted_at')
     and exists (select 1 from public.user_achievements where achievement_id = old.id) then
    raise exception 'achievement_locked';
  end if;
  return new;
end;
$$;

create trigger achievements_guard_update
  before update on achievements
  for each row execute function guard_achievement_update();

create or replace function recheck_all_achievements() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  perform public.check_achievements(s.user_id) from public.user_stats s;
  return null;
end;
$$;

create trigger achievements_recheck
  after insert or update on achievements
  for each statement execute function recheck_all_achievements();

-- ---------------------------------------------------------------------------
-- RLS: members only see live cards; admins see everything and write
-- (no delete grant: removal is the deleted_at soft delete)
-- ---------------------------------------------------------------------------
drop policy "read achievements" on achievements;
create policy "read achievements" on achievements for select to authenticated using (
  (select is_admin())
  or (deleted_at is null and (starts_on is null or starts_on <= (now() at time zone 'America/Bogota')::date))
);
create policy "admin insert achievements" on achievements for insert to authenticated with check ((select is_admin()));
create policy "admin update achievements" on achievements for update to authenticated
  using ((select is_admin())) with check ((select is_admin()));
grant insert, update on achievements to authenticated;
revoke delete, truncate on achievements from anon, authenticated; -- Supabase grants these by default

-- ---------------------------------------------------------------------------
-- grants
-- ---------------------------------------------------------------------------
revoke execute on function achievement_progress(uuid) from public, anon, authenticated;
revoke execute on function check_achievements(uuid) from public, anon, authenticated;
revoke execute on function guard_achievement_update() from public, anon, authenticated;
revoke execute on function recheck_all_achievements() from public, anon, authenticated;
revoke execute on function my_achievements() from public, anon;
grant execute on function my_achievements() to authenticated;

-- members who already qualify under the converted rules (e.g. a past max
-- streak for an "all time" streak card) get them now
select check_achievements(user_id) from user_stats;
