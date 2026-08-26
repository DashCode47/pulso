-- Fix continued: revoking from `anon` directly (previous migration) wasn't
-- enough -- every role implicitly inherits whatever is granted to the
-- pseudo-role PUBLIC, and Supabase's default privileges grant EXECUTE to
-- PUBLIC too. has_function_privilege('anon', 'book_class(uuid,uuid)', ...)
-- still returned true after the last migration for exactly this reason.
-- Revoking from PUBLIC removes the inherited path for anon while leaving
-- authenticated's own direct grant (from business-logic.sql) untouched.
revoke execute on function book_class(uuid, uuid) from public;
revoke execute on function cancel_reservation(uuid) from public;
revoke execute on function join_waitlist(uuid) from public;
revoke execute on function leave_waitlist(uuid) from public;
revoke execute on function claim_waitlist_offer(uuid) from public;
revoke execute on function mark_no_show(uuid) from public;
revoke execute on function admin_adjust_credits(uuid, int, text) from public;
revoke execute on function is_admin() from public;
