-- Pulso: membership statuses are active / expired / cancelled.
-- 1. 'paused' was never set by anything -- dropped from the check.
-- 2. Only an active membership can be cancelled. The admin could cancel an
--    already-expired one, turning "Vencida" into "Cancelada" for the member
--    with no other effect (expiry already released bookings and zeroed credits).
alter table memberships drop constraint memberships_status_check;
alter table memberships add constraint memberships_status_check check (status in ('active', 'expired', 'cancelled'));

create or replace function admin_cancel_membership(p_membership_id uuid) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_user_id uuid;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;

  update public.memberships set status = 'cancelled'
  where id = p_membership_id and status = 'active'
  returning user_id into v_user_id;
  if v_user_id is null then
    return;
  end if;

  perform release_member_bookings(v_user_id);

  insert into public.notifications (user_id, type, title, body)
  values (v_user_id, 'membership', 'Membresia cancelada', 'Tus reservas futuras fueron canceladas.');
end;
$$;
