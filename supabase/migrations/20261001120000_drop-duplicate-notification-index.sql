-- Pulso: notifications_pending_idx (created_at where sent_at is null, from
-- *performance.sql) covers send_pending_notifications()'s filter AND its
-- order by; the older notifications_sent_at_idx (sent_at where sent_at is
-- null) only covered the filter. Keep one.
drop index if exists notifications_sent_at_idx;
