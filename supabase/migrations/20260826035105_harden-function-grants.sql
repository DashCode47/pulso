-- Fix: Supabase grants EXECUTE on every new `public` function directly to
-- anon/authenticated/PUBLIC as a platform default privilege -- confirmed via
-- has_function_privilege() after db advisors flagged this, the
-- "revoke ... from public" in business-logic.sql did NOT remove access,
-- because the grant wasn't inherited through PUBLIC, it was direct. Revoking
-- from the actual grantees this time.

-- Internal helpers: no client should ever call these directly (unscoped by
-- auth.uid(), or exist purely for triggers/cron). Also covers
-- handle_new_user(), missed in the original pass.
revoke execute on function offer_next_waitlist(uuid, uuid) from anon, authenticated;
revoke execute on function expire_waitlist_offers() from anon, authenticated;
revoke execute on function award_class_completion(uuid) from anon, authenticated;
revoke execute on function close_finished_classes() from anon, authenticated;
revoke execute on function unlock_achievement(uuid, text) from anon, authenticated;
revoke execute on function check_achievements(uuid) from anon, authenticated;
revoke execute on function update_weekly_streaks() from anon, authenticated;
revoke execute on function grant_monthly_credits() from anon, authenticated;
revoke execute on function queue_class_reminders() from anon, authenticated;
revoke execute on function sync_user_stats() from anon, authenticated;
revoke execute on function seed_user_stats() from anon, authenticated;
revoke execute on function handle_new_user() from anon, authenticated;

-- is_admin() must stay executable by authenticated (every RLS policy that
-- calls it depends on that), but anon never needs it -- no policy is
-- evaluated for anon that calls it (all such policies are `to authenticated`).
revoke execute on function is_admin() from anon;

-- Client-facing RPCs require a signed-in user by design (they all key off
-- auth.uid()); anon reaching them is safe-by-construction today (auth.uid()
-- is null, so they fail on a not-null constraint or an explicit check) but
-- revoke anyway so that stays true by policy, not by accident.
revoke execute on function book_class(uuid, uuid) from anon;
revoke execute on function cancel_reservation(uuid) from anon;
revoke execute on function join_waitlist(uuid) from anon;
revoke execute on function leave_waitlist(uuid) from anon;
revoke execute on function claim_waitlist_offer(uuid) from anon;
revoke execute on function mark_no_show(uuid) from anon;
revoke execute on function admin_adjust_credits(uuid, int, text) from anon;

-- xp_to_level is harmless to leave public (pure computation, no table
-- access) but pin its search_path for consistency with every other function.
create or replace function xp_to_level(p_xp int) returns int
language sql immutable
set search_path = pg_catalog, public, pg_temp as $$
  select greatest(1, floor(p_xp / 500.0)::int + 1);
$$;
