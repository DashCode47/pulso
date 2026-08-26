-- Pulso: admin class management
-- Editing a class's title/trainer is a plain UPDATE, already allowed by the
-- "admin write classes" RLS policy from access-control.sql -- no RPC needed
-- for that. Cancelling one is not a plain UPDATE though: existing booked
-- reservations must be refunded and their owners notified, so it needs the
-- same SECURITY DEFINER treatment as cancel_reservation().

create or replace function admin_cancel_class(p_class_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_class public.classes%rowtype;
  v_reservation record;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;

  select * into v_class from public.classes where id = p_class_id;
  if v_class is null then
    raise exception 'class_not_found';
  end if;
  if v_class.status = 'cancelled' then
    return;
  end if;

  for v_reservation in
    select * from public.reservations where class_id = p_class_id and status = 'booked'
  loop
    update public.reservations set status = 'cancelled', cancelled_at = now() where id = v_reservation.id;

    insert into public.credit_transactions (user_id, amount, type, reference_id)
    values (v_reservation.user_id, 1, 'cancel_refund', v_reservation.id);

    insert into public.notifications (user_id, type, title, body, data)
    values (v_reservation.user_id, 'class_cancelled', 'Clase cancelada',
            format('%s fue cancelada. Tu credito fue devuelto.', v_class.title),
            jsonb_build_object('class_id', p_class_id));
  end loop;

  update public.classes set status = 'cancelled' where id = p_class_id;
end;
$$;
grant execute on function admin_cancel_class(uuid) to authenticated;

-- Notify booked riders when an admin reschedules a class (starts_at or
-- duration change) -- title/trainer/capacity edits don't need this.
create or replace function admin_update_class(
  p_class_id uuid,
  p_title text,
  p_trainer_name text,
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
    trainer_name = p_trainer_name,
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
grant execute on function admin_update_class(uuid, text, text, timestamptz, int, int) to authenticated;
