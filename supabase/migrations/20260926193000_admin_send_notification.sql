-- Pulso: admin-triggered notifications
-- Lets an admin push an ad-hoc message (announcement) to one member or to
-- every active member. Just inserts into `notifications` with sent_at null,
-- same as every automatic notification already does -- the existing
-- send-pending-notifications cron (every minute) delivers it, no separate
-- dispatch path needed. `notifications.type` has no check constraint, so a
-- new 'admin_broadcast' value needs no schema change.

create or replace function admin_send_notification(p_title text, p_body text, p_user_id uuid default null)
returns int
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_count int;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;
  if length(trim(p_title)) = 0 or length(trim(p_body)) = 0 then
    raise exception 'title_and_body_required';
  end if;

  if p_user_id is not null then
    insert into public.notifications (user_id, type, title, body)
    values (p_user_id, 'admin_broadcast', p_title, p_body);
    return 1;
  end if;

  insert into public.notifications (user_id, type, title, body)
  select distinct m.user_id, 'admin_broadcast', p_title, p_body
  from public.memberships m
  where m.status = 'active';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function admin_send_notification(text, text, uuid) from public, anon;
grant execute on function admin_send_notification(text, text, uuid) to authenticated;
