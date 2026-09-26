-- Pulso: fix send_pending_notifications() being publicly callable
-- push_notifications.sql only revoked execute from `public`, but this
-- project's anon/authenticated roles get EXECUTE independent of the PUBLIC
-- pseudo-role (see harden-function-grants.sql) -- so the cron-only dispatcher
-- was callable by anyone with the publishable API key. Closes that.

revoke execute on function send_pending_notifications() from public, anon, authenticated;
