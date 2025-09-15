-- 0004n_break_recursion_policies.sql
-- Break policy recursion by routing cross-table checks through SECURITY DEFINER helpers.

-- 1) Helper functions (bypass RLS; safe, narrow checks)
create or replace function public.is_baby_owner(p_baby_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.babies b where b.id = p_baby_id and b.user_id = p_user_id);
$$;
revoke all on function public.is_baby_owner(uuid, uuid) from public;
grant execute on function public.is_baby_owner(uuid, uuid) to anon, authenticated;

create or replace function public.has_membership(p_baby_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.memberships m where m.baby_id = p_baby_id and m.user_id = p_user_id);
$$;
revoke all on function public.has_membership(uuid, uuid) from public;
grant execute on function public.has_membership(uuid, uuid) to anon, authenticated;

create or replace function public.is_parent_for_baby(p_baby_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.memberships m where m.baby_id = p_baby_id and m.user_id = p_user_id and m.role::text = 'parent');
$$;
revoke all on function public.is_parent_for_baby(uuid, uuid) from public;
grant execute on function public.is_parent_for_baby(uuid, uuid) to anon, authenticated;

create or replace function public.has_accepted_invite(p_baby_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.invites i where i.baby_id = p_baby_id and i.accepted_by = p_user_id and i.status::text = 'accepted');
$$;
revoke all on function public.has_accepted_invite(uuid, uuid) from public;
grant execute on function public.has_accepted_invite(uuid, uuid) to anon, authenticated;

create or replace function public.is_baby_visible_to_user(p_baby_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_baby_owner(p_baby_id, p_user_id)
      or public.has_membership(p_baby_id, p_user_id)
      or public.has_accepted_invite(p_baby_id, p_user_id);
$$;
revoke all on function public.is_baby_visible_to_user(uuid, uuid) from public;
grant execute on function public.is_baby_visible_to_user(uuid, uuid) to anon, authenticated;

create or replace function public.is_membership_visible_to_user(mem_baby_id uuid, mem_user_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select (mem_user_id = p_user_id)
      or public.is_baby_owner(mem_baby_id, p_user_id)
      or public.is_parent_for_baby(mem_baby_id, p_user_id);
$$;
revoke all on function public.is_membership_visible_to_user(uuid, uuid, uuid) from public;
grant execute on function public.is_membership_visible_to_user(uuid, uuid, uuid) to anon, authenticated;

-- 2) Rebuild policies using helper functions (drop first to avoid duplicates)

-- Babies
drop policy if exists babies_select_member_or_owner on public.babies;
drop policy if exists babies_insert_self on public.babies;
drop policy if exists babies_update_parent_or_owner on public.babies;
drop policy if exists babies_delete_owner on public.babies;

create policy babies_select_member_or_owner on public.babies
for select using ( public.is_baby_visible_to_user(id) );

create policy babies_insert_self on public.babies
for insert with check ( auth.uid() = user_id );

create policy babies_update_parent_or_owner on public.babies
for update using ( public.is_baby_owner(id, auth.uid()) or public.is_parent_for_baby(id, auth.uid()) )
with check ( public.is_baby_owner(id, auth.uid()) or public.is_parent_for_baby(id, auth.uid()) );

create policy babies_delete_owner on public.babies
for delete using ( public.is_baby_owner(id, auth.uid()) );

-- Memberships
drop policy if exists memberships_select_member_or_owner on public.memberships;
drop policy if exists memberships_select_self_or_owner on public.memberships;
drop policy if exists memberships_insert_parent_or_invitee on public.memberships;
drop policy if exists memberships_update_parent_or_owner on public.memberships;
drop policy if exists memberships_delete_parent_or_self on public.memberships;

create policy memberships_select_visible on public.memberships
for select using ( public.is_membership_visible_to_user(baby_id, user_id) );

create policy memberships_insert_parent_or_invitee on public.memberships
for insert with check (
  public.is_parent_for_baby(baby_id, auth.uid())
  or public.is_baby_owner(baby_id, auth.uid())
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

create policy memberships_update_parent_or_owner on public.memberships
for update using ( public.is_baby_owner(baby_id, auth.uid()) or public.is_parent_for_baby(baby_id, auth.uid()) )
with check ( public.is_baby_owner(baby_id, auth.uid()) or public.is_parent_for_baby(baby_id, auth.uid()) );

create policy memberships_delete_parent_or_self on public.memberships
for delete using (
  public.is_baby_owner(baby_id, auth.uid())
  or public.is_parent_for_baby(baby_id, auth.uid())
  or memberships.user_id = auth.uid()
);

-- Invites
drop policy if exists invites_select_parent_or_invitee on public.invites;
drop policy if exists invites_insert_parent_or_owner on public.invites;
drop policy if exists invites_update_parent_or_invitee on public.invites;
drop policy if exists invites_update_revoke_by_parent on public.invites;
drop policy if exists invites_update_accept_by_invitee on public.invites;

create policy invites_select_parent_or_invitee on public.invites
for select using (
  public.is_parent_for_baby(baby_id, auth.uid())
  or public.is_baby_owner(baby_id, auth.uid())
  or lower(email) = lower((auth.jwt() ->> 'email'))
);

create policy invites_insert_parent_or_owner on public.invites
for insert with check (
  public.is_parent_for_baby(baby_id, auth.uid())
  or public.is_baby_owner(baby_id, auth.uid())
);

create policy invites_update_revoke_by_parent on public.invites
for update using (
  public.is_parent_for_baby(baby_id, auth.uid())
  or public.is_baby_owner(baby_id, auth.uid())
)
with check ( status::text = 'revoked' );

create policy invites_update_accept_by_invitee on public.invites
for update using ( lower(email) = lower((auth.jwt() ->> 'email')) )
with check ( status::text = 'accepted' and accepted_by = auth.uid() );
