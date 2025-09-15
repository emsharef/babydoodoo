-- 0004e_fix_memberships_recursion.sql
-- Goal: remove self-referential RLS on memberships to avoid "infinite recursion" during babies/events policies.

-- MEMBERSHIPS: drop old policies
drop policy if exists memberships_select_member_or_owner on public.memberships;
drop policy if exists memberships_insert_parent_or_invitee on public.memberships;
drop policy if exists memberships_update_parent_or_owner on public.memberships;
drop policy if exists memberships_delete_parent_or_self on public.memberships;

-- MEMBERSHIPS: recreate non-recursive policies
-- SELECT: allow seeing your own membership row or the owner's view of all rows for that baby
create policy memberships_select_self_or_owner on public.memberships
for select using (
  user_id = auth.uid()
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
);

-- INSERT: allow owner to add rows; allow invitee to self-accept (no membership reference)
create policy memberships_insert_owner_or_invitee on public.memberships
for insert with check (
  -- owner adding any member
  auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
  -- OR invitee self-accepts a pending invite for same baby/email/role
  or (
    auth.uid() = user_id
    and exists (
      select 1 from public.invites i
      where i.baby_id = memberships.baby_id
        and i.email = (auth.jwt() ->> 'email')
        and i.status::text = 'pending'
        and i.role::text = memberships.role::text
    )
  )
);

-- UPDATE: owner only (keeps logic simple; avoid recursion)
create policy memberships_update_owner on public.memberships
for update using (
  auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
) with check (
  auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
);

-- DELETE: owner or self (leave)
create policy memberships_delete_owner_or_self on public.memberships
for delete using (
  auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
  or user_id = auth.uid()
);

-- INVITES: simplify to owner + invitee (avoid referencing memberships to prevent complex dependency chains)
drop policy if exists invites_select_parent_or_invitee on public.invites;
drop policy if exists invites_insert_parent_or_owner on public.invites;
drop policy if exists invites_update_parent_or_invitee on public.invites;

create policy invites_select_owner_or_invitee on public.invites
for select using (
  auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  or invites.email = (auth.jwt() ->> 'email')
);

create policy invites_insert_owner on public.invites
for insert with check (
  auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
);

create policy invites_update_owner_or_invitee on public.invites
for update using (
  auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  or invites.email = (auth.jwt() ->> 'email')
) with check (
  -- owner can do any valid update
  auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  -- invitee can accept their own pending invite
  or (
    invites.email = (auth.jwt() ->> 'email')
    and status::text = 'accepted'
    and accepted_by = auth.uid()
  )
);
