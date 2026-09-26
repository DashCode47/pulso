-- Pulso: push notifications
-- `notifications` rows have been getting inserted all along (booking
-- confirmed, credits low, class cancelled/rescheduled, streak, waitlist
-- offer, reminder -- see business-logic.sql), sent_at null meaning "pending
-- send", with an index built for exactly that query. But nothing ever read
-- those pending rows and actually delivered them -- this adds where to
-- store each device's Expo push token and a cron dispatcher that sends
-- pending rows through Expo's push service, via pg_net (same all-in-Postgres
-- pattern as every other scheduled job here, no edge function needed).

alter table profiles add column expo_push_token text;
-- One token per user (their most recent device) -- simplest thing that
-- works for a single-phone-per-member gym. Revisit as a separate
-- push_tokens table if multi-device ever matters.
-- RLS: "update own profile" + the existing grant already let a user set
-- their own token, no new policy needed.

create extension if not exists pg_net;

create or replace function send_pending_notifications() returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_row record;
  v_messages jsonb := '[]'::jsonb;
  v_ids uuid[] := '{}';
begin
  for v_row in
    select n.id, n.title, n.body, n.data, p.expo_push_token
    from public.notifications n
    join public.profiles p on p.id = n.user_id
    where n.sent_at is null
    order by n.created_at
    limit 100 -- Expo's push API batch cap
  loop
    v_ids := v_ids || v_row.id;
    if v_row.expo_push_token is not null then
      v_messages := v_messages || jsonb_build_object(
        'to', v_row.expo_push_token,
        'title', v_row.title,
        'body', v_row.body,
        'data', coalesce(v_row.data, '{}'::jsonb)
      );
    end if;
  end loop;

  if jsonb_array_length(v_messages) > 0 then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      body := v_messages
    );
  end if;

  -- Mark the whole batch handled, token or not -- otherwise a user who
  -- never opened the app (no token) would be retried forever every minute.
  -- ponytail: doesn't check Expo's push receipts, so a token Expo silently
  -- rejects (e.g. app uninstalled) isn't pruned from profiles -- fine at
  -- launch scale, add a receipt-polling pass if stale tokens pile up.
  if array_length(v_ids, 1) > 0 then
    update public.notifications set sent_at = now() where id = any(v_ids);
  end if;
end;
$$;
revoke execute on function send_pending_notifications() from public;

-- Every minute: notifications (booking confirmations especially) should
-- feel close to real-time, and pg_net's request volume here is nowhere near
-- its limits for a 60-80 member studio.
select cron.schedule('send-pending-notifications', '* * * * *', $$select send_pending_notifications()$$);
