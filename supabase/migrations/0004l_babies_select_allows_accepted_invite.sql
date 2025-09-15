-- Make babies visible to users who have accepted invites (even if membership row hasn't materialized yet).
drop policy if exists babies_select_member_or_owner on public.babies;
create policy babies_select_member_or_owner on public.babies
for select using (
  auth.uid() = user_id
  or exists (select 1 from public.memberships m where m.baby_id = babies.id and m.user_id = auth.uid())
  or exists (select 1 from public.invites i where i.baby_id = babies.id and i.accepted_by = auth.uid() and i.status::text = 'accepted')
);
