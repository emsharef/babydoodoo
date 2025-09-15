-- 0004_fix_invites_policy.sql: apply if you previously hit NEW.* error

drop policy if exists invites_update_parent_or_invitee on public.invites;
drop policy if exists invites_update_parent_or_owner on public.invites;
drop policy if exists invites_update_self_accept on public.invites;

create policy invites_update_parent_or_owner on public.invites
for update using (
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
) with check (
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
);

create policy invites_update_self_accept on public.invites
for update using (
  invites.email = (auth.jwt() ->> 'email')
  and invites.status = 'pending'
) with check (
  invites.email = (auth.jwt() ->> 'email')
  and status = 'accepted'
  and accepted_by = auth.uid()
);
