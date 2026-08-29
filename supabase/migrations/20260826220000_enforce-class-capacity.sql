-- Pulso: enforce classes.capacity
-- capacity existed on the classes table but book_class() never checked it --
-- the only real limit was one reservation per physical bike. That let a
-- class with capacity < total active bikes overbook silently. This adds the
-- missing check, locking the class row first so concurrent bookings can't
-- both slip in under the same last spot.

create or replace function book_class(p_class_id uuid, p_bike_id uuid) returns reservations
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_class public.classes%rowtype;
  v_balance int;
  v_booked_count int;
  v_reservation public.reservations%rowtype;
begin
  if not exists (select 1 from public.memberships where user_id = auth.uid() and status = 'active') then
    raise exception 'no_active_membership';
  end if;
  -- serializes concurrent booking calls from the same user so a double-tap
  -- can't spend the same credit twice
  perform 1 from public.memberships where user_id = auth.uid() and status = 'active' for update;

  select * into v_class from public.classes where id = p_class_id for update;
  if v_class is null or v_class.status <> 'scheduled' then
    raise exception 'class_not_available';
  end if; 
  if v_class.starts_at <= now() then
    raise exception 'class_already_started';
  end if;

  select count(*) into v_booked_count from public.reservations where class_id = p_class_id and status = 'booked';
  if v_booked_count >= v_class.capacity then
    raise exception 'class_not_available';
  end if;

  select coalesce(sum(amount), 0) into v_balance from public.credit_transactions where user_id = auth.uid();
  if v_balance < 1 then
    raise exception 'insufficient_credits';
  end if;

  begin
    insert into public.reservations (class_id, user_id, bike_id)
    values (p_class_id, auth.uid(), p_bike_id)
    returning * into v_reservation;
  exception when unique_violation then
    raise exception 'bike_or_class_unavailable';
  end;

  insert into public.credit_transactions (user_id, amount, type, reference_id)
  values (auth.uid(), -1, 'booking', v_reservation.id);

  insert into public.notifications (user_id, type, title, body, data)
  values (auth.uid(), 'booking_confirmed', 'Reserva confirmada',
          format('Tu clase %s esta reservada.', v_class.title),
          jsonb_build_object('reservation_id', v_reservation.id));

  if v_balance - 1 <= 2 then
    insert into public.notifications (user_id, type, title, body)
    values (auth.uid(), 'credits_low', 'Pocos creditos', format('Te quedan %s creditos.', v_balance - 1));
  end if;

  return v_reservation;
end;
$$;
