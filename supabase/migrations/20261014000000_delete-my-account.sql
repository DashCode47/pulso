-- Pulso: self-service account deletion (App Store 5.1.1(v), Play account deletion policy)
-- A member deletes their own account from the app. Future bookings are
-- released first (release_member_bookings) so the freed bikes go to the
-- waitlist; then the auth user is deleted and every table that references
-- auth.users cascades. The avatar files are removed by the client before
-- calling this (storage rows can't be deleted from SQL).

create or replace function delete_my_account() returns void
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  -- ponytail: staff accounts are removed by another admin, so the studio never
  -- loses its last admin from a phone tap.
  if is_admin() then
    raise exception 'admin_cannot_self_delete';
  end if;

  perform release_member_bookings(v_user_id);
  delete from auth.users where id = v_user_id;
end;
$$;
revoke execute on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
