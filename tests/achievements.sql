-- Regression check for admin-configurable achievements (see
-- supabase/migrations/*configurable-achievements.sql): "all time" vs dated
-- cards, every rule type, limited cards, hidden-until-start, the edit lock,
-- soft delete keeping XP, and who may write.
--
-- Run locally (after `npx supabase db reset`):
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f tests/achievements.sql
-- or against the linked project:
--   npx supabase db query --linked --file tests/achievements.sql
--
-- Everything runs in one transaction that's rolled back at the end. A failed
-- assertion raises an exception and aborts with a non-zero exit code.

BEGIN;
SET client_min_messages TO warning;
SET LOCAL search_path = public;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
SELECT id::uuid, email, 'x', now(), now(), now(), 'authenticated', 'authenticated'
FROM (VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'admin@ach.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'ana@ach.test'),
  ('00000000-0000-0000-0000-0000000000b3', 'beto@ach.test')
) AS u(id, email);

INSERT INTO admins (user_id) VALUES ('00000000-0000-0000-0000-0000000000b1');
INSERT INTO instructors (id, name) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 'Coach Ach A'),
  ('00000000-0000-0000-0000-0000000000f2', 'Coach Ach B');
INSERT INTO bikes (label) VALUES ('Ach T1');

-- five members far ahead hold the real Top 5, so the test members never
-- unlock the existing top_5 card by accident (production has few ranked members)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
SELECT ('00000000-0000-0000-0000-0000000008' || lpad(n::text, 2, '0'))::uuid, 'achtop' || n || '@test.local', 'x',
       now(), now(), now(), 'authenticated', 'authenticated'
FROM generate_series(1, 5) n;
INSERT INTO memberships (user_id) SELECT id FROM auth.users WHERE email LIKE 'achtop_@test.local';
INSERT INTO xp_transactions (user_id, amount, type) SELECT id, 1000000, 'bonus_class' FROM auth.users WHERE email LIKE 'achtop_@test.local';
UPDATE studio_settings SET schedule_published_until = studio_today() + 90 WHERE id;

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

-- the SQLSTATE p_sql raises as p_user, or null when it succeeds
CREATE FUNCTION pg_temp.error_as(p_user uuid, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.run_as(p_user, p_sql);
  RETURN null;
EXCEPTION WHEN others THEN
  RETURN CASE WHEN sqlstate = 'P0001' THEN sqlerrm ELSE sqlstate END;
END $$;

-- p_user can read the card row (RLS) / gets it from my_achievements()
CREATE FUNCTION pg_temp.sees(p_user uuid, p_card uuid) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', p_user)::text, true);
  SET LOCAL ROLE authenticated;
  v := EXISTS (SELECT 1 FROM public.achievements WHERE id = p_card);
  RESET ROLE;
  RETURN v;
END $$;

CREATE FUNCTION pg_temp.listed(p_user uuid, p_card uuid) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', p_user)::text, true);
  SET LOCAL ROLE authenticated;
  v := EXISTS (SELECT 1 FROM public.my_achievements() WHERE id = p_card);
  RESET ROLE;
  RETURN v;
END $$;

CREATE FUNCTION pg_temp.xp(p_user uuid) RETURNS int LANGUAGE sql AS $$
  SELECT coalesce(sum(amount), 0)::int FROM xp_transactions WHERE user_id = p_user
$$;

-- an attended class at a Bogota wall-clock date/time
CREATE FUNCTION pg_temp.attend(p_user uuid, p_day date, p_time time, p_instructor text) RETURNS void LANGUAGE sql AS $$
  WITH c AS (
    INSERT INTO classes (title, instructor_id, starts_at, duration_minutes, capacity, status)
    VALUES ('Ach ' || p_day || ' ' || p_time, ('00000000-0000-0000-0000-0000000000' || p_instructor)::uuid,
            (p_day + p_time) AT TIME ZONE 'America/Bogota', 45, 2, 'completed')
    RETURNING id
  )
  INSERT INTO reservations (class_id, user_id, bike_id, status)
  SELECT c.id, p_user, (SELECT id FROM bikes WHERE label = 'Ach T1'), 'attended' FROM c
$$;

CREATE FUNCTION pg_temp.card(
  p_name text, p_rule text, p_threshold int,
  p_starts date DEFAULT null, p_ends date DEFAULT null,
  p_hour int DEFAULT null, p_instructor text DEFAULT null, p_weekday int DEFAULT null
) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO achievements (name, description, xp_reward, rule, threshold, starts_on, ends_on, hour, instructor_id, weekday)
  VALUES (p_name, p_name, 100, p_rule, p_threshold, p_starts, p_ends, p_hour,
          ('00000000-0000-0000-0000-0000000000' || p_instructor)::uuid, p_weekday)
  RETURNING id
$$;

-- XP paid to p_user for one card
CREATE FUNCTION pg_temp.card_xp(p_user uuid, p_card uuid) RETURNS int LANGUAGE sql AS $$
  SELECT coalesce(sum(amount), 0)::int FROM xp_transactions
  WHERE user_id = p_user AND type = 'achievement' AND reference_id = p_card
$$;

CREATE FUNCTION pg_temp.has(p_user uuid, p_card uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user AND achievement_id = p_card)
$$;

CREATE FUNCTION pg_temp.progress(p_user uuid, p_card uuid) RETURNS int LANGUAGE sql AS $$
  SELECT progress FROM achievement_progress(p_user) WHERE achievement_id = p_card
$$;

DO $$
DECLARE
  v_admin CONSTANT uuid := '00000000-0000-0000-0000-0000000000b1';
  v_ana   CONSTANT uuid := '00000000-0000-0000-0000-0000000000b2';
  v_beto  CONSTANT uuid := '00000000-0000-0000-0000-0000000000b3';
  v_today CONSTANT date := studio_today();
  v_monday CONSTANT date := date_trunc('week', studio_today())::date;
  v_all uuid;
  v_dated uuid;
  v_future uuid;
  v_card uuid;
BEGIN
  PERFORM pg_temp.run_as(v_admin, format('select admin_create_membership(%L, ''Standard'', 10, 3, %L)', v_ana, v_today));
  PERFORM pg_temp.run_as(v_admin, format('select admin_create_membership(%L, ''Standard'', 10, 3, %L)', v_beto, v_today));

  -- Ana: three old morning classes with coach A
  PERFORM pg_temp.attend(v_ana, v_today - 40, '07:00', 'f1');
  PERFORM pg_temp.attend(v_ana, v_today - 39, '07:00', 'f1');
  PERFORM pg_temp.attend(v_ana, v_today - 38, '07:00', 'f1');
  PERFORM check_achievements(v_ana);

  -- 1. an "all time" card counts history and unlocks as soon as it's created --
  v_all := pg_temp.card('Tres clases', 'classes_total', 3);
  PERFORM pg_temp.ok(pg_temp.has(v_ana, v_all), 'all-time card counts past classes, unlocks on creation');
  PERFORM pg_temp.ok(pg_temp.card_xp(v_ana, v_all) = 100, 'and pays its XP');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM notifications WHERE user_id = v_ana AND title = 'Nuevo logro desbloqueado'
    AND data->>'achievement_id' = v_all::text), 'and notifies the member');

  -- 2. a dated card ignores classes before its start -------------------------
  v_dated := pg_temp.card('Tres desde', 'classes_total', 3, v_today - 5);
  PERFORM pg_temp.ok(NOT pg_temp.has(v_ana, v_dated) AND pg_temp.progress(v_ana, v_dated) = 0,
    'classes before the start date do not count');
  PERFORM pg_temp.attend(v_ana, v_today - 4, '19:00', 'f2');
  PERFORM pg_temp.attend(v_ana, v_today - 3, '19:00', 'f2');
  PERFORM check_achievements(v_ana);
  PERFORM pg_temp.ok(pg_temp.progress(v_ana, v_dated) = 2 AND NOT pg_temp.has(v_ana, v_dated), '2 of 3 since the start');
  PERFORM pg_temp.attend(v_ana, v_today - 2, '19:00', 'f2');
  PERFORM check_achievements(v_ana);
  PERFORM pg_temp.ok(pg_temp.has(v_ana, v_dated), 'third class since the start unlocks it');
  PERFORM pg_temp.ok(pg_temp.progress(v_ana, v_all) = 6, 'the all-time card keeps counting everything');

  -- 3. edit lock -------------------------------------------------------------
  PERFORM pg_temp.ok(pg_temp.error_as(v_admin, format('update achievements set threshold = 5 where id = %L', v_all))
    = 'achievement_locked', 'a card someone unlocked cannot be edited');
  PERFORM pg_temp.ok(pg_temp.error_as(v_admin, format('update achievements set name = ''X'' where id = %L', v_all))
    = 'achievement_locked', 'not even its name');
  v_future := pg_temp.card('Futuro', 'classes_total', 1, v_today + 5);
  PERFORM pg_temp.ok(pg_temp.error_as(v_admin, format('update achievements set threshold = 2 where id = %L', v_future)) IS NULL,
    'a card nobody has can be edited');

  -- 4. hidden until it starts ------------------------------------------------
  PERFORM pg_temp.ok(NOT pg_temp.sees(v_ana, v_future) AND NOT pg_temp.listed(v_ana, v_future), 'a future card is hidden from members');
  PERFORM pg_temp.ok(pg_temp.sees(v_admin, v_future), 'but the admin sees it');
  PERFORM pg_temp.ok(NOT pg_temp.has(v_ana, v_future), 'and nobody unlocks it early');
  PERFORM pg_temp.ok(pg_temp.listed(v_ana, v_all) AND pg_temp.listed(v_beto, v_all), 'live cards are listed for everyone');

  -- 5. rule types --------------------------------------------------------------
  v_card := pg_temp.card('Noche', 'classes_from_hour', 3, p_hour => 19);
  PERFORM pg_temp.ok(pg_temp.has(v_ana, v_card), 'classes_from_hour: three 19:00 classes');
  v_card := pg_temp.card('Mañana', 'classes_before_hour', 4, p_hour => 8);
  PERFORM pg_temp.ok(pg_temp.progress(v_ana, v_card) = 3 AND NOT pg_temp.has(v_ana, v_card), 'classes_before_hour: 3 of 4 before 08:00');
  v_card := pg_temp.card('Con B', 'classes_with_instructor', 3, p_instructor => 'f2');
  PERFORM pg_temp.ok(pg_temp.has(v_ana, v_card), 'classes_with_instructor');
  v_card := pg_temp.card('Con A', 'classes_with_instructor', 4, p_instructor => 'f1');
  PERFORM pg_temp.ok(pg_temp.progress(v_ana, v_card) = 3, 'classes_with_instructor counts only that coach');
  v_card := pg_temp.card('Dos coaches', 'distinct_instructors', 2);
  PERFORM pg_temp.ok(pg_temp.has(v_ana, v_card), 'distinct_instructors');
  v_card := pg_temp.card('Día', 'classes_on_weekday', 1, v_today - 4, v_today - 4, p_weekday => extract(isodow FROM v_today - 4)::int);
  PERFORM pg_temp.ok(pg_temp.has(v_ana, v_card), 'classes_on_weekday (Bogota day)');
  v_card := pg_temp.card('Otro día', 'classes_on_weekday', 1, v_today - 4, v_today - 4, p_weekday => extract(isodow FROM v_today - 3)::int);
  PERFORM pg_temp.ok(NOT pg_temp.has(v_ana, v_card), 'classes_on_weekday ignores other days');

  -- Beto: goal met (3 classes) in each of the last two finished weeks
  PERFORM pg_temp.attend(v_beto, v_monday - 14, '18:00', 'f1');
  PERFORM pg_temp.attend(v_beto, v_monday - 13, '18:00', 'f1');
  PERFORM pg_temp.attend(v_beto, v_monday - 12, '18:00', 'f1');
  PERFORM pg_temp.attend(v_beto, v_monday - 7, '18:00', 'f1');
  PERFORM pg_temp.attend(v_beto, v_monday - 6, '18:00', 'f1');
  PERFORM pg_temp.attend(v_beto, v_monday - 5, '18:00', 'f1');
  v_card := pg_temp.card('Semana', 'classes_in_week', 3);
  PERFORM pg_temp.ok(pg_temp.has(v_beto, v_card), 'classes_in_week');
  v_card := pg_temp.card('Semana x4', 'classes_in_week', 4);
  PERFORM pg_temp.ok(pg_temp.progress(v_beto, v_card) = 3, 'classes_in_week takes the best week, not the total');
  v_card := pg_temp.card('Racha 2', 'streak_weeks', 2, v_monday - 14);
  PERFORM pg_temp.ok(pg_temp.has(v_beto, v_card), 'dated streak: two goal weeks in a row since the start');
  v_card := pg_temp.card('Racha 2 tarde', 'streak_weeks', 2, v_monday - 7);
  PERFORM pg_temp.ok(pg_temp.progress(v_beto, v_card) = 1, 'dated streak ignores weeks before the start');
  v_card := pg_temp.card('Racha siempre', 'streak_weeks', 2);
  PERFORM pg_temp.ok(pg_temp.progress(v_beto, v_card) = 0, 'all-time streak uses the tracked streak (none yet)');
  UPDATE user_stats SET max_streak_weeks = 2 WHERE user_id = v_beto;
  PERFORM check_achievements(v_beto);
  PERFORM pg_temp.ok(pg_temp.has(v_beto, v_card), 'all-time streak counts the best streak ever');

  -- 6. limited cards and the ranking window ------------------------------------
  v_card := pg_temp.card('Pasado', 'classes_total', 100, v_today - 30, v_today - 1);
  PERFORM pg_temp.ok(NOT pg_temp.listed(v_ana, v_card), 'an ended card nobody earned disappears');
  v_card := pg_temp.card('Pasado ganado', 'classes_total', 1, v_today - 10, v_today - 3);
  PERFORM pg_temp.ok(pg_temp.has(v_ana, v_card) AND pg_temp.listed(v_ana, v_card), 'an ended card you earned stays');
  PERFORM pg_temp.ok(pg_temp.progress(v_ana, v_card) = 2, 'classes after the end date do not count');
  v_card := pg_temp.card('Ranking pasado', 'leaderboard_top', 1000000, NULL, v_today - 1);
  PERFORM pg_temp.ok(NOT pg_temp.has(v_ana, v_card), 'an ended ranking card is not earned');
  v_card := pg_temp.card('Ranking', 'leaderboard_top', 1000000);
  PERFORM pg_temp.ok(pg_temp.has(v_ana, v_card), 'a ranked member earns a live ranking card');

  -- 7. soft delete keeps XP and is final ---------------------------------------
  PERFORM pg_temp.ok(pg_temp.error_as(v_admin, format('update achievements set deleted_at = now() where id = %L', v_all)) IS NULL,
    'a card with unlocks can still be removed');
  PERFORM pg_temp.ok(pg_temp.card_xp(v_ana, v_all) = 100 AND pg_temp.has(v_ana, v_all), 'removing a card keeps the unlock and its XP');
  PERFORM pg_temp.ok(NOT pg_temp.sees(v_ana, v_all) AND NOT pg_temp.listed(v_ana, v_all), 'a removed card is hidden');
  PERFORM pg_temp.ok(pg_temp.error_as(v_admin, format('update achievements set deleted_at = null where id = %L', v_all))
    = 'achievement_deleted', 'a removed card cannot come back');

  -- 8. who may write -------------------------------------------------------------
  PERFORM pg_temp.ok(pg_temp.error_as(v_ana,
    'insert into achievements (name, description, rule, threshold) values (''Hack'', ''x'', ''classes_total'', 1)') = '42501',
    'members cannot create cards');
  PERFORM pg_temp.ok(pg_temp.error_as(v_ana, format('update achievements set xp_reward = 9999 where id = %L', v_future)) IS NULL
    AND (SELECT xp_reward FROM achievements WHERE id = v_future) = 100, 'members cannot edit cards');
  PERFORM pg_temp.ok(pg_temp.error_as(v_admin,
    'insert into achievements (name, description, rule, threshold) values (''Admin'', ''x'', ''classes_total'', 1)') IS NULL,
    'the admin creates cards through the API');
  PERFORM pg_temp.ok(pg_temp.error_as(v_admin, format('delete from achievements where id = %L', v_future)) = '42501'
    AND EXISTS (SELECT 1 FROM achievements WHERE id = v_future), 'cards are never hard-deleted');
  PERFORM pg_temp.ok(pg_temp.error_as(v_admin,
    'insert into achievements (name, description, rule, threshold) values (''Sin hora'', ''x'', ''classes_from_hour'', 1)') = '23514',
    'an hour rule needs an hour');
  PERFORM pg_temp.ok(pg_temp.error_as(v_ana, format('select check_achievements(%L)', v_ana)) = '42501',
    'members cannot run the checker');

  RAISE NOTICE 'achievement tests passed';
END;
$$;

ROLLBACK;
