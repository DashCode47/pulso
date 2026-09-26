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

INSERT INTO memberships (user_id, credits_per_cycle, weekly_goal, cycle_end) VALUES
  ('00000000-0000-0000-0000-000000000002', 10, 3, current_date + 30),
  ('00000000-0000-0000-0000-000000000003', 10, 3, current_date + 30),
  ('00000000-0000-0000-0000-000000000004', 10, 3, current_date + 30);

INSERT INTO credit_transactions (user_id, amount, type) VALUES
  ('00000000-0000-0000-0000-000000000002', 10, 'grant'),
  ('00000000-0000-0000-0000-000000000003', 10, 'grant'),
  ('00000000-0000-0000-0000-000000000004', 10, 'grant');

INSERT INTO bikes (label) VALUES ('Bike 01'), ('Bike 02');

INSERT INTO instructors (id, name) VALUES ('00000000-0000-0000-0000-0000000000d1', 'Coach Smoke Test');
UPDATE studio_settings SET cancellation_cutoff_hours = 12;

INSERT INTO classes (id, title, instructor_id, starts_at, duration_minutes, capacity)
VALUES ('00000000-0000-0000-0000-0000000000c1', 'HIIT', '00000000-0000-0000-0000-0000000000d1', now() + interval '1 day', 45, 2);

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
  v_template UUID;
  v_kept INT;
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

  -- availability ignores RLS scoping: Bob sees the class as full, incl. Alice's bike
  IF NOT EXISTS (
    SELECT 1 FROM class_availability()
    WHERE class_id = v_class AND booked_count = 2 AND v_bike01 = ANY (taken_bike_ids) AND my_bike_id = v_bike02
  ) THEN
    RAISE EXCEPTION 'assertion failed: class_availability should show both bookings to Bob';
  END IF;

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

  -- cancelling refunds the credit and auto-books the freed bike for the first on the waitlist
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_carol)::text, true);
  SELECT id INTO v_waitlist_entry FROM join_waitlist(v_class);

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_alice)::text, true);
  PERFORM cancel_reservation(v_alice_reservation);

  -- a second cancel of the same reservation must not refund again
  BEGIN
    PERFORM cancel_reservation(v_alice_reservation);
    RAISE EXCEPTION 'assertion failed: double cancel should be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'reservation_not_active' THEN RAISE; END IF;
  END;

  RESET ROLE;
  SELECT status INTO v_status FROM waitlist_entries WHERE id = v_waitlist_entry;
  IF v_status <> 'claimed' THEN
    RAISE EXCEPTION 'assertion failed: cancelling should promote the waitlist, got status=%', v_status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM reservations WHERE class_id = v_class AND user_id = v_carol AND bike_id = v_bike01 AND status = 'booked') THEN
    RAISE EXCEPTION 'assertion failed: Carol should hold Alice''s freed bike';
  END IF;
  SELECT credits_balance INTO v_credits FROM user_stats WHERE user_id = v_carol;
  IF v_credits <> 9 THEN
    RAISE EXCEPTION 'assertion failed: promotion should charge Carol 1 credit, got %', v_credits;
  END IF;

  -- inside the cutoff: cancelling and joining the waitlist are both closed
  UPDATE classes SET starts_at = now() + interval '11 hours' WHERE id = v_class;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_carol)::text, true);
  BEGIN
    PERFORM cancel_reservation((SELECT id FROM reservations WHERE class_id = v_class AND user_id = v_carol AND status = 'booked'));
    RAISE EXCEPTION 'assertion failed: cancel inside the cutoff should be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'cancellation_window_closed' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_alice)::text, true);
  BEGIN
    PERFORM join_waitlist(v_class);
    RAISE EXCEPTION 'assertion failed: joining the waitlist inside the cutoff should be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'waitlist_closed' THEN RAISE; END IF;
  END;

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

  -- templates: saving generates classes now; editing rebuilds unbooked ones and keeps booked ones
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_admin)::text, true);
  PERFORM admin_save_class_template(NULL, 'Tmpl Smoke', '00000000-0000-0000-0000-0000000000d1',
    extract(dow from (now() at time zone 'America/Bogota') + interval '2 days')::int, '06:00', 45, 2);
  SELECT id INTO v_template FROM class_templates WHERE title = 'Tmpl Smoke';
  IF (SELECT count(*) FROM classes WHERE template_id = v_template) < 4 THEN
    RAISE EXCEPTION 'assertion failed: saving a template should generate ~4 weeks of classes immediately';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_bob)::text, true);
  PERFORM book_class((SELECT id FROM classes WHERE template_id = v_template ORDER BY starts_at LIMIT 1), v_bike01);

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_admin)::text, true);
  v_kept := admin_save_class_template(v_template, 'Tmpl Smoke', '00000000-0000-0000-0000-0000000000d1',
    extract(dow from (now() at time zone 'America/Bogota') + interval '2 days')::int, '07:00', 45, 2);
  IF v_kept <> 1 THEN
    RAISE EXCEPTION 'assertion failed: moving the template should keep only the booked class, kept=%', v_kept;
  END IF;
  IF (SELECT count(*) FROM classes WHERE template_id = v_template AND (starts_at AT TIME ZONE 'America/Bogota')::time = '06:00') <> 1 THEN
    RAISE EXCEPTION 'assertion failed: only the booked 06:00 class should survive the time change';
  END IF;

  v_kept := admin_save_class_template(v_template, 'Tmpl Smoke', '00000000-0000-0000-0000-0000000000d1',
    extract(dow from (now() at time zone 'America/Bogota') + interval '2 days')::int, '07:00', 45, 2, false);
  IF v_kept <> 1 OR (SELECT count(*) FROM classes WHERE template_id = v_template AND status = 'scheduled') <> 1 THEN
    RAISE EXCEPTION 'assertion failed: deactivating should remove every unbooked future class, kept=%', v_kept;
  END IF;

  BEGIN
    UPDATE class_templates SET title = 'direct' WHERE id = v_template;
    RAISE EXCEPTION 'assertion failed: direct template updates should be blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;

  -- scheduled job functions run cleanly with no matching rows
  PERFORM queue_class_reminders();
  PERFORM expire_lapsed_memberships();
  PERFORM update_weekly_streaks();

  RAISE NOTICE 'smoke test passed';
END;
$$;

ROLLBACK;
