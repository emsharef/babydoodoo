drop policy if exists events_insert_member on public.events;
create policy events_insert_member_or_owner on public.events
for insert with check (
  exists (select 1 from public.memberships m where m.baby_id = events.baby_id and m.user_id = auth.uid())
  or auth.uid() = (select b.user_id from public.babies b where b.id = events.baby_id)
);
