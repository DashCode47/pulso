-- Pulso: admin_publish_next_week() failed with "UPDATE requires a WHERE
-- clause" -- Supabase runs pg_safeupdate on API requests, which rejects
-- unfiltered updates even on the single-row studio_settings. Same function,
-- now filtered on its (always true) id.

create or replace function admin_publish_next_week() returns date
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_until date;
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;
  update public.studio_settings set schedule_published_until = greatest(
    schedule_published_until,
    date_trunc('week', (now() at time zone 'America/Bogota')::date + 4)::date + 6
  ) where id returning schedule_published_until into v_until;
  return v_until;
end;
$$;
