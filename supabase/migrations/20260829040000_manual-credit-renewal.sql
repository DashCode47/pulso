-- Pulso: manual credit renewal
-- grant_monthly_credits() assumed every active membership had actually been
-- paid/renewed for the new cycle -- but the studio has no automated billing,
-- so the admin is the one who knows who renewed. Auto-granting credits every
-- month regardless was handing out credits to members who may not have paid.
-- Renewal is now a deliberate admin action (single member or a batch), and
-- cycle_start is updated on each grant so it still reads as "last renewed on".

select cron.unschedule('grant-monthly-credits');
drop function grant_monthly_credits();

-- Grants credits to one or more members at once and bumps cycle_start to
-- today on each, so the members table can show "last renewed" accurately.
create or replace function admin_grant_credits_bulk(p_user_ids uuid[]) returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_membership record;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;

  for v_membership in
    select * from public.memberships where user_id = any(p_user_ids) and status = 'active'
  loop
    insert into public.credit_transactions (user_id, amount, type)
    values (v_membership.user_id, v_membership.credits_per_cycle, 'grant');

    update public.memberships set cycle_start = current_date where id = v_membership.id;

    insert into public.notifications (user_id, type, title, body)
    values (v_membership.user_id, 'credits', 'Creditos renovados', format('Recibiste %s creditos este mes.', v_membership.credits_per_cycle));
  end loop;
end;
$$;
grant execute on function admin_grant_credits_bulk(uuid[]) to authenticated;
