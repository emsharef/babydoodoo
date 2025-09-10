-- 0003_revoke_client_writes.sql
-- DO NOT RUN YET.
-- This migration revokes INSERT/UPDATE/DELETE for role `authenticated` so that
-- writes can *only* be performed by server-side code using a service role key
-- or via SECURITY DEFINER RPCs.
--
-- Our current app writes using the user's JWT (RLS-enforced). If you run this now,
-- your server routes will also lose write privileges.
--
-- We'll explicitly tell you when to run this after we switch server writes to a service role.

revoke insert, update, delete on table public.babies from authenticated;
revoke insert, update, delete on table public.events from authenticated;
revoke insert, update, delete on table public.babies from anon;
revoke insert, update, delete on table public.events from anon;
