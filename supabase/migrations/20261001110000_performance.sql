-- Pulso: performance pass (no behavior changes)
-- 1. RLS: is_admin() is SECURITY DEFINER, so Postgres can't inline it and ran
--    it once per row (100k+ lookups on `admins`). Wrapped in (select ...) it
--    becomes an initPlan evaluated once per query. "read classes" also called
--    class_published(starts_at) per row, re-reading studio_settings each time
--    (140k+ scans of a 1-row table); the cutoff date is now read once.
-- 2. cron.job_run_details keeps one row per job run (~1,900/day) forever:
--    purged daily, keeping a week for debugging.
-- 3. queue_class_reminders() checks data->>'reservation_id' on every
--    notification ever sent, and send_pending_notifications() scans the whole
--    table for sent_at is null every minute: both get a small partial index,
--    so their cost tracks pending/reminder rows instead of the full history.
-- 4. class_availability() skips unpublished classes (the app drops them
--    anyway) and evaluates auth.uid() / the cancellation cutoff once.
-- 5. Covering indexes for the 4 foreign keys the linter flags.

-- ---------------------------------------------------------------------------
-- 1. RLS
-- ---------------------------------------------------------------------------
alter policy "admin write bikes" on bikes using ((select is_admin())) with check ((select is_admin()));
alter policy "admin write class_templates" on class_templates using ((select is_admin())) with check ((select is_admin()));
alter policy "admin write classes" on classes using ((select is_admin())) with check ((select is_admin()));
alter policy "admin write instructors" on instructors using ((select is_admin())) with check ((select is_admin()));
alter policy "admin write memberships" on memberships using ((select is_admin())) with check ((select is_admin()));
alter policy "admin write news" on news using ((select is_admin())) with check ((select is_admin()));
alter policy "admin write profiles" on profiles using ((select is_admin())) with check ((select is_admin()));
alter policy "admin write reservations" on reservations using ((select is_admin())) with check ((select is_admin()));
alter policy "admin update settings" on studio_settings using ((select is_admin())) with check ((select is_admin()));

alter policy "admin read all credit transactions" on credit_transactions using ((select is_admin()));
alter policy "admin read all profiles" on profiles using ((select is_admin()));
alter policy "admin read all reservations" on reservations using ((select is_admin()));
alter policy "admin read all achievements" on user_achievements using ((select is_admin()));
alter policy "admin read all stats" on user_stats using ((select is_admin()));
alter policy "admin read all waitlist entries" on waitlist_entries using ((select is_admin()));
alter policy "admin read all xp transactions" on xp_transactions using ((select is_admin()));

-- same rule as class_published(), with the published-until date read once
alter policy "read classes" on classes using (
  (select is_admin())
  or (starts_at at time zone 'America/Bogota')::date <= (select schedule_published_until from public.studio_settings)
);

-- ---------------------------------------------------------------------------
-- 2. cron history
-- ---------------------------------------------------------------------------
select cron.schedule('purge-cron-history', '0 9 * * *',
  $$delete from cron.job_run_details where start_time < now() - interval '7 days'$$);

-- ---------------------------------------------------------------------------
-- 3. notification indexes
-- ---------------------------------------------------------------------------
create index notifications_reminder_reservation_idx on notifications ((data ->> 'reservation_id')) where type = 'reminder';
create index notifications_pending_idx on notifications (created_at) where sent_at is null;

-- ---------------------------------------------------------------------------
-- 4. class_availability
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
    (array_agg(r.id) filter (where r.user_id = (select auth.uid())))[1],
    (array_agg(r.bike_id) filter (where r.user_id = (select auth.uid())))[1],
    w.id,
    w.position,
    c.starts_at - (select cancellation_cutoff())
  from public.classes c
  left join public.reservations r on r.class_id = c.id and r.status = 'booked'
  left join lateral (
    select we.id,
      (select count(*) from public.waitlist_entries w2
       where w2.class_id = c.id and w2.status = 'waiting' and w2.created_at <= we.created_at)::int as position
    from public.waitlist_entries we
    where we.class_id = c.id and we.user_id = (select auth.uid()) and we.status = 'waiting'
  ) w on true
  where c.status = 'scheduled' and c.starts_at > now()
    and (c.starts_at at time zone 'America/Bogota')::date <= (select schedule_published_until from public.studio_settings)
  group by c.id, c.starts_at, w.id, w.position;
$$;

-- ---------------------------------------------------------------------------
-- 5. foreign key indexes
-- ---------------------------------------------------------------------------
create index on class_templates (instructor_id);
create index on classes (instructor_id);
create index on reservations (bike_id);
create index on user_achievements (achievement_id);
