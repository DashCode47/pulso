-- Pulso: access control
-- InsForge grants broad DML privileges on public tables to anon/authenticated
-- by default so RLS can decide row access. This app requires login for
-- everything, so anon is revoked entirely; authenticated is narrowed per
-- table below only where writes must go exclusively through the
-- SECURITY DEFINER RPC functions in the next migration (the ledgers,
-- reservations, waitlist, and server-maintained caches).

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = (SELECT auth.uid()));
$$;

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- admins: no policies at all -- nobody reads/writes this table through
-- PostgREST; is_admin() (SECURITY DEFINER) is the only sanctioned access path.
REVOKE ALL ON admins FROM authenticated;

-- memberships -----------------------------------------------------------
CREATE POLICY "read own membership" ON memberships FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "admin write memberships" ON memberships FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- credit_transactions: read-only for members, writes only via RPC ----------
REVOKE INSERT, UPDATE, DELETE ON credit_transactions FROM authenticated;
CREATE POLICY "read own credit transactions" ON credit_transactions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "admin read all credit transactions" ON credit_transactions FOR SELECT TO authenticated
  USING (is_admin());

-- bikes: public read, admin write --------------------------------------------
CREATE POLICY "read bikes" ON bikes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write bikes" ON bikes FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- classes: public read, admin write ------------------------------------------
CREATE POLICY "read classes" ON classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write classes" ON classes FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- reservations: read-only for members, writes only via RPC -----------------
REVOKE INSERT, UPDATE, DELETE ON reservations FROM authenticated;
CREATE POLICY "read own reservations" ON reservations FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "admin read all reservations" ON reservations FOR SELECT TO authenticated
  USING (is_admin());

-- waitlist_entries: read-only for members, writes only via RPC -------------
REVOKE INSERT, UPDATE, DELETE ON waitlist_entries FROM authenticated;
CREATE POLICY "read own waitlist entries" ON waitlist_entries FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "admin read all waitlist entries" ON waitlist_entries FOR SELECT TO authenticated
  USING (is_admin());

-- xp_transactions: read-only, no client writes -------------------------------
REVOKE INSERT, UPDATE, DELETE ON xp_transactions FROM authenticated;
CREATE POLICY "read own xp transactions" ON xp_transactions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "admin read all xp transactions" ON xp_transactions FOR SELECT TO authenticated
  USING (is_admin());

-- user_stats: read-only, no client writes ------------------------------------
REVOKE INSERT, UPDATE, DELETE ON user_stats FROM authenticated;
CREATE POLICY "read own stats" ON user_stats FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "admin read all stats" ON user_stats FOR SELECT TO authenticated
  USING (is_admin());

-- achievements: public catalog, managed only via migration -----------------
REVOKE INSERT, UPDATE, DELETE ON achievements FROM authenticated;
CREATE POLICY "read achievements" ON achievements FOR SELECT TO authenticated USING (true);

-- user_achievements: read-only, server-maintained only ----------------------
REVOKE INSERT, UPDATE, DELETE ON user_achievements FROM authenticated;
CREATE POLICY "read own achievements" ON user_achievements FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "admin read all achievements" ON user_achievements FOR SELECT TO authenticated
  USING (is_admin());

-- notifications: read own, mark own as read, server-only creates -----------
REVOKE INSERT, DELETE ON notifications FROM authenticated;
CREATE POLICY "read own notifications" ON notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "mark own notifications read" ON notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- Public leaderboards: SECURITY DEFINER views (default view behavior) so
-- they can aggregate everyone's XP while xp_transactions stays locked down
-- to "read own" above. Only non-sensitive columns (name, xp) are exposed.
-- Display name comes from InsForge's built-in auth.users.profile JSONB.
-- ---------------------------------------------------------------------------
CREATE VIEW leaderboard_weekly AS
  SELECT u.id AS user_id, u.profile ->> 'name' AS full_name, COALESCE(SUM(x.amount), 0)::int AS xp
  FROM auth.users u
  LEFT JOIN xp_transactions x
    ON x.user_id = u.id AND x.created_at >= date_trunc('week', now())
  GROUP BY u.id, u.profile ->> 'name'
  ORDER BY xp DESC;

CREATE VIEW leaderboard_monthly AS
  SELECT u.id AS user_id, u.profile ->> 'name' AS full_name, COALESCE(SUM(x.amount), 0)::int AS xp
  FROM auth.users u
  LEFT JOIN xp_transactions x
    ON x.user_id = u.id AND x.created_at >= date_trunc('month', now())
  GROUP BY u.id, u.profile ->> 'name'
  ORDER BY xp DESC;

GRANT SELECT ON leaderboard_weekly, leaderboard_monthly TO authenticated;
