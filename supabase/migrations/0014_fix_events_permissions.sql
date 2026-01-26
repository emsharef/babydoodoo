-- Fix events table permissions and policies
-- The authenticated role was missing INSERT, UPDATE, DELETE grants

-- 1. Grant necessary permissions to authenticated role
GRANT INSERT, UPDATE, DELETE ON public.events TO authenticated;

-- 2. Clean up duplicate/conflicting policies and recreate correct ones
DROP POLICY IF EXISTS events_select_own ON public.events;
DROP POLICY IF EXISTS events_insert_own ON public.events;
DROP POLICY IF EXISTS events_update_own ON public.events;
DROP POLICY IF EXISTS events_delete_own ON public.events;
DROP POLICY IF EXISTS events_select_member_or_owner ON public.events;
DROP POLICY IF EXISTS events_insert_member_or_owner ON public.events;
DROP POLICY IF EXISTS events_insert_member ON public.events;
DROP POLICY IF EXISTS events_update_parent_or_own ON public.events;
DROP POLICY IF EXISTS events_delete_parent_or_own ON public.events;

-- SELECT: members or baby owner can view
CREATE POLICY events_select_member_or_owner ON public.events
FOR SELECT USING (
  public.has_membership(baby_id, auth.uid())
  OR public.is_baby_owner(baby_id, auth.uid())
);

-- INSERT: parents, caregivers, or baby owner can create (not viewers)
CREATE POLICY events_insert_member ON public.events
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.baby_id = events.baby_id
    AND m.user_id = auth.uid()
    AND m.role::text IN ('parent', 'caregiver')
  )
  OR public.is_baby_owner(baby_id, auth.uid())
);

-- UPDATE: baby owner, parent, or event creator can update
CREATE POLICY events_update_parent_or_own ON public.events
FOR UPDATE USING (
  public.is_baby_owner(baby_id, auth.uid())
  OR public.is_parent_for_baby(baby_id, auth.uid())
  OR user_id = auth.uid()
)
WITH CHECK (
  public.is_baby_owner(baby_id, auth.uid())
  OR public.is_parent_for_baby(baby_id, auth.uid())
  OR user_id = auth.uid()
);

-- DELETE: baby owner, parent, or event creator can delete
CREATE POLICY events_delete_parent_or_own ON public.events
FOR DELETE USING (
  public.is_baby_owner(baby_id, auth.uid())
  OR public.is_parent_for_baby(baby_id, auth.uid())
  OR user_id = auth.uid()
);
