-- Add 'viewer' to allowed roles in memberships and invites
-- Also update policies to restrict viewer access

-- 1. Add 'viewer' to role_kind enum
ALTER TYPE role_kind ADD VALUE IF NOT EXISTS 'viewer';

-- No need to update check constraints as the enum handles validation.
-- If there were check constraints, we should drop them if they conflict, but usually enums don't have them unless manually added.
-- Just in case, let's drop any manual check constraints we might have tried to add before or that exist.
alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.invites drop constraint if exists invites_role_check;

-- 3. Update events insert policy to exclude viewers
drop policy if exists events_insert_member on public.events;
create policy events_insert_member on public.events
for insert with check (
  exists (
    select 1 from public.memberships m
    where m.baby_id = baby_id 
    and m.user_id = auth.uid()
    and m.role in ('parent', 'caregiver')
  )
  or exists (
    select 1 from public.babies b
    where b.id = baby_id
    and b.user_id = auth.uid()
  )
);

-- 4. Update events update policy (ensure viewers can't update even if they somehow own it? 
-- Actually, if they own it (user_id = auth.uid()), they should be able to update it. 
-- But viewers shouldn't be able to create events, so they won't own any.
-- The existing policy allows parents or owners. We don't need to change this 
-- as long as viewers can't create events.

-- 5. Update events delete policy
-- Same as update.

-- 6. Update memberships policies?
-- Viewers shouldn't be able to add members.
-- Existing policy `memberships_insert_parent_or_invitee` checks for `role = 'parent'`. 
-- So viewers are already excluded. Good.

-- 7. Update invites policies?
-- Viewers shouldn't be able to invite.
-- Existing policy `invites_insert_parent_or_owner` checks for `role = 'parent'`.
-- So viewers are already excluded. Good.
