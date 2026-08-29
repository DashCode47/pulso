-- Pulso: show real membership status (including expired) in search_members
-- The join only matched status = 'active', so an expired membership showed
-- as "no membership" instead of "expired" -- indistinguishable from someone
-- who was never assigned one. Joins the most recent membership per user
-- regardless of status, and now also returns cycle_end for the admin UI.

drop function search_members(text);

create or replace function search_members(p_query text default '') returns table (
  user_id uuid,
  full_name text,
  credits_balance int,
  membership_status text,
  cycle_end date
)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select p.id, p.full_name,
         coalesce(s.credits_balance, 0),
         m.status,
         m.cycle_end
  from public.profiles p
  left join public.user_stats s on s.user_id = p.id
  left join lateral (
    select status, cycle_end from public.memberships
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
