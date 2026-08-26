-- Regression check for the booking/credits/waitlist/gamification RPCs in
-- supabase/migrations/*business-logic.sql. This is the money/security path
-- of the app (credit ledger, RLS, double-booking prevention) so it gets one
-- runnable check instead of only manual testing.
--
-- Run against the linked Supabase project:
--   npx supabase db query --linked --file tests/smoke.sql
--
-- Everything happens inside one transaction that's rolled back at the end,
-- so it's safe to run repeatedly. A failed assertion raises an exception
-- and aborts with a non-zero exit code.

BEGIN;
SET client_min_messages TO warning;
SET LOCAL search_path = public;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@test.local', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'alice@test.local', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000003', 'bob@test.local',   'x', now(), now(), now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000004', 'carol@test.local', 'x', now(), now(), now(), 'authenticated', 'authenticated');

-- profiles are auto-created by the on_auth_user_created trigger; just fix up names
UPDATE profiles SET full_name = 'Admin' WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE profiles SET full_name = 'Alice' WHERE id = '00000000-0000-0000-0000-000000000002';
UPDATE profiles SET full_name = 'Bob' WHERE id = '00000000-0000-0000-0000-000000000003';
UPDATE profiles SET full_name = 'Carol' WHERE id = '00000000-0000-0000-0000-000000000004';

INSERT INTO admins (user_id) VALUES ('00000000-0000-0000-0000-000000000001');

INSERT INTO memberships (user_id, credits_per_cycle, weekly_goal) VALUES
  ('00000000-0000-0000-0000-000000000002', 10, 3),
  ('00000000-0000-0000-0000-000000000003', 10, 3),
  ('00000000-0000-0000-0000-000000000004', 10, 3);

INSERT INTO credit_transactions (user_id, amount, type) VALUES
  ('00000000-0000-0000-0000-000000000002', 10, 'grant'),
  ('00000000-0000-0000-0000-000000000003', 10, 'grant'),
  ('00000000-0000-0000-0000-000000000004', 10, 'grant');

INSERT INTO bikes (label) VALUES ('Bike 01'), ('Bike 02');

INSERT INTO classes (id, title, trainer_name, starts_at, duration_minutes, capacity)
VALUES ('00000000-0000-0000-0000-0000000000c1', 'HIIT', 'Coach Dan', now() + interval '3 hours', 45, 2);

DO $$
DECLARE
  v_alice CONSTANT UUID := '00000000-0000-0000-0000-000000000002';
  v_bob CONSTANT UUID := '00000000-0000-0000-0000-000000000003';
  v_carol CONSTANT UUID := '00000000-0000-0000-0000-000000000004';
  v_admin CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  v_class CONSTANT UUID := '00000000-0000-0000-0000-0000000000c1';
  v_bike01 UUID := (SELECT id FROM bikes WHERE label = 'Bike 01');
  v_bike02 UUID := (SELECT id FROM bikes WHERE label = 'Bike 02');
  v_alice_reservation UUID;
  v_waitlist_entry UUID;
  v_status TEXT;
  v_xp INT;
  v_credits INT;
BEGIN
  SET LOCAL ROLE authenticated;

  -- book_class enforces the bike-per-class uniqueness constraint
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_alice)::text, true);
  SELECT id INTO v_alice_reservation FROM book_class(v_class, v_bike01);

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_bob)::text, true);
  BEGIN
    PERFORM book_class(v_class, v_bike01);
    RAISE EXCEPTION 'assertion failed: Bob should not be able to book Alice''s bike';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'bike_or_class_unavailable' THEN RAISE; END IF;
  END;
  PERFORM book_class(v_class, v_bike02);

  -- RLS: members only see their own reservations
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_alice)::text, true);
  IF (SELECT count(*) FROM reservations WHERE user_id = v_alice) <> 1 THEN
    RAISE EXCEPTION 'assertion failed: Alice cannot see her own reservation';
  END IF;
  IF (SELECT count(*) FROM reservations WHERE user_id = v_bob) <> 0 THEN
    RAISE EXCEPTION 'assertion failed: RLS leaked Bob''s reservation to Alice';
  END IF;

  -- ledger tables reject direct client writes regardless of RLS
  BEGIN
    INSERT INTO credit_transactions (user_id, amount, type) VALUES (v_alice, 1000, 'admin_adjustment');
    RAISE EXCEPTION 'assertion failed: direct credit_transactions insert should be blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- cancelling refunds the credit and offers the freed bike to the waitlist
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_carol)::text, true);
  SELECT id INTO v_waitlist_entry FROM join_waitlist(v_class);

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_alice)::text, true);
  PERFORM cancel_reservation(v_alice_reservation);

  RESET ROLE;
  SELECT status INTO v_status FROM waitlist_entries WHERE id = v_waitlist_entry;
  IF v_status <> 'offered' THEN
    RAISE EXCEPTION 'assertion failed: cancelling should offer the bike to the waitlist, got status=%', v_status;
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_carol)::text, true);
  PERFORM claim_waitlist_offer(v_waitlist_entry);

  -- class completion sweep awards XP and unlocks the first-ride achievement
  RESET ROLE;
  UPDATE classes SET starts_at = now() - interval '2 hours' WHERE id = v_class;
  PERFORM close_finished_classes();

  SELECT total_xp INTO v_xp FROM user_stats WHERE user_id = v_bob;
  IF v_xp <> 200 THEN -- 100 class_completed + 100 first_ride achievement
    RAISE EXCEPTION 'assertion failed: Bob should have 200 XP after class completion, got %', v_xp;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id
    WHERE ua.user_id = v_bob AND a.code = 'first_ride'
  ) THEN
    RAISE EXCEPTION 'assertion failed: Bob should have unlocked first_ride';
  END IF;

  -- admin-only RPCs reject non-admins and accept admins
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_alice)::text, true);
  BEGIN
    PERFORM admin_adjust_credits(v_alice, 50, 'should fail');
    RAISE EXCEPTION 'assertion failed: non-admin should not be able to adjust credits';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'not_authorized' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_admin)::text, true);
  PERFORM admin_adjust_credits(v_alice, 5, 'goodwill credit');

  RESET ROLE;
  SELECT credits_balance INTO v_credits FROM user_stats WHERE user_id = v_alice;
  IF v_credits <> 15 THEN -- 10 grant - 1 booking + 1 cancel refund + 5 admin adjustment
    RAISE EXCEPTION 'assertion failed: Alice should have 15 credits, got %', v_credits;
  END IF;

  -- scheduled job functions run cleanly with no matching rows
  PERFORM expire_waitlist_offers();
  PERFORM queue_class_reminders();
  PERFORM grant_monthly_credits();
  PERFORM update_weekly_streaks();

  RAISE NOTICE 'smoke test passed';
END;
$$;

ROLLBACK;
