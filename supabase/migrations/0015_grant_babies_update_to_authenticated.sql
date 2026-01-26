-- 0015_grant_babies_update_to_authenticated.sql
-- Grant UPDATE permission on babies table to authenticated users.
-- RLS policies (babies_update_parent_or_owner, babies_update_own) control who can update.
-- This was revoked in 0003_revoke_client_writes.sql but is needed for settings page.

GRANT UPDATE ON public.babies TO authenticated;
