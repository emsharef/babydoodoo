-- Case-insensitive invitee checks
drop policy if exists invites_select_parent_or_invitee on public.invites;
create policy invites_select_parent_or_invitee on public.invites
for select using (
  exists (select 1 from public.memberships pm where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent')
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  or lower(invites.email) = lower((auth.jwt() ->> 'email'))
);

drop policy if exists invites_update_parent_or_invitee on public.invites;
create policy invites_update_parent_or_invitee on public.invites
for update using (
  exists (select 1 from public.memberships pm where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent')
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  or lower(invites.email) = lower((auth.jwt() ->> 'email'))
)
with check (
  (
    exists (select 1 from public.memberships pm where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent')
    or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  )
  or (
    lower(invites.email) = lower((auth.jwt() ->> 'email'))
    and status::text = 'accepted'
    and accepted_by = auth.uid()
  )
);

drop policy if exists memberships_insert_parent_or_invitee on public.memberships;
create policy memberships_insert_parent_or_invitee on public.memberships
for insert with check (
  exists (select 1 from public.memberships pm where pm.baby_id = memberships.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent')
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
  or (
    auth.uid() = user_id
    and exists (
      select 1 from public.invites i
      where i.baby_id = memberships.baby_id
        and lower(i.email) = lower((auth.jwt() ->> 'email'))
        and i.status::text = 'pending'
        and i.role::text = memberships.role::text
    )
  )
);
