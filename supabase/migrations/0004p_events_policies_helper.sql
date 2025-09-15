-- Rewrite events policies to use helper helpers (no cross-table recursion; correct baby check)
drop policy if exists events_select_member_or_owner on public.events;
drop policy if exists events_insert_member_or_owner on public.events;
drop policy if exists events_update_parent_or_own on public.events;
drop policy if exists events_delete_parent_or_own on public.events;

create policy events_select_member_or_owner on public.events
for select using (
  public.has_membership(baby_id, auth.uid())
  or public.is_baby_owner(baby_id, auth.uid())
);

create policy events_insert_member_or_owner on public.events
for insert with check (
  public.has_membership(baby_id, auth.uid())
  or public.is_baby_owner(baby_id, auth.uid())
);

create policy events_update_parent_or_own on public.events
for update using (
  public.is_parent_for_baby(baby_id, auth.uid())
  or user_id = auth.uid()
)
with check (
  public.is_parent_for_baby(baby_id, auth.uid())
  or user_id = auth.uid()
);

create policy events_delete_parent_or_own on public.events
for delete using (
  public.is_parent_for_baby(baby_id, auth.uid())
  or user_id = auth.uid()
);
