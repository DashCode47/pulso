-- Same PUBLIC-inheritance gap as the previous migration, missed for this one
-- function: revoking from anon/authenticated directly wasn't enough while
-- PUBLIC still had EXECUTE.
revoke execute on function handle_new_user() from public;
