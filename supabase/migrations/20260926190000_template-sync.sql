-- Pulso: keep generated classes in sync with their template
-- Classes are generated 28 days ahead and editing a template never touched
-- them, so:
--   * changing a template's day/time left the old classes AND generated new
--     ones -> two classes on the same day for ~4 weeks
--   * deactivating a template left 4 weeks of bookable classes
--   * a new template produced nothing until the nightly cron
-- All template writes now go through admin_save_class_template(), which saves
-- the template, drops its future classes that nobody has booked, regenerates
-- them right away, and reports how many booked classes it left alone (those
-- need an admin decision: keep, edit or cancel them from the classes page).

-- Generator: optional single-template mode, and never creates classes that
-- already started (the nightly run is 22:00 Bogota, and an on-save run can
-- happen mid-day -- both would otherwise insert today's earlier slots).
drop function generate_classes_from_templates(int);
create or replace function generate_classes_from_templates(p_horizon_days int default 28, p_template_id uuid default null)
returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_studio_today date := (now() at time zone 'America/Bogota')::date;
begin
  insert into public.classes (title, instructor_id, starts_at, duration_minutes, capacity, template_id)
  select t.title, t.instructor_id, s.starts_at, t.duration_minutes, t.capacity, t.id
  from public.class_templates t
  cross join generate_series(v_studio_today, v_studio_today + p_horizon_days, interval '1 day') as d(day)
  cross join lateral (select (d.day::date + t.start_time) at time zone 'America/Bogota' as starts_at) s
  where t.active
    and (p_template_id is null or t.id = p_template_id)
    and extract(dow from d.day) = t.day_of_week
    and s.starts_at > now()
  on conflict (template_id, starts_at) where template_id is not null do nothing;
end;
$$;
revoke execute on function generate_classes_from_templates(int, uuid) from public, anon, authenticated;

-- p_template_id null = create. Returns how many future classes of this
-- template were kept because they have bookings and no longer match it.
create or replace function admin_save_class_template(
  p_template_id uuid,
  p_title text,
  p_instructor_id uuid,
  p_day_of_week int,
  p_start_time time,
  p_duration_minutes int,
  p_capacity int,
  p_active boolean default true
) returns int
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_template public.class_templates%rowtype;
  v_kept int;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;

  if p_template_id is null then
    insert into public.class_templates (title, instructor_id, day_of_week, start_time, duration_minutes, capacity, active)
    values (p_title, p_instructor_id, p_day_of_week, p_start_time, p_duration_minutes, p_capacity, p_active)
    returning * into v_template;
  else
    update public.class_templates set
      title = p_title, instructor_id = p_instructor_id, day_of_week = p_day_of_week, start_time = p_start_time,
      duration_minutes = p_duration_minutes, capacity = p_capacity, active = p_active
    where id = p_template_id
    returning * into v_template;
    if not found then
      raise exception 'template_not_found';
    end if;

    -- Unbooked future classes: nobody to disturb, so rebuild them from the
    -- template. Ones with only cancelled reservations are detached +
    -- cancelled instead of deleted, to keep that history.
    delete from public.classes c
    where c.template_id = v_template.id and c.status = 'scheduled' and c.starts_at > now()
      and not exists (select 1 from public.reservations r where r.class_id = c.id);

    update public.classes c set status = 'cancelled', template_id = null
    where c.template_id = v_template.id and c.status = 'scheduled' and c.starts_at > now()
      and not exists (select 1 from public.reservations r where r.class_id = c.id and r.status = 'booked');
  end if;

  perform generate_classes_from_templates(28, v_template.id);

  -- Booked classes were left untouched; count the ones that now differ.
  select count(*) into v_kept
  from public.classes c
  where c.template_id = v_template.id and c.status = 'scheduled' and c.starts_at > now()
    and (not v_template.active
      or extract(dow from c.starts_at at time zone 'America/Bogota') <> v_template.day_of_week
      or (c.starts_at at time zone 'America/Bogota')::time <> v_template.start_time
      or c.title <> v_template.title
      or c.instructor_id <> v_template.instructor_id
      or c.duration_minutes <> v_template.duration_minutes
      or c.capacity <> v_template.capacity);

  return v_kept;
end;
$$;
revoke execute on function admin_save_class_template(uuid, text, uuid, int, time, int, int, boolean) from public, anon;
grant execute on function admin_save_class_template(uuid, text, uuid, int, time, int, int, boolean) to authenticated;

-- The RPC is now the only write path (a direct update would skip the sync).
revoke insert, update, delete on class_templates from authenticated;
