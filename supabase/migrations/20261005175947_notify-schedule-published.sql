-- Pulso: push members when the weekly schedule goes up
-- The schedule is published on Sunday at no fixed time, so members had no way
-- to know when they could book short of opening the app. Publishing now
-- queues a 'schedule_published' notification (delivered by the
-- send-pending-notifications cron, like every other one) -- only when the
-- publish date actually moves, so pressing Publish twice doesn't push twice.
-- Recipients: active members whose paid period overlaps the newly published
-- week; someone expiring before it can't book those classes anyway.

create or replace function admin_publish_next_week() returns date
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_prev date;
  v_until date;
  v_week_start date;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;
  select schedule_published_until into v_prev from public.studio_settings where id for update;
  update public.studio_settings set schedule_published_until = greatest(
    schedule_published_until,
    date_trunc('week', studio_today() + 4)::date + 6
  ) where id returning schedule_published_until into v_until;

  if v_until > v_prev then
    -- Mon-Wed publishes the current week (late upload), Thu-Sun the next one.
    v_week_start := v_until - 6;
    insert into public.notifications (user_id, type, title, body)
    select distinct m.user_id, 'schedule_published', 'Horario publicado',
      case when v_week_start <= studio_today()
        then 'Ya puedes reservar las clases de esta semana.'
        else 'Ya puedes reservar las clases de la próxima semana.'
      end
    from public.memberships m
    where m.status = 'active' and m.cycle_end >= v_week_start and m.cycle_start <= v_until;
  end if;

  return v_until;
end;
$$;
