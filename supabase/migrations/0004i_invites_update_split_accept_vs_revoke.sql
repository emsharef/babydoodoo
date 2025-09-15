do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='invites' and policyname='invites_update_parent_or_invitee') then
    drop policy invites_update_parent_or_invitee on public.invites;
  end if;
end $$;

create policy invites_update_revoke_by_parent on public.invites
for update using (
  exists (select 1 from public.memberships pm where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent')
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
)
with check (
  status::text = 'revoked'
);

create policy invites_update_accept_by_invitee on public.invites
for update using (
  lower(invites.email) = lower((auth.jwt() ->> 'email'))
)
with check (
  status::text = 'accepted' and accepted_by = auth.uid()
);
