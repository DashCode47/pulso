-- Pulso: expose cycle_start in search_members too, so the members list can
-- show both "desde" and "vence" without a second round-trip per row.

drop function search_members(text);

create or replace function search_members(p_query text default '') returns table (
  user_id uuid,
  full_name text,
  credits_balance int,
  membership_status text,
  cycle_start date,
  cycle_end date
)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select p.id, p.full_name,
         coalesce(s.credits_balance, 0),
         m.status,
         m.cycle_start,
         m.cycle_end
  from public.profiles p
  left join public.user_stats s on s.user_id = p.id
  left join lateral (
    select status, cycle_start, cycle_end from public.memberships
    where user_id = p.id
    order by created_at desc
    limit 1
  ) m on true
  where is_admin()
    and not exists (select 1 from public.admins a where a.user_id = p.id)
    and (p_query = '' or p.full_name ilike '%' || p_query || '%')
  order by p.full_name
  limit 50;
$$;
grant execute on function search_members(text) to authenticated;
