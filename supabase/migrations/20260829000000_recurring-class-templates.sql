-- Pulso: recurring class templates
-- Classes were one-off rows an admin had to insert by hand for every single
-- occurrence. Real schedules repeat weekly and rarely change, so admins
-- create a template once (day of week + time) and a daily cron job keeps a
-- rolling window of concrete `classes` rows generated from it. Individual
-- occurrences stay plain rows in `classes` -- editing/cancelling one (a
-- one-off exception) still goes through admin_update_class()/
-- admin_cancel_class() and never touches the template.

create table class_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  trainer_name text not null,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0 = Sunday, matches Postgres dow
  start_time time not null,
  duration_minutes int not null default 45,
  capacity int not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table classes add column template_id uuid references class_templates(id) on delete set null;

-- Generating the same (template, day) twice must be a no-op, not a duplicate
-- row -- this is what makes the generator safe to run as often as we want.
create unique index one_class_per_template_per_start on classes (template_id, starts_at) where template_id is not null;

alter table class_templates enable row level security;
create policy "read class_templates" on class_templates for select to authenticated using (true);
create policy "admin write class_templates" on class_templates for all to authenticated
  using (is_admin()) with check (is_admin());
grant select, insert, update, delete on class_templates to authenticated;

-- ---------------------------------------------------------------------------
-- generate_classes_from_templates: fills the next p_horizon_days of classes
-- for every active template. Idempotent (on conflict do nothing on the
-- unique index above), so calling it more often than needed is harmless and
-- cheap -- a handful of templates times a few weeks of dates is a tiny insert.
-- SECURITY DEFINER because pg_cron's job runs with no authenticated user in
-- context (auth.uid() is null) -- is_admin() would always fail there, so this
-- function bypasses RLS entirely instead of checking it, and is deliberately
-- not granted to `authenticated` (cron calls it as the migration role).
-- ---------------------------------------------------------------------------
create or replace function generate_classes_from_templates(p_horizon_days int default 28) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  insert into public.classes (title, trainer_name, starts_at, duration_minutes, capacity, template_id)
  select
    t.title,
    t.trainer_name,
    d.day::date + t.start_time,
    t.duration_minutes,
    t.capacity,
    t.id
  from public.class_templates t
  cross join generate_series(current_date, current_date + p_horizon_days, interval '1 day') as d(day)
  where t.active and extract(dow from d.day) = t.day_of_week
  on conflict (template_id, starts_at) where template_id is not null do nothing;
end;
$$;

create extension if not exists pg_cron;
select cron.schedule('generate-classes-daily', '0 3 * * *', $$select generate_classes_from_templates(28)$$);
