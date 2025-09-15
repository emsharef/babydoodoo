-- 0004d_roles_cast_policy_fix.sql
-- Purpose: make policies robust whether role columns are TEXT or an ENUM/DOMAIN (e.g., role_kind)
-- Strategy: drop and recreate relevant policies using ::text casts.

create extension if not exists "pgcrypto";

-- Ensure invites exists (idempotent)
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  email text not null,
  role text not null,
  status text not null default 'pending',
  invited_by uuid not null references auth.users(id),
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
alter table public.invites enable row level security;

-- ========== Babies ==========
drop policy if exists babies_select_member_or_owner on public.babies;
drop policy if exists babies_insert_self on public.babies;
drop policy if exists babies_update_parent_or_owner on public.babies;
drop policy if exists babies_delete_owner on public.babies;

create policy babies_select_member_or_owner on public.babies
for select using (
  auth.uid() = user_id
  or exists (
    select 1 from public.memberships m
    where m.baby_id = id and m.user_id = auth.uid()
  )
);

create policy babies_insert_self on public.babies
for insert with check (auth.uid() = user_id);

create policy babies_update_parent_or_owner on public.babies
for update using (
  auth.uid() = user_id
  or exists (
    select 1 from public.memberships m
    where m.baby_id = id and m.user_id = auth.uid() and m.role::text = 'parent'
  )
) with check (
  auth.uid() = user_id
  or exists (
    select 1 from public.memberships m
    where m.baby_id = id and m.user_id = auth.uid() and m.role::text = 'parent'
  )
);

create policy babies_delete_owner on public.babies
for delete using (auth.uid() = user_id);

-- ========== Events ==========
drop policy if exists events_select_member_or_owner on public.events;
drop policy if exists events_insert_member on public.events;
drop policy if exists events_update_parent_or_own on public.events;
drop policy if exists events_delete_parent_or_own on public.events;

create policy events_select_member_or_owner on public.events
for select using (
  exists (
    select 1 from public.memberships m
    where m.baby_id = events.baby_id and m.user_id = auth.uid()
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = events.baby_id)
);

create policy events_insert_member on public.events
for insert with check (
  exists (
    select 1 from public.memberships m
    where m.baby_id = events.baby_id and m.user_id = auth.uid()
  )
);

create policy events_update_parent_or_own on public.events
for update using (
  exists (
    select 1 from public.memberships m
    where m.baby_id = events.baby_id and m.user_id = auth.uid() and m.role::text = 'parent'
  )
  or events.user_id = auth.uid()
) with check (
  exists (
    select 1 from public.memberships m
    where m.baby_id = events.baby_id and m.user_id = auth.uid() and m.role::text = 'parent'
  )
  or events.user_id = auth.uid()
);

create policy events_delete_parent_or_own on public.events
for delete using (
  exists (
    select 1 from public.memberships m
    where m.baby_id = events.baby_id and m.user_id = auth.uid() and m.role::text = 'parent'
  )
  or events.user_id = auth.uid()
);

-- ========== Memberships ==========
drop policy if exists memberships_select_member_or_owner on public.memberships;
drop policy if exists memberships_insert_parent_or_invitee on public.memberships;
drop policy if exists memberships_update_parent_or_owner on public.memberships;
drop policy if exists memberships_delete_parent_or_self on public.memberships;

create policy memberships_select_member_or_owner on public.memberships
for select using (
  exists (
    select 1 from public.memberships me
    where me.baby_id = memberships.baby_id and me.user_id = auth.uid()
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
);

create policy memberships_insert_parent_or_invitee on public.memberships
for insert with check (
  -- Parent/owner can insert any membership
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = memberships.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
  -- Invitee can self-accept: matching pending invite for their email + same role
  or (
    auth.uid() = memberships.user_id
    and exists (
      select 1 from public.invites i
      where i.baby_id = memberships.baby_id
        and i.email = (auth.jwt() ->> 'email')
        and i.status = 'pending'
        and i.role::text = memberships.role::text
    )
  )
);

create policy memberships_update_parent_or_owner on public.memberships
for update using (
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = memberships.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
) with check (
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = memberships.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
);

create policy memberships_delete_parent_or_self on public.memberships
for delete using (
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = memberships.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
  or memberships.user_id = auth.uid()
);

-- ========== Invites ==========
drop policy if exists invites_select_parent_or_invitee on public.invites;
drop policy if exists invites_insert_parent_or_owner on public.invites;
drop policy if exists invites_update_parent_or_invitee on public.invites;

create policy invites_select_parent_or_invitee on public.invites
for select using (
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  or invites.email = (auth.jwt() ->> 'email')
);

create policy invites_insert_parent_or_owner on public.invites
for insert with check (
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
);

create policy invites_update_parent_or_invitee on public.invites
for update using (
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  or invites.email = (auth.jwt() ->> 'email')
)
with check (
  (
    exists (
      select 1 from public.memberships pm
      where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent'
    )
    or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  )
  or (
    invites.email = (auth.jwt() ->> 'email')
    and invites.status = 'accepted'
    and invites.accepted_by = auth.uid()
  )
);
