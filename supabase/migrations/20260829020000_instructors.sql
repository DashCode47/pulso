-- Pulso: instructors table
-- trainer_name was free text on classes/class_templates -- already produced
-- duplicates ("Andre ojiva" vs "Andre Ojiva"). Replacing it with a real FK so
-- the admin picks from a dropdown instead of retyping a name each time.

create table instructors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table instructors enable row level security;
create policy "read instructors" on instructors for select to authenticated using (true);
create policy "admin write instructors" on instructors for all to authenticated
  using (is_admin()) with check (is_admin());
grant select, insert, update, delete on instructors to authenticated;

-- Backfill: one instructor per distinct name, case/whitespace-insensitive,
-- keeping the first-seen casing.
insert into instructors (name)
select distinct on (lower(trim(trainer_name))) trim(trainer_name)
from (
  select trainer_name, created_at from classes
  union all
  select trainer_name, created_at from class_templates
) t
order by lower(trim(trainer_name)), created_at;

alter table classes add column instructor_id uuid references instructors(id);
alter table class_templates add column instructor_id uuid references instructors(id);

update classes c set instructor_id = i.id
from instructors i where lower(trim(c.trainer_name)) = lower(i.name);

update class_templates c set instructor_id = i.id
from instructors i where lower(trim(c.trainer_name)) = lower(i.name);

alter table classes alter column instructor_id set not null;
alter table class_templates alter column instructor_id set not null;

alter table classes drop column trainer_name;
alter table class_templates drop column trainer_name;

-- generate_classes_from_templates() referenced trainer_name -- recreate it
-- against instructor_id instead.
create or replace function generate_classes_from_templates(p_horizon_days int default 28) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  insert into public.classes (title, instructor_id, starts_at, duration_minutes, capacity, template_id)
  select
    t.title,
    t.instructor_id,
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

-- admin_update_class() took p_trainer_name text -- signature changes to
-- p_instructor_id uuid, so the old overload must be dropped explicitly.
drop function admin_update_class(uuid, text, text, timestamptz, int, int);

create or replace function admin_update_class(
  p_class_id uuid,
  p_title text,
  p_instructor_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes int,
  p_capacity int
) returns classes
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_class public.classes%rowtype;
  v_rescheduled boolean;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v_class from public.classes where id = p_class_id;
  if v_class is null then
    raise exception 'class_not_found';
  end if;

  v_rescheduled := v_class.starts_at <> p_starts_at or v_class.duration_minutes <> p_duration_minutes;

  update public.classes set
    title = p_title,
    instructor_id = p_instructor_id,
    starts_at = p_starts_at,
    duration_minutes = p_duration_minutes,
    capacity = p_capacity
  where id = p_class_id
  returning * into v_class;

  if v_rescheduled then
    insert into public.notifications (user_id, type, title, body, data)
    select r.user_id, 'class_rescheduled', 'Clase reprogramada',
           format('%s ahora es el %s.', v_class.title, to_char(v_class.starts_at, 'DD Mon HH24:MI')),
           jsonb_build_object('class_id', p_class_id)
    from public.reservations r
    where r.class_id = p_class_id and r.status = 'booked';
  end if;

  return v_class;
end;
$$;
grant execute on function admin_update_class(uuid, text, uuid, timestamptz, int, int) to authenticated;
