-- 0004a_fix_invites_policy.sql
-- Fix invalid usage of NEW.* in RLS policy (RLS policies are not triggers).
-- Safe to run anytime; it drops and recreates the affected policy.

drop policy if exists invites_update_parent_or_invitee on public.invites;

create policy invites_update_parent_or_invitee on public.invites
for update using (
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  or invites.email = (auth.jwt() ->> 'email')
) with check (
  (
    exists (
      select 1 from public.memberships pm
      where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role = 'parent'
    )
    or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  )
  or (
    invites.email = (auth.jwt() ->> 'email')
    and status = 'accepted'
    and accepted_by = auth.uid()
  )
);
