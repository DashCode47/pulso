-- Pulso: weight/height tracking in the member profile.
--
-- Height barely changes, so it's one column on profiles (the existing
-- "update own profile" policy already lets a member set it). Weight is a
-- time series: one row per member per day, re-logging the same day replaces
-- it (client upserts on user_id, measured_on). The app shows the curve and
-- BMI; nothing server-side reads these numbers.
--
-- Monthly reminder: members who have logged at least once (opted in by using
-- it -- nobody gets nagged for a feature they never touched) and whose last
-- weigh-in is 30+ days old get one push, at most every 30 days.

alter table profiles add column height_cm numeric(4,1)
  check (height_cm between 100 and 250);

create table body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_on date not null default (now() at time zone 'America/Bogota')::date,
  weight_kg numeric(4,1) not null check (weight_kg between 25 and 300),
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

alter table body_measurements enable row level security;
create policy "own measurements" on body_measurements for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on body_measurements to authenticated;

create or replace function queue_weigh_in_reminders() returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  insert into public.notifications (user_id, type, title, body, data)
  select m.user_id, 'weigh_in', 'Hora de tu registro mensual',
         'Ya pasó un mes desde tu último peso. Regístralo y mira tu evolución.',
         jsonb_build_object('route', '/(tabs)/profile')
  from (
    select user_id, max(measured_on) as last_on from public.body_measurements group by user_id
  ) m
  where m.last_on <= (now() at time zone 'America/Bogota')::date - 30
    and not exists (
      select 1 from public.notifications n
      where n.user_id = m.user_id and n.type = 'weigh_in' and n.created_at > now() - interval '30 days'
    );
end;
$$;
revoke execute on function queue_weigh_in_reminders() from public, anon, authenticated;

-- 14:00 UTC = 9:00 Bogota.
select cron.schedule('queue-weigh-in-reminders', '0 14 * * *', $$select queue_weigh_in_reminders()$$);
