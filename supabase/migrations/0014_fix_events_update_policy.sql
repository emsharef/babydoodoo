-- Fix events update policy to include baby owner (consistent with other policies)
-- This allows baby owners to update events even if they didn't create them
-- and don't have an explicit parent membership

drop policy if exists events_update_parent_or_own on public.events;

create policy events_update_parent_or_own on public.events
for update using (
  public.is_baby_owner(baby_id, auth.uid())
  or public.is_parent_for_baby(baby_id, auth.uid())
  or user_id = auth.uid()
)
with check (
  public.is_baby_owner(baby_id, auth.uid())
  or public.is_parent_for_baby(baby_id, auth.uid())
  or user_id = auth.uid()
);

-- Also fix delete policy for consistency
drop policy if exists events_delete_parent_or_own on public.events;

create policy events_delete_parent_or_own on public.events
for delete using (
  public.is_baby_owner(baby_id, auth.uid())
  or public.is_parent_for_baby(baby_id, auth.uid())
  or user_id = auth.uid()
);
