-- Regression check for the membership rules (see
-- supabase/migrations/*membership-rules.sql and *bogota-time-and-achievements.sql):
-- paid-period booking gate in Bogota dates, credits that don't roll over,
-- double-renewal guard, cancel/expiry releasing bookings, no-show undoing XP
-- and achievements, the one-time cleanup of legacy bookings, and the general
-- ranking with its "overtaken" notifications (see *general-leaderboard.sql).
--
-- Run locally (after `npx supabase db reset`):
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f tests/memberships.sql
-- or against the linked project:
--   npx supabase db query --linked --file tests/memberships.sql
--
-- Everything runs in one transaction that's rolled back at the end. A failed
-- assertion raises an exception and aborts with a non-zero exit code.

BEGIN;
SET client_min_messages TO warning;
SET LOCAL search_path = public;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
SELECT id::uuid, email, 'x', now(), now(), now(), 'authenticated', 'authenticated'
FROM (VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin@memb.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'ana@memb.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'beto@memb.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'caro@memb.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'dani@memb.test'),
  ('00000000-0000-0000-0000-0000000000a6', 'eva@memb.test'),
  ('00000000-0000-0000-0000-0000000000a7', 'fran@memb.test'),
  ('00000000-0000-0000-0000-0000000000a8', 'gina@memb.test')
) AS u(id, email);

INSERT INTO admins (user_id) VALUES ('00000000-0000-0000-0000-0000000000a1');

-- five members far ahead hold the Top 5 (top_5 achievement), so the test
-- users' XP doesn't depend on which members the database already has
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
SELECT ('00000000-0000-0000-0000-0000000009' || lpad(n::text, 2, '0'))::uuid, 'top' || n || '@test.local', 'x',
       now(), now(), now(), 'authenticated', 'authenticated'
FROM generate_series(1, 5) n;
INSERT INTO memberships (user_id) SELECT id FROM auth.users WHERE email LIKE 'top_@test.local';
INSERT INTO xp_transactions (user_id, amount, type) SELECT id, 1000000, 'bonus_class' FROM auth.users WHERE email LIKE 'top_@test.local';
INSERT INTO bikes (label) VALUES ('Memb T1'), ('Memb T2');
INSERT INTO instructors (id, name) VALUES ('00000000-0000-0000-0000-0000000000e1', 'Coach Memb');
UPDATE studio_settings SET cancellation_cutoff_hours = 12, schedule_published_until = studio_today() + 90 WHERE id;

-- helpers ---------------------------------------------------------------------
CREATE FUNCTION pg_temp.ok(p_cond boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN RAISE EXCEPTION 'assertion failed: %', p_msg; END IF;
END $$;

-- runs p_sql as p_user through the API role, so RLS and grants apply
CREATE FUNCTION pg_temp.run_as(p_user uuid, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', p_user)::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE p_sql;
  RESET ROLE;
END $$;

CREATE FUNCTION pg_temp.fails_with(p_user uuid, p_sql text, p_error text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM pg_temp.run_as(p_user, p_sql);
  EXCEPTION WHEN raise_exception THEN
    IF sqlerrm <> p_error THEN
      RAISE EXCEPTION 'assertion failed: expected %, got "%" from: %', p_error, sqlerrm, p_sql;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'assertion failed: expected % from: %', p_error, p_sql;
END $$;

CREATE FUNCTION pg_temp.balance(p_user uuid) RETURNS int LANGUAGE sql AS $$
  SELECT coalesce(sum(amount), 0)::int FROM credit_transactions WHERE user_id = p_user
$$;

CREATE FUNCTION pg_temp.xp(p_user uuid) RETURNS int LANGUAGE sql AS $$
  SELECT coalesce(sum(amount), 0)::int FROM xp_transactions WHERE user_id = p_user
$$;

CREATE FUNCTION pg_temp.membership(p_user uuid) RETURNS memberships LANGUAGE sql AS $$
  SELECT * FROM memberships WHERE user_id = p_user
$$;

-- a class at a Bogota wall-clock date/time
CREATE FUNCTION pg_temp.new_class(p_day date, p_time time, p_capacity int DEFAULT 2, p_status text DEFAULT 'scheduled')
RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO classes (title, instructor_id, starts_at, duration_minutes, capacity, status)
  VALUES ('Memb ' || p_day || ' ' || p_time, '00000000-0000-0000-0000-0000000000e1',
          (p_day + p_time) AT TIME ZONE 'America/Bogota', 45, p_capacity, p_status)
  RETURNING id
$$;

CREATE FUNCTION pg_temp.reservation_status(p_class uuid, p_user uuid) RETURNS text LANGUAGE sql AS $$
  SELECT status FROM reservations WHERE class_id = p_class AND user_id = p_user ORDER BY created_at DESC LIMIT 1
$$;

CREATE FUNCTION pg_temp.has_achievement(p_user uuid, p_code text) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id
    WHERE ua.user_id = p_user AND a.code = p_code
  )
$$;

CREATE FUNCTION pg_temp.has_notification(p_user uuid, p_title text) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM notifications WHERE user_id = p_user AND title = p_title)
$$;

DO $$
DECLARE
  v_admin CONSTANT uuid := '00000000-0000-0000-0000-0000000000a1';
  v_ana   CONSTANT uuid := '00000000-0000-0000-0000-0000000000a2';
  v_beto  CONSTANT uuid := '00000000-0000-0000-0000-0000000000a3';
  v_caro  CONSTANT uuid := '00000000-0000-0000-0000-0000000000a4';
  v_dani  CONSTANT uuid := '00000000-0000-0000-0000-0000000000a5';
  v_eva   CONSTANT uuid := '00000000-0000-0000-0000-0000000000a6';
  v_fran  CONSTANT uuid := '00000000-0000-0000-0000-0000000000a7';
  v_gina  CONSTANT uuid := '00000000-0000-0000-0000-0000000000a8';
  v_today CONSTANT date := studio_today();
  v_t1 uuid := (SELECT id FROM bikes WHERE label = 'Memb T1');
  v_t2 uuid := (SELECT id FROM bikes WHERE label = 'Memb T2');
  v_m memberships;
  v_class uuid;
  v_class2 uuid;
  v_res uuid;
  v_res2 uuid;
  v_ana_last_day uuid;
BEGIN
  PERFORM pg_temp.ok(v_today = (now() AT TIME ZONE 'America/Bogota')::date, 'studio_today() is the Bogota date');

  -- assign through the admin RPC -----------------------------------------------
  PERFORM pg_temp.run_as(v_admin, format('select admin_create_membership(%L, ''Standard'', 10, 3, %L)', v_ana, v_today - 10));
  PERFORM pg_temp.run_as(v_admin, format('select admin_create_membership(%L, ''Standard'', 10, 3, %L)', v_dani, v_today + 5));
  PERFORM pg_temp.run_as(v_admin, format('select admin_create_membership(%L, ''Standard'', 10, 3, %L)', v_beto, v_today));
  PERFORM pg_temp.run_as(v_admin, format('select admin_create_membership(%L, ''Standard'', 10, 3, %L)', v_caro, v_today));
  PERFORM pg_temp.run_as(v_admin, format('select admin_create_membership(%L, ''Standard'', 10, 3, %L)', v_eva, v_today));
  PERFORM pg_temp.run_as(v_admin, format('select admin_create_membership(%L, ''Standard'', 10, 3, %L)', v_fran, v_today));
  PERFORM pg_temp.run_as(v_admin, format('select admin_create_membership(%L, ''Standard'', 10, 3, %L)', v_gina, v_today));

  -- 1. cycle dates ---------------------------------------------------------------
  v_m := pg_temp.membership(v_ana);
  PERFORM pg_temp.ok(v_m.cycle_end = (v_today - 10 + interval '1 month' - interval '1 day')::date,
    'cycle_end is start + 1 month - 1 day');
  PERFORM pg_temp.ok(pg_temp.balance(v_ana) = 10, 'assigning grants the plan credits');
  PERFORM pg_temp.fails_with(v_admin,
    format('select admin_grant_credits_bulk(array[%L]::uuid[], %L::date)', v_ana, v_today - 40), 'cycle_already_over');
  PERFORM pg_temp.fails_with(v_ana,
    format('select admin_create_membership(%L, ''Standard'', 10, 3, %L)', v_ana, v_today), 'not_authorized');

  -- 2. bookings only inside the paid period, in Bogota dates ---------------------
  -- 20:00 Bogota on the last day is already the next day in UTC
  v_ana_last_day := pg_temp.new_class(v_m.cycle_end, '20:00');
  PERFORM pg_temp.run_as(v_ana, format('select book_class(%L, %L)', v_ana_last_day, v_t1));
  PERFORM pg_temp.ok(pg_temp.reservation_status(v_ana_last_day, v_ana) = 'booked', 'last day of the cycle is bookable at night');

  v_class := pg_temp.new_class(v_m.cycle_end + 1, '07:00');
  PERFORM pg_temp.fails_with(v_ana, format('select book_class(%L, %L)', v_class, v_t1), 'membership_not_valid_for_class');
  PERFORM pg_temp.fails_with(v_ana, format('select join_waitlist(%L)', v_class), 'membership_not_valid_for_class');

  -- a future start date doesn't unlock classes before it
  v_class := pg_temp.new_class(v_today + 1, '18:00');
  PERFORM pg_temp.fails_with(v_dani, format('select book_class(%L, %L)', v_class, v_t1), 'membership_not_valid_for_class');
  v_class := pg_temp.new_class(v_today + 5, '07:00');
  PERFORM pg_temp.run_as(v_dani, format('select book_class(%L, %L)', v_class, v_t1));
  PERFORM pg_temp.ok(pg_temp.reservation_status(v_class, v_dani) = 'booked', 'first day of a future cycle is bookable');

  -- 3. renewal: no double renewal, leftovers don't roll over ---------------------
  PERFORM pg_temp.ok(pg_temp.balance(v_ana) = 9, 'booking spent 1 credit');
  PERFORM pg_temp.run_as(v_admin, format('select admin_grant_credits_bulk(array[%L]::uuid[], %L::date)', v_ana, v_today - 10));
  PERFORM pg_temp.ok(pg_temp.balance(v_ana) = 9, 'renewing to the same start date is a no-op');

  PERFORM pg_temp.run_as(v_admin, format('select admin_grant_credits_bulk(array[%L]::uuid[], %L::date)', v_ana, v_today));
  v_m := pg_temp.membership(v_ana);
  PERFORM pg_temp.ok(pg_temp.balance(v_ana) = 10, 'renewal resets the balance to the plan amount, no rollover');
  PERFORM pg_temp.ok(v_m.cycle_start = v_today AND v_m.status = 'active', 'renewal moves cycle_start');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM credit_transactions WHERE user_id = v_ana AND type = 'cycle_reset' AND amount = -9),
    'leftover credits are written off as cycle_reset');
  PERFORM pg_temp.ok(pg_temp.has_notification(v_ana, 'Membresia renovada'), 'renewal notifies the member');

  -- 4. credit adjustments can't go negative --------------------------------------
  PERFORM pg_temp.fails_with(v_admin, format('select admin_adjust_credits(%L, -11, null)', v_ana), 'negative_balance');

  -- 5. cancelling releases bookings, waitlist spots and credits ------------------
  v_class := pg_temp.new_class(v_today + 2, '18:00', 1);
  v_class2 := pg_temp.new_class(v_today + 3, '18:00', 1);
  PERFORM pg_temp.run_as(v_beto, format('select book_class(%L, %L)', v_class, v_t1));
  PERFORM pg_temp.run_as(v_caro, format('select join_waitlist(%L)', v_class));
  PERFORM pg_temp.run_as(v_caro, format('select book_class(%L, %L)', v_class2, v_t1));
  PERFORM pg_temp.run_as(v_beto, format('select join_waitlist(%L)', v_class2));

  PERFORM pg_temp.run_as(v_admin, format('select admin_cancel_membership(%L)', (pg_temp.membership(v_beto)).id));
  PERFORM pg_temp.ok((pg_temp.membership(v_beto)).status = 'cancelled', 'membership is cancelled');
  PERFORM pg_temp.ok(pg_temp.reservation_status(v_class, v_beto) = 'cancelled', 'cancelling releases future bookings');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM reservations WHERE class_id = v_class AND user_id = v_caro AND bike_id = v_t1 AND status = 'booked'),
    'the freed bike goes to the waitlist');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM waitlist_entries WHERE user_id = v_beto AND status = 'waiting'),
    'cancelling removes the member from waitlists');
  PERFORM pg_temp.ok(pg_temp.balance(v_beto) = 0, 'cancelling zeroes the balance');
  PERFORM pg_temp.ok(pg_temp.balance(v_caro) = 8, 'promotion charges the promoted member');
  PERFORM pg_temp.ok(pg_temp.has_notification(v_beto, 'Membresia cancelada'), 'cancelling notifies the member');
  PERFORM pg_temp.fails_with(v_beto, format('select book_class(%L, %L)', v_class2, v_t2), 'no_active_membership');
  -- cancelling again is a no-op
  PERFORM pg_temp.run_as(v_admin, format('select admin_cancel_membership(%L)', (pg_temp.membership(v_beto)).id));

  -- 6. expiry releases like a cancel; expired members break their streak ---------
  v_class := pg_temp.new_class(v_today + 1, '19:00');
  PERFORM pg_temp.run_as(v_eva, format('select book_class(%L, %L)', v_class, v_t2));
  UPDATE memberships SET cycle_end = v_today - 1 WHERE user_id = v_eva; -- lapse (trigger only reacts to cycle_start)
  UPDATE user_stats SET current_streak_weeks = 3 WHERE user_id = v_eva;

  PERFORM expire_lapsed_memberships();
  PERFORM pg_temp.ok((pg_temp.membership(v_eva)).status = 'expired', 'lapsed membership expires');
  PERFORM pg_temp.ok((pg_temp.membership(v_ana)).status = 'active', 'a covered membership is untouched');
  PERFORM pg_temp.ok(pg_temp.reservation_status(v_class, v_eva) = 'cancelled', 'expiry releases future bookings');
  PERFORM pg_temp.ok(pg_temp.balance(v_eva) = 0, 'expiry zeroes the balance');
  PERFORM pg_temp.ok(pg_temp.has_notification(v_eva, 'Membresia vencida'), 'expiry notifies the member');
  PERFORM pg_temp.fails_with(v_eva, format('select book_class(%L, %L)', v_class, v_t2), 'no_active_membership');

  PERFORM update_weekly_streaks();
  PERFORM pg_temp.ok((SELECT current_streak_weeks FROM user_stats WHERE user_id = v_eva) = 0, 'expired members break their streak');

  -- reactivating with a start date whose cycle is already over is rejected
  -- (an old expired row, written with the trigger off as it predates it)
  ALTER TABLE memberships DISABLE TRIGGER memberships_set_cycle_end;
  UPDATE memberships SET cycle_start = v_today - 40, cycle_end = (v_today - 40 + interval '1 month' - interval '1 day')::date, status = 'expired'
  WHERE user_id = v_gina;
  ALTER TABLE memberships ENABLE TRIGGER memberships_set_cycle_end;
  PERFORM pg_temp.fails_with(v_admin,
    format('select admin_grant_credits_bulk(array[%L]::uuid[], %L::date)', v_gina, v_today - 40), 'cycle_already_over');

  -- renewing an expired membership reactivates it
  PERFORM pg_temp.run_as(v_admin, format('select admin_grant_credits_bulk(array[%L]::uuid[], %L::date)', v_eva, v_today));
  v_m := pg_temp.membership(v_eva);
  PERFORM pg_temp.ok(v_m.status = 'active' AND v_m.cycle_end = (v_today + interval '1 month' - interval '1 day')::date,
    'renewal reactivates an expired membership');
  PERFORM pg_temp.ok(pg_temp.balance(v_eva) = 10, 'renewal grants the plan credits');

  -- 7. no-show on an auto-attended class undoes its XP and achievements ----------
  v_class := pg_temp.new_class(v_today - 1, '07:00');
  INSERT INTO reservations (class_id, user_id, bike_id) VALUES (v_class, v_ana, v_t1) RETURNING id INTO v_res;
  PERFORM close_finished_classes();
  PERFORM pg_temp.ok(pg_temp.reservation_status(v_class, v_ana) = 'attended', 'finished class is auto-attended');
  PERFORM pg_temp.ok(pg_temp.xp(v_ana) = 200, 'attending awards class XP + first_ride');
  PERFORM pg_temp.ok(pg_temp.has_achievement(v_ana, 'first_ride'), 'first_ride unlocked');

  PERFORM pg_temp.fails_with(v_ana, format('select mark_no_show(%L)', v_res), 'not_authorized');
  PERFORM pg_temp.run_as(v_admin, format('select mark_no_show(%L)', v_res));
  PERFORM pg_temp.ok(pg_temp.reservation_status(v_class, v_ana) = 'no_show', 'reservation is a no-show');
  PERFORM pg_temp.ok(NOT pg_temp.has_achievement(v_ana, 'first_ride'), 'no-show revokes the achievement it unlocked');
  PERFORM pg_temp.ok(pg_temp.xp(v_ana) = 0, 'no-show reverts class and achievement XP');
  PERFORM pg_temp.ok((SELECT classes_completed FROM user_stats WHERE user_id = v_ana) = 0, 'no-show is not a completed class');
  PERFORM pg_temp.fails_with(v_admin, format('select mark_no_show(%L)', v_res), 'reservation_not_markable');

  -- 8. early_bird counts the Bogota hour (07:00 Bogota = 12:00 UTC) --------------
  FOR i IN 2..6 LOOP
    v_class := pg_temp.new_class(v_today - i, '07:00', 2, 'completed');
    INSERT INTO reservations (class_id, user_id, bike_id, status) VALUES (v_class, v_caro, v_t1, 'attended');
  END LOOP;
  PERFORM check_achievements(v_caro);
  PERFORM pg_temp.ok(pg_temp.has_achievement(v_caro, 'early_bird'), 'five 07:00 Bogota classes unlock early_bird');
  PERFORM pg_temp.ok(NOT pg_temp.has_achievement(v_caro, 'night_rider'), 'morning classes do not count as night_rider');

  -- 9. one-time cleanup of bookings made before the period rule -------------------
  v_m := pg_temp.membership(v_fran);
  v_class := pg_temp.new_class(v_m.cycle_end + 3, '18:00');
  INSERT INTO reservations (class_id, user_id, bike_id) VALUES (v_class, v_fran, v_t1) RETURNING id INTO v_res;
  INSERT INTO credit_transactions (user_id, amount, type, reference_id) VALUES (v_fran, -1, 'booking', v_res);

  v_class2 := pg_temp.new_class(v_today + 4, '18:00');
  INSERT INTO reservations (class_id, user_id, bike_id) VALUES (v_class2, v_gina, v_t1) RETURNING id INTO v_res2;
  UPDATE memberships SET status = 'expired' WHERE user_id = v_gina; -- expired under the old rules: kept credits + booking

  PERFORM release_uncovered_bookings();
  PERFORM pg_temp.ok(pg_temp.reservation_status(v_class, v_fran) = 'cancelled', 'booking outside an active period is cancelled');
  PERFORM pg_temp.ok(pg_temp.balance(v_fran) = 10, 'and its credit refunded');
  PERFORM pg_temp.ok(pg_temp.has_notification(v_fran, 'Reserva cancelada'), 'and the member notified');
  PERFORM pg_temp.ok((pg_temp.membership(v_fran)).status = 'active', 'the active membership is kept');
  PERFORM pg_temp.ok(pg_temp.reservation_status(v_class2, v_gina) = 'cancelled', 'an expired member''s bookings are released');
  PERFORM pg_temp.ok(pg_temp.balance(v_gina) = 0, 'an expired member''s credits are zeroed');
  PERFORM pg_temp.ok(pg_temp.reservation_status(v_ana_last_day, v_ana) = 'booked', 'covered bookings are untouched');

  -- 10. general ranking by total XP + overtaken notifications ---------------------
  INSERT INTO xp_transactions (user_id, amount, type) VALUES (v_caro, 100, 'weekly_goal');
  PERFORM pg_temp.ok((SELECT xp FROM leaderboard WHERE user_id = v_caro) = pg_temp.xp(v_caro),
    'ranking uses total XP, bonuses included');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM leaderboard WHERE user_id IN (v_admin, v_beto, v_ana)),
    'admins, cancelled members and members without XP are not ranked');
  PERFORM pg_temp.run_as(v_ana, 'select count(*) from leaderboard');

  PERFORM notify_overtaken(); -- snapshot
  INSERT INTO xp_transactions (user_id, amount, type) VALUES (v_eva, pg_temp.xp(v_caro) + 100, 'bonus_class');
  PERFORM notify_overtaken();
  PERFORM pg_temp.ok(pg_temp.has_notification(v_caro, 'Te superaron en el ranking'), 'overtaken member is notified');
  PERFORM pg_temp.ok(NOT pg_temp.has_notification(v_eva, 'Te superaron en el ranking'), 'the one who passed is not');

  -- catching up to a tie shares the rank: nobody was overtaken
  INSERT INTO xp_transactions (user_id, amount, type) VALUES (v_caro, 100, 'bonus_class');
  PERFORM notify_overtaken();
  PERFORM pg_temp.ok(NOT pg_temp.has_notification(v_eva, 'Te superaron en el ranking'), 'a tie is not overtaking');
  PERFORM pg_temp.ok((SELECT count(*) FROM notifications WHERE user_id = v_caro AND title = 'Te superaron en el ranking') = 1,
    'no repeat notification without a new drop');

  -- 11. top_5: earned by being in the Top 5 of the general ranking ----------------
  PERFORM check_achievements(v_caro);
  PERFORM pg_temp.ok(NOT pg_temp.has_achievement(v_caro, 'top_5'), 'outside the Top 5 there is no top_5');
  INSERT INTO xp_transactions (user_id, amount, type) VALUES (v_caro, 10000000, 'bonus_class');
  PERFORM check_achievements(v_caro);
  PERFORM check_achievements(v_ana);
  PERFORM pg_temp.ok(pg_temp.has_achievement(v_caro, 'top_5'), 'a Top 5 member earns top_5');
  PERFORM pg_temp.ok(NOT pg_temp.has_achievement(v_ana, 'top_5'), 'an unranked member does not');

  RAISE NOTICE 'membership tests passed';
END;
$$;

ROLLBACK;
