-- Found by the FK-index and RLS-column-index checks: waitlist_entries had no
-- index on bike_id (FK to bikes) or user_id (filtered by the "read own
-- waitlist entries" RLS policy). Negligible at this app's scale, but free.
create index on waitlist_entries (bike_id);
create index on waitlist_entries (user_id);
