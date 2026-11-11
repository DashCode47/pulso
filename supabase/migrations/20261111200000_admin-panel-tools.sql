-- Pulso: admin panel tools
-- 1. search_members also matches and returns the member's email, and no
--    longer stops at 50 rows.
-- 2. admin_send_notification can target everyone booked in one class, and
--    records the audience in data so the history can show it.
-- 3. admin_notification_history(): what admins sent, one row per send.
-- 4. admin_book_class(): book on behalf of a member (walk-ins, WhatsApp),
--    same rules as book_class() but for p_user_id instead of auth.uid().

-- 1 -------------------------------------------------------------------------
-- Return type changes (new email column), so drop + create. The mobile app
-- reads columns by name, so an extra column is harmless there.
drop function search_members(text);

create or replace function search_members(p_query text default '') returns table (
  user_id uuid,
  full_name text,
  email text,
  credits_balance int,
  membership_status text,
  cycle_start date,
  cycle_end date
)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select p.id, p.full_name, u.email::text,
         coalesce(s.credits_balance, 0),
         m.status,
         m.cycle_start,
         m.cycle_end
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.user_stats s on s.user_id = p.id
  left join lateral (
    select status, cycle_start, cycle_end from public.memberships
    where user_id = p.id
    order by created_at desc
    limit 1
  ) m on true
  where (select is_admin())
    and not exists (select 1 from public.admins a where a.user_id = p.id)
    and (p_query = '' or p.full_name ilike '%' || p_query || '%' or u.email ilike '%' || p_query || '%')
  order by p.full_name
  -- was 50: the admin members list filters/counts client-side, so it needs
  -- every member. A studio is hundreds of members, not tens of thousands.
  limit 2000;
$$;
revoke execute on function search_members(text) from public, anon;
grant execute on function search_members(text) to authenticated;

-- 2 -------------------------------------------------------------------------
drop function admin_send_notification(text, text, uuid);

create or replace function admin_send_notification(
  p_title text,
  p_body text,
  p_user_id uuid default null,
  p_class_id uuid default null
) returns int
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
    insert into public.notifications (user_id, type, title, body, data)
    values (p_user_id, 'admin_broadcast', p_title, p_body, jsonb_build_object('audience', 'member'));
    return 1;
  end if;

  if p_class_id is not null then
    insert into public.notifications (user_id, type, title, body, data)
    select distinct r.user_id, 'admin_broadcast', p_title, p_body,
           jsonb_build_object('audience', 'class', 'class_id', p_class_id)
    from public.reservations r
    where r.class_id = p_class_id and r.status = 'booked';
    get diagnostics v_count = row_count;
    return v_count;
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  select distinct m.user_id, 'admin_broadcast', p_title, p_body, jsonb_build_object('audience', 'all')
  from public.memberships m
  where m.status = 'active';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function admin_send_notification(text, text, uuid, uuid) from public, anon;
grant execute on function admin_send_notification(text, text, uuid, uuid) to authenticated;

-- 3 -------------------------------------------------------------------------
-- One send = one statement = one shared created_at, so grouping by it (plus
-- title/body) collapses a broadcast back into a single history row.
create index if not exists notifications_admin_broadcast_idx
  on notifications (created_at desc) where type = 'admin_broadcast';

create or replace function admin_notification_history(p_limit int default 30) returns table (
  sent_at timestamptz,
  title text,
  body text,
  audience text,
  recipients int,
  recipient_name text,
  class_title text,
  class_starts_at timestamptz
)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select n.created_at,
         n.title,
         n.body,
         -- rows sent before this migration have no audience recorded
         coalesce(n.data ->> 'audience', case when count(*) = 1 then 'member' else 'all' end),
         count(*)::int,
         case when count(*) = 1 then min(p.full_name) end,
         min(c.title),
         min(c.starts_at)
  from public.notifications n
  left join public.profiles p on p.id = n.user_id
  left join public.classes c on c.id = (n.data ->> 'class_id')::uuid
  where (select is_admin()) and n.type = 'admin_broadcast'
  group by n.created_at, n.title, n.body, n.data ->> 'audience'
  order by n.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;
revoke execute on function admin_notification_history(int) from public, anon;
grant execute on function admin_notification_history(int) to authenticated;

-- 4 -------------------------------------------------------------------------
create or replace function admin_book_class(p_user_id uuid, p_class_id uuid, p_bike_id uuid) returns reservations
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_class public.classes%rowtype;
  v_balance int;
  v_booked_count int;
  v_reservation public.reservations%rowtype;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;
  if not exists (select 1 from public.memberships where user_id = p_user_id and status = 'active') then
    raise exception 'no_active_membership';
  end if;
  -- same lock as book_class(): a member booking from the app at the same
  -- moment can't spend the same credit twice
  perform 1 from public.memberships where user_id = p_user_id and status = 'active' for update;

  select * into v_class from public.classes where id = p_class_id for update;
  if v_class is null or v_class.status <> 'scheduled' then
    raise exception 'class_not_available';
  end if;
  if v_class.starts_at <= now() then
    raise exception 'class_already_started';
  end if;
  if not membership_covers(p_user_id, v_class.starts_at) then
    raise exception 'membership_not_valid_for_class';
  end if;

  select count(*) into v_booked_count from public.reservations where class_id = p_class_id and status = 'booked';
  if v_booked_count >= v_class.capacity then
    raise exception 'class_not_available';
  end if;

  select coalesce(sum(amount), 0) into v_balance from public.credit_transactions where user_id = p_user_id;
  if v_balance < 1 then
    raise exception 'insufficient_credits';
  end if;

  begin
    insert into public.reservations (class_id, user_id, bike_id)
    values (p_class_id, p_user_id, p_bike_id)
    returning * into v_reservation;
  exception when unique_violation then
    raise exception 'bike_or_class_unavailable';
  end;

  insert into public.credit_transactions (user_id, amount, type, reference_id, note)
  values (p_user_id, -1, 'booking', v_reservation.id, 'Reservado por el estudio');

  -- (the reservations_clear_waitlist trigger takes them off this class's waitlist)

  insert into public.notifications (user_id, type, title, body, data)
  values (p_user_id, 'booking_confirmed', 'Reserva confirmada',
          format('El estudio te reservó la clase %s.', v_class.title),
          jsonb_build_object('reservation_id', v_reservation.id));

  return v_reservation;
end;
$$;
revoke execute on function admin_book_class(uuid, uuid, uuid) from public, anon;
grant execute on function admin_book_class(uuid, uuid, uuid) to authenticated;
