-- 0004b_fix_invites_policy.sql
-- Fixes: ERROR 42P01: missing FROM-clause entry for table "new"
-- Cause: RLS policies cannot reference NEW/OLD; use column names directly.

-- Safe to run whether 0004 succeeded partially or not.

alter table public.invites enable row level security;

drop policy if exists invites_update_parent_or_invitee on public.invites;

create policy invites_update_parent_or_invitee on public.invites
for update using (
  -- parent/owner can update
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  -- invitee may update their own invite (needed for WITH CHECK path below)
  or invites.email = (auth.jwt() ->> 'email')
)
with check (
  -- parent/owner can set any valid fields
  (
    exists (
      select 1 from public.memberships pm
      where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role = 'parent'
    )
    or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  )
  -- invitee path: allow pending -> accepted for themselves only
  or (
    invites.email = (auth.jwt() ->> 'email')
    and status = 'accepted'
    and accepted_by = auth.uid()
  )
);
