-- Pulso: weekly schedule publishing
-- The studio posts next week's schedule on Sunday, at no fixed time. Classes
-- are still generated 28 days ahead (admins see and tweak them), but members
-- only see and book up to studio_settings.schedule_published_until -- a
-- Bogota date, always a Sunday. The admin moves it forward with
-- admin_publish_next_week().

alter table studio_settings add column schedule_published_until date;

-- Start with the current week (Mon-Sun), stretched to the week of the latest
-- booked class so nobody loses sight of a reservation they already paid for.
update studio_settings set schedule_published_until = date_trunc('week', greatest(
  (now() at time zone 'America/Bogota')::date,
  (select max((c.starts_at at time zone 'America/Bogota')::date)
   from classes c join reservations r on r.class_id = c.id and r.status = 'booked'
   where c.starts_at > now())
))::date + 6;
alter table studio_settings alter column schedule_published_until set not null;

create or replace function class_published(p_starts_at timestamptz) returns boolean
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select (p_starts_at at time zone 'America/Bogota')::date <= schedule_published_until from public.studio_settings;
$$;
revoke execute on function class_published(timestamptz) from public, anon;
grant execute on function class_published(timestamptz) to authenticated;

drop policy "read classes" on classes;
create policy "read classes" on classes for select to authenticated
  using (is_admin() or class_published(starts_at));

-- book_class / join_waitlist / promote_from_waitlist are SECURITY DEFINER and
-- skip RLS, so block unpublished classes at insert time. Reuses
-- class_not_available, which the app already translates.
create or replace function enforce_class_published() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  if not is_admin() and not exists (
    select 1 from public.classes c where c.id = new.class_id and class_published(c.starts_at)
  ) then
    raise exception 'class_not_available';
  end if;
  return new;
end;
$$;
create trigger reservations_published before insert on reservations
  for each row execute function enforce_class_published();
create trigger waitlist_published before insert on waitlist_entries
  for each row execute function enforce_class_published();

-- Thu-Sun publishes next week; Mon-Wed publishes the current one (a late
-- upload). Idempotent, and never hides an already published week.
create or replace function admin_publish_next_week() returns date
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_until date;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;
  update public.studio_settings set schedule_published_until = greatest(
    schedule_published_until,
    date_trunc('week', (now() at time zone 'America/Bogota')::date + 4)::date + 6
  ) returning schedule_published_until into v_until;
  return v_until;
end;
$$;
revoke execute on function admin_publish_next_week() from public, anon;
grant execute on function admin_publish_next_week() to authenticated;
