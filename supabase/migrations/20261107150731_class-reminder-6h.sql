-- Pulso: class reminders go out 6 hours before start (was 1 hour).
--
-- The window is "starts within the next 6 hours" rather than a narrow band
-- around the 6h mark, so reservations made less than 6 hours before class
-- still get a reminder on the next cron tick. Because the lead time varies,
-- the body states the class's local start time instead of "in N hours".
-- The NOT EXISTS check still guarantees one reminder per reservation.
-- create or replace keeps the existing grants (service-only).

create or replace function queue_class_reminders() returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  insert into public.notifications (user_id, type, title, body, data)
  select r.user_id, 'reminder', 'Tu clase empieza pronto',
         format('%s comienza a las %s.', c.title,
                to_char(c.starts_at at time zone 'America/Bogota', 'FMHH12:MI am')),
         jsonb_build_object('reservation_id', r.id, 'class_id', c.id)
  from public.reservations r
  join public.classes c on c.id = r.class_id
  where r.status = 'booked'
    and c.starts_at > now()
    and c.starts_at <= now() + interval '6 hours'
    and not exists (
      select 1 from public.notifications n where n.type = 'reminder' and n.data ->> 'reservation_id' = r.id::text
    );
end;
$$;
