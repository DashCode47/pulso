-- Pulso: business logic
-- Every write to credits, XP, reservations, and waitlist happens through the
-- SECURITY DEFINER functions below, called via insforge.database.rpc(...)
-- from the client. RLS + REVOKEs on the base tables deny direct client
-- writes to them (see previous migration), so there is no way to bypass
-- this logic from a compromised or buggy client.

-- ---------------------------------------------------------------------------
-- level formula: flat 500 XP per level. Tune the divisor here if the pacing
-- feels off -- nothing else in the schema depends on the exact curve.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION xp_to_level(p_xp INT) RETURNS INT
LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(1, FLOOR(p_xp / 500.0)::int + 1);
$$;

-- ---------------------------------------------------------------------------
-- user_stats is a read cache rebuilt from the ledgers on every write, never
-- edited directly. This trades a few redundant recomputes (irrelevant at
-- 60-80 users) for zero risk of the cache drifting from the ledgers.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_user_stats() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_user_id UUID := COALESCE(NEW.user_id, OLD.user_id);
  v_xp INT;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_xp FROM public.xp_transactions WHERE user_id = v_user_id;

  INSERT INTO public.user_stats (user_id, total_xp, current_level, classes_completed, credits_balance, updated_at)
  VALUES (
    v_user_id,
    v_xp,
    xp_to_level(v_xp),
    (SELECT COUNT(*) FROM public.reservations WHERE user_id = v_user_id AND status = 'attended'),
    (SELECT COALESCE(SUM(amount), 0) FROM public.credit_transactions WHERE user_id = v_user_id),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp = excluded.total_xp,
    current_level = excluded.current_level,
    classes_completed = excluded.classes_completed,
    credits_balance = excluded.credits_balance,
    updated_at = now();
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_stats_on_xp
  AFTER INSERT ON xp_transactions
  FOR EACH ROW EXECUTE FUNCTION sync_user_stats();

CREATE TRIGGER sync_stats_on_credit
  AFTER INSERT ON credit_transactions
  FOR EACH ROW EXECUTE FUNCTION sync_user_stats();

CREATE TRIGGER sync_stats_on_reservation
  AFTER UPDATE OF status ON reservations
  FOR EACH ROW WHEN (NEW.status = 'attended' OR OLD.status = 'attended')
  EXECUTE FUNCTION sync_user_stats();

-- seed a zeroed stats row as soon as a membership exists, so later ledger
-- inserts always have a row to UPSERT into and the weekly-streak job never
-- skips a member for lack of a row.
CREATE OR REPLACE FUNCTION seed_user_stats() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  INSERT INTO public.user_stats (user_id) VALUES (NEW.user_id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER memberships_seed_user_stats
  AFTER INSERT ON memberships
  FOR EACH ROW EXECUTE FUNCTION seed_user_stats();

-- ---------------------------------------------------------------------------
-- achievements
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION unlock_achievement(p_user_id UUID, p_code TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_achievement public.achievements%ROWTYPE;
BEGIN
  SELECT * INTO v_achievement FROM public.achievements WHERE code = p_code;
  IF v_achievement IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (p_user_id, v_achievement.id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;

  IF FOUND THEN
    INSERT INTO public.xp_transactions (user_id, amount, type, reference_id)
    VALUES (p_user_id, v_achievement.xp_reward, 'achievement', v_achievement.id);

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (p_user_id, 'achievement', 'Nuevo logro desbloqueado', v_achievement.name,
            jsonb_build_object('achievement_id', v_achievement.id));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION check_achievements(p_user_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_stats public.user_stats%ROWTYPE;
  v_early_bird_count INT;
  v_night_rider_count INT;
BEGIN
  SELECT * INTO v_stats FROM public.user_stats WHERE user_id = p_user_id;
  IF v_stats IS NULL THEN
    RETURN;
  END IF;

  IF v_stats.classes_completed >= 1 THEN PERFORM unlock_achievement(p_user_id, 'first_ride'); END IF;
  IF v_stats.classes_completed >= 10 THEN PERFORM unlock_achievement(p_user_id, 'ten_rides'); END IF;
  IF v_stats.classes_completed >= 50 THEN PERFORM unlock_achievement(p_user_id, 'fifty_rides'); END IF;
  IF v_stats.current_streak_weeks >= 7 THEN PERFORM unlock_achievement(p_user_id, 'on_fire'); END IF;
  IF v_stats.current_streak_weeks >= 4 THEN PERFORM unlock_achievement(p_user_id, 'consistent'); END IF;

  SELECT COUNT(*) INTO v_early_bird_count
  FROM public.reservations r JOIN public.classes c ON c.id = r.class_id
  WHERE r.user_id = p_user_id AND r.status = 'attended' AND EXTRACT(HOUR FROM c.starts_at) < 9;
  IF v_early_bird_count >= 5 THEN PERFORM unlock_achievement(p_user_id, 'early_bird'); END IF;

  SELECT COUNT(*) INTO v_night_rider_count
  FROM public.reservations r JOIN public.classes c ON c.id = r.class_id
  WHERE r.user_id = p_user_id AND r.status = 'attended' AND EXTRACT(HOUR FROM c.starts_at) >= 19;
  IF v_night_rider_count >= 5 THEN PERFORM unlock_achievement(p_user_id, 'night_rider'); END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- waitlist
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION offer_next_waitlist(p_class_id UUID, p_bike_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_entry public.waitlist_entries%ROWTYPE;
BEGIN
  SELECT * INTO v_entry FROM public.waitlist_entries
  WHERE class_id = p_class_id AND status = 'waiting'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_entry IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.waitlist_entries
  SET status = 'offered', bike_id = p_bike_id, offer_expires_at = now() + interval '15 minutes'
  WHERE id = v_entry.id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (v_entry.user_id, 'waitlist_offer', 'Se libero una bicicleta',
          'Tienes 15 minutos para reclamarla.',
          jsonb_build_object('waitlist_entry_id', v_entry.id, 'class_id', p_class_id));
END;
$$;

CREATE OR REPLACE FUNCTION expire_waitlist_offers() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_entry RECORD;
BEGIN
  FOR v_entry IN SELECT * FROM public.waitlist_entries WHERE status = 'offered' AND offer_expires_at < now() LOOP
    UPDATE public.waitlist_entries SET status = 'expired' WHERE id = v_entry.id;
    PERFORM offer_next_waitlist(v_entry.class_id, v_entry.bike_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION join_waitlist(p_class_id UUID) RETURNS waitlist_entries
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_entry public.waitlist_entries%ROWTYPE;
BEGIN
  INSERT INTO public.waitlist_entries (class_id, user_id) VALUES (p_class_id, auth.uid())
  RETURNING * INTO v_entry;
  RETURN v_entry;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'already_on_waitlist';
END;
$$;
GRANT EXECUTE ON FUNCTION join_waitlist(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION leave_waitlist(p_waitlist_entry_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  UPDATE public.waitlist_entries SET status = 'cancelled'
  WHERE id = p_waitlist_entry_id AND user_id = auth.uid() AND status IN ('waiting', 'offered');
END;
$$;
GRANT EXECUTE ON FUNCTION leave_waitlist(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION claim_waitlist_offer(p_waitlist_entry_id UUID) RETURNS reservations
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_entry public.waitlist_entries%ROWTYPE;
  v_reservation public.reservations%ROWTYPE;
  v_balance INT;
BEGIN
  PERFORM 1 FROM public.memberships WHERE user_id = auth.uid() AND status = 'active' FOR UPDATE;

  SELECT * INTO v_entry FROM public.waitlist_entries
  WHERE id = p_waitlist_entry_id AND user_id = auth.uid() AND status = 'offered';
  IF v_entry IS NULL OR v_entry.offer_expires_at < now() THEN
    RAISE EXCEPTION 'offer_not_available';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance FROM public.credit_transactions WHERE user_id = auth.uid();
  IF v_balance < 1 THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  BEGIN
    INSERT INTO public.reservations (class_id, user_id, bike_id)
    VALUES (v_entry.class_id, auth.uid(), v_entry.bike_id)
    RETURNING * INTO v_reservation;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'bike_or_class_unavailable';
  END;

  INSERT INTO public.credit_transactions (user_id, amount, type, reference_id)
  VALUES (auth.uid(), -1, 'booking', v_reservation.id);

  UPDATE public.waitlist_entries SET status = 'claimed' WHERE id = p_waitlist_entry_id;

  RETURN v_reservation;
END;
$$;
GRANT EXECUTE ON FUNCTION claim_waitlist_offer(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- booking
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION book_class(p_class_id UUID, p_bike_id UUID) RETURNS reservations
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_class public.classes%ROWTYPE;
  v_balance INT;
  v_reservation public.reservations%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND status = 'active') THEN
    RAISE EXCEPTION 'no_active_membership';
  END IF;
  -- serializes concurrent booking calls from the same user so a double-tap
  -- can't spend the same credit twice
  PERFORM 1 FROM public.memberships WHERE user_id = auth.uid() AND status = 'active' FOR UPDATE;

  SELECT * INTO v_class FROM public.classes WHERE id = p_class_id;
  IF v_class IS NULL OR v_class.status <> 'scheduled' THEN
    RAISE EXCEPTION 'class_not_available';
  END IF;
  IF v_class.starts_at <= now() THEN
    RAISE EXCEPTION 'class_already_started';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance FROM public.credit_transactions WHERE user_id = auth.uid();
  IF v_balance < 1 THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  BEGIN
    INSERT INTO public.reservations (class_id, user_id, bike_id)
    VALUES (p_class_id, auth.uid(), p_bike_id)
    RETURNING * INTO v_reservation;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'bike_or_class_unavailable';
  END;

  INSERT INTO public.credit_transactions (user_id, amount, type, reference_id)
  VALUES (auth.uid(), -1, 'booking', v_reservation.id);

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (auth.uid(), 'booking_confirmed', 'Reserva confirmada',
          format('Tu clase %s esta reservada.', v_class.title),
          jsonb_build_object('reservation_id', v_reservation.id));

  IF v_balance - 1 <= 2 THEN
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (auth.uid(), 'credits_low', 'Pocos creditos', format('Te quedan %s creditos.', v_balance - 1));
  END IF;

  RETURN v_reservation;
END;
$$;
GRANT EXECUTE ON FUNCTION book_class(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION cancel_reservation(p_reservation_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_reservation public.reservations%ROWTYPE;
  v_class public.classes%ROWTYPE;
  v_cutoff INTERVAL := interval '2 hours'; -- tune here if the studio wants a different window
BEGIN
  SELECT * INTO v_reservation FROM public.reservations WHERE id = p_reservation_id AND user_id = auth.uid();
  IF v_reservation IS NULL THEN
    RAISE EXCEPTION 'reservation_not_found';
  END IF;
  IF v_reservation.status <> 'booked' THEN
    RAISE EXCEPTION 'reservation_not_active';
  END IF;

  SELECT * INTO v_class FROM public.classes WHERE id = v_reservation.class_id;
  IF v_class.starts_at - now() < v_cutoff THEN
    RAISE EXCEPTION 'cancellation_window_closed';
  END IF;

  UPDATE public.reservations SET status = 'cancelled', cancelled_at = now() WHERE id = p_reservation_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, reference_id)
  VALUES (auth.uid(), 1, 'cancel_refund', p_reservation_id);

  PERFORM offer_next_waitlist(v_reservation.class_id, v_reservation.bike_id);
END;
$$;
GRANT EXECUTE ON FUNCTION cancel_reservation(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- attendance -- there is no check-in hardware/QR, so the default is
-- optimistic: a booked reservation becomes "attended" automatically once the
-- class ends. Staff only has to act on the exception (mark a no-show), never
-- on the common case.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION award_class_completion(p_reservation_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM public.reservations WHERE id = p_reservation_id;

  INSERT INTO public.xp_transactions (user_id, amount, type, reference_id)
  VALUES (v_user_id, 100, 'class_completed', p_reservation_id);

  PERFORM check_achievements(v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION close_finished_classes() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_class RECORD;
  v_reservation RECORD;
BEGIN
  FOR v_class IN
    SELECT * FROM public.classes
    WHERE status = 'scheduled' AND starts_at + (duration_minutes || ' minutes')::interval < now()
  LOOP
    FOR v_reservation IN SELECT * FROM public.reservations WHERE class_id = v_class.id AND status = 'booked' LOOP
      UPDATE public.reservations SET status = 'attended' WHERE id = v_reservation.id;
      PERFORM award_class_completion(v_reservation.id);
    END LOOP;

    UPDATE public.classes SET status = 'completed' WHERE id = v_class.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION mark_no_show(p_reservation_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  UPDATE public.reservations SET status = 'no_show' WHERE id = p_reservation_id AND status = 'booked';
END;
$$;
GRANT EXECUTE ON FUNCTION mark_no_show(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION admin_adjust_credits(p_user_id UUID, p_amount INT, p_note TEXT DEFAULT NULL) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  INSERT INTO public.credit_transactions (user_id, amount, type, note)
  VALUES (p_user_id, p_amount, 'admin_adjustment', p_note);
END;
$$;
GRANT EXECUTE ON FUNCTION admin_adjust_credits(UUID, INT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- weekly streaks -- evaluated every Monday for the week that just ended.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_weekly_streaks() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_week_start TIMESTAMPTZ := date_trunc('week', now()) - interval '1 week';
  v_week_end TIMESTAMPTZ := date_trunc('week', now());
  v_member RECORD;
  v_completed INT;
  v_met BOOLEAN;
  v_new_streak INT;
BEGIN
  FOR v_member IN SELECT user_id, weekly_goal FROM public.memberships WHERE status = 'active' LOOP
    SELECT COUNT(*) INTO v_completed
    FROM public.reservations r JOIN public.classes c ON c.id = r.class_id
    WHERE r.user_id = v_member.user_id AND r.status = 'attended'
      AND c.starts_at >= v_week_start AND c.starts_at < v_week_end;

    v_met := v_completed >= v_member.weekly_goal;

    UPDATE public.user_stats
    SET current_streak_weeks = CASE WHEN v_met THEN current_streak_weeks + 1 ELSE 0 END,
        updated_at = now()
    WHERE user_id = v_member.user_id
    RETURNING current_streak_weeks INTO v_new_streak;

    UPDATE public.user_stats SET max_streak_weeks = GREATEST(max_streak_weeks, v_new_streak) WHERE user_id = v_member.user_id;

    IF v_met THEN
      INSERT INTO public.xp_transactions (user_id, amount, type) VALUES (v_member.user_id, 100, 'weekly_goal');
      IF v_new_streak > 1 THEN
        INSERT INTO public.xp_transactions (user_id, amount, type) VALUES (v_member.user_id, 50, 'streak_bonus');
      END IF;
      INSERT INTO public.notifications (user_id, type, title, body)
      VALUES (v_member.user_id, 'streak', 'Racha mantenida!', format('%s semanas seguidas cumpliendo tu objetivo.', v_new_streak));
    END IF;

    PERFORM check_achievements(v_member.user_id);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- monthly credit grant -- runs daily, fires for whichever memberships have
-- their cycle anniversary today.
-- ponytail: day-31 anniversaries skip short months instead of rolling to the
-- 1st; fine for a manually-managed 60-80 member gym, revisit if billing gets
-- automated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION grant_monthly_credits() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_membership RECORD;
BEGIN
  FOR v_membership IN
    SELECT * FROM public.memberships WHERE status = 'active' AND EXTRACT(DAY FROM cycle_start) = EXTRACT(DAY FROM now())
  LOOP
    INSERT INTO public.credit_transactions (user_id, amount, type) VALUES (v_membership.user_id, v_membership.credits_per_cycle, 'grant');
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (v_membership.user_id, 'credits', 'Creditos renovados', format('Recibiste %s creditos este mes.', v_membership.credits_per_cycle));
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- class reminders -- 1 hour before start, once per reservation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION queue_class_reminders() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT r.user_id, 'reminder', 'Tu clase empieza pronto', format('%s comienza en 1 hora.', c.title),
         jsonb_build_object('reservation_id', r.id, 'class_id', c.id)
  FROM public.reservations r
  JOIN public.classes c ON c.id = r.class_id
  WHERE r.status = 'booked'
    AND c.starts_at BETWEEN now() + interval '55 minutes' AND now() + interval '65 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n WHERE n.type = 'reminder' AND n.data ->> 'reservation_id' = r.id::text
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled job entrypoint. InsForge schedules hit an HTTP endpoint on a
-- cron cadence rather than running SQL directly (unlike pg_cron), so a
-- single edge function ("cron-dispatch") calls this via db.rpc('run_scheduled_job',
-- {job_name}) and five `schedules create` entries (one per job) point at it
-- with a different body. See functions/cron-dispatch.ts and the CLI commands
-- used to register the schedules.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION run_scheduled_job(p_job_name TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  CASE p_job_name
    WHEN 'close_finished_classes' THEN PERFORM close_finished_classes();
    WHEN 'expire_waitlist_offers' THEN PERFORM expire_waitlist_offers();
    WHEN 'queue_class_reminders' THEN PERFORM queue_class_reminders();
    WHEN 'grant_monthly_credits' THEN PERFORM grant_monthly_credits();
    WHEN 'update_weekly_streaks' THEN PERFORM update_weekly_streaks();
    ELSE RAISE EXCEPTION 'unknown_job: %', p_job_name;
  END CASE;
END;
$$;
-- No GRANT to authenticated: only the admin-key client the cron-dispatch
-- function uses can call this. Ordinary users have no reason to trigger
-- housekeeping jobs on demand, and the function owner (project_admin) can
-- already call it without a grant.
