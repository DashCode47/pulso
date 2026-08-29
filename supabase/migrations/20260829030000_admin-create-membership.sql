-- Pulso: grant first-cycle credits when a membership is created
-- Creating a membership was a plain insert (RLS already allows it for
-- admins), but credits only arrive via grant_monthly_credits() on the next
-- cycle anniversary -- a brand-new member could wait weeks with 0 credits
-- before they can book anything. This wraps the insert and the first grant
-- in one transaction so credits land immediately.

create or replace function admin_create_membership(
  p_user_id uuid,
  p_plan_name text,
  p_credits_per_cycle int,
  p_weekly_goal int
) returns memberships
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_membership public.memberships%rowtype;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;

  insert into public.memberships (user_id, plan_name, credits_per_cycle, weekly_goal)
  values (p_user_id, p_plan_name, p_credits_per_cycle, p_weekly_goal)
  returning * into v_membership;

  insert into public.credit_transactions (user_id, amount, type, reference_id)
  values (p_user_id, p_credits_per_cycle, 'grant', v_membership.id);

  insert into public.notifications (user_id, type, title, body)
  values (p_user_id, 'credits', 'Membresia activada', format('Recibiste %s creditos.', p_credits_per_cycle));

  return v_membership;
end;
$$;
grant execute on function admin_create_membership(uuid, text, int, int) to authenticated;
