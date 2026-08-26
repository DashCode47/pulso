-- Pulso: admin member search
-- profiles has no role column, so a plain client-side select can't tell
-- members and admins apart -- and admins has no policies/grants by design
-- (see access-control.sql), so the client can't exclude them via a join
-- either. This RPC does the exclusion server-side, same is_admin() guard as
-- the rest of the admin-only functions.

create or replace function search_members(p_query text default '') returns table (
  user_id uuid,
  full_name text,
  credits_balance int,
  membership_status text
)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select p.id, p.full_name,
         coalesce(s.credits_balance, 0),
         m.status
  from public.profiles p
  left join public.user_stats s on s.user_id = p.id
  left join public.memberships m on m.user_id = p.id and m.status = 'active'
  where is_admin()
    and not exists (select 1 from public.admins a where a.user_id = p.id)
    and (p_query = '' or p.full_name ilike '%' || p_query || '%')
  order by p.full_name
  limit 50;
$$;
grant execute on function search_members(text) to authenticated;
