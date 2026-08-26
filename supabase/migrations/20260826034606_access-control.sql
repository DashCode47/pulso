-- Pulso: access control
-- Supabase grants nothing to anon/authenticated by default, so every table
-- below needs an explicit GRANT alongside its RLS policies -- policies alone
-- don't add table-level privilege. Writes to the ledgers, reservations, and
-- waitlist happen exclusively through SECURITY DEFINER functions in the next
-- migration, so those tables get read-only grants (or none at all).

create or replace function is_admin() returns boolean
language sql stable security definer
set search_path = pg_catalog, public, pg_temp as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- create a profile row automatically when someone signs up via Supabase Auth
create or replace function handle_new_user() returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles enable row level security;
alter table admins enable row level security;
alter table memberships enable row level security;
alter table credit_transactions enable row level security;
alter table bikes enable row level security;
alter table classes enable row level security;
alter table reservations enable row level security;
alter table waitlist_entries enable row level security;
alter table xp_transactions enable row level security;
alter table user_stats enable row level security;
alter table achievements enable row level security;
alter table user_achievements enable row level security;
alter table notifications enable row level security;

-- profiles ------------------------------------------------------------------
create policy "read own profile" on profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "admin read all profiles" on profiles for select to authenticated
  using (is_admin());
create policy "update own profile" on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "admin write profiles" on profiles for all to authenticated
  using (is_admin()) with check (is_admin());
grant select, update on profiles to authenticated;

-- admins: no policies, no grants -- is_admin() (SECURITY DEFINER) is the
-- only sanctioned access path; nobody reads/writes this table via the API.

-- memberships -----------------------------------------------------------
create policy "read own membership" on memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy "admin write memberships" on memberships for all to authenticated
  using (is_admin()) with check (is_admin());
grant select, insert, update, delete on memberships to authenticated;

-- credit_transactions: read-only for members, writes only via RPC ----------
create policy "read own credit transactions" on credit_transactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "admin read all credit transactions" on credit_transactions for select to authenticated
  using (is_admin());
grant select on credit_transactions to authenticated;

-- bikes: public read, admin write --------------------------------------------
create policy "read bikes" on bikes for select to authenticated using (true);
create policy "admin write bikes" on bikes for all to authenticated
  using (is_admin()) with check (is_admin());
grant select, insert, update, delete on bikes to authenticated;

-- classes: public read, admin write ------------------------------------------
create policy "read classes" on classes for select to authenticated using (true);
create policy "admin write classes" on classes for all to authenticated
  using (is_admin()) with check (is_admin());
grant select, insert, update, delete on classes to authenticated;

-- reservations: read-only for members, writes only via RPC -----------------
create policy "read own reservations" on reservations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "admin read all reservations" on reservations for select to authenticated
  using (is_admin());
create policy "admin write reservations" on reservations for all to authenticated
  using (is_admin()) with check (is_admin());
grant select, insert, update, delete on reservations to authenticated;

-- waitlist_entries: read-only for members, writes only via RPC -------------
create policy "read own waitlist entries" on waitlist_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "admin read all waitlist entries" on waitlist_entries for select to authenticated
  using (is_admin());
grant select on waitlist_entries to authenticated;

-- xp_transactions: read-only, no client writes -------------------------------
create policy "read own xp transactions" on xp_transactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "admin read all xp transactions" on xp_transactions for select to authenticated
  using (is_admin());
grant select on xp_transactions to authenticated;

-- user_stats: read-only, no client writes ------------------------------------
create policy "read own stats" on user_stats for select to authenticated
  using (user_id = (select auth.uid()));
create policy "admin read all stats" on user_stats for select to authenticated
  using (is_admin());
grant select on user_stats to authenticated;

-- achievements: public catalog ------------------------------------------
create policy "read achievements" on achievements for select to authenticated using (true);
grant select on achievements to authenticated;

-- user_achievements: read-only ------------------------------------------
create policy "read own achievements" on user_achievements for select to authenticated
  using (user_id = (select auth.uid()));
create policy "admin read all achievements" on user_achievements for select to authenticated
  using (is_admin());
grant select on user_achievements to authenticated;

-- notifications: read own, mark own as read ----------------------------------
create policy "read own notifications" on notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "mark own notifications read" on notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, update on notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Public leaderboards: SECURITY DEFINER-equivalent views (default view
-- behavior -- creator's privileges, not security_invoker) so they can
-- aggregate everyone's XP while xp_transactions stays locked down to "read
-- own" above. Only non-sensitive columns (name, xp) are exposed.
-- ---------------------------------------------------------------------------
create view leaderboard_weekly as
  select p.id as user_id, p.full_name, coalesce(sum(x.amount), 0)::int as xp
  from profiles p
  left join xp_transactions x
    on x.user_id = p.id and x.created_at >= date_trunc('week', now())
  group by p.id, p.full_name
  order by xp desc;

create view leaderboard_monthly as
  select p.id as user_id, p.full_name, coalesce(sum(x.amount), 0)::int as xp
  from profiles p
  left join xp_transactions x
    on x.user_id = p.id and x.created_at >= date_trunc('month', now())
  group by p.id, p.full_name
  order by xp desc;

grant select on leaderboard_weekly, leaderboard_monthly to authenticated;
