-- Pulso: studio timezone (America/Bogota)
-- The database runs in UTC. generate_classes_from_templates() built
-- starts_at as `day::date + start_time`, which Postgres casts to timestamptz
-- using the *session* timezone (UTC) -- so a template's "07:00" was stored as
-- 07:00 UTC, i.e. 2:00am in Bogota. Same issue with `current_date`, which is
-- today's date in UTC and can be off by a day close to midnight in Bogota.
-- Fix: anchor both to America/Bogota explicitly, independent of whatever
-- session timezone happens to be active.

create or replace function generate_classes_from_templates(p_horizon_days int default 28) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_studio_today date := (now() at time zone 'America/Bogota')::date;
begin
  insert into public.classes (title, instructor_id, starts_at, duration_minutes, capacity, template_id)
  select
    t.title,
    t.instructor_id,
    (d.day::date + t.start_time) at time zone 'America/Bogota',
    t.duration_minutes,
    t.capacity,
    t.id
  from public.class_templates t
  cross join generate_series(v_studio_today, v_studio_today + p_horizon_days, interval '1 day') as d(day)
  where t.active and extract(dow from d.day) = t.day_of_week
  on conflict (template_id, starts_at) where template_id is not null do nothing;
end;
$$;
