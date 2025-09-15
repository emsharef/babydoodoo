-- 0004c_repair_memberships_invites.sql
-- Purpose: Ensure memberships & invites exist with correct RLS policies.
-- Safe to run multiple times. It creates missing tables, enables RLS, and (re)applies policies.

create extension if not exists "pgcrypto";

-- Core tables (safety: create if missing)
create table if not exists public.babies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('parent','caregiver')),
  email text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (baby_id, user_id)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  email text not null,
  role text not null check (role in ('parent','caregiver')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid not null references auth.users(id),
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- Indexes (create if missing)
create index if not exists events_baby_time_idx on public.events(baby_id, occurred_at desc);
create index if not exists memberships_baby_idx on public.memberships(baby_id);
create index if not exists invites_baby_idx on public.invites(baby_id);
create index if not exists invites_email_idx on public.invites(email);

-- Enable RLS
alter table public.babies enable row level security;
alter table public.events enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;

-- Clear old policies if present
drop policy if exists babies_select_member_or_owner on public.babies;
drop policy if exists babies_insert_self on public.babies;
drop policy if exists babies_update_parent_or_owner on public.babies;
drop policy if exists babies_delete_owner on public.babies;

drop policy if exists events_select_member_or_owner on public.events;
drop policy if exists events_insert_member on public.events;
drop policy if exists events_update_parent_or_own on public.events;
drop policy if exists events_delete_parent_or_own on public.events;

drop policy if exists memberships_select_member_or_owner on public.memberships;
drop policy if exists memberships_insert_parent_or_invitee on public.memberships;
drop policy if exists memberships_update_parent_or_owner on public.memberships;
drop policy if exists memberships_delete_parent_or_self on public.memberships;

drop policy if exists invites_select_parent_or_invitee on public.invites;
drop policy if exists invites_insert_parent_or_owner on public.invites;
drop policy if exists invites_update_parent_or_invitee on public.invites;

-- Recreate policies

-- BABIES
create policy babies_select_member_or_owner on public.babies
for select using (
  auth.uid() = user_id
  or exists (
    select 1 from public.memberships m
    where m.baby_id = babies.id and m.user_id = auth.uid()
  )
);

create policy babies_insert_self on public.babies
for insert with check (auth.uid() = user_id);

create policy babies_update_parent_or_owner on public.babies
for update using (
  auth.uid() = user_id
  or exists (
    select 1 from public.memberships m
    where m.baby_id = babies.id and m.user_id = auth.uid() and m.role = 'parent'
  )
) with check (
  auth.uid() = user_id
  or exists (
    select 1 from public.memberships m
    where m.baby_id = babies.id and m.user_id = auth.uid() and m.role = 'parent'
  )
);

create policy babies_delete_owner on public.babies
for delete using (auth.uid() = user_id);

-- EVENTS
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
    where m.baby_id = events.baby_id and m.user_id = auth.uid() and m.role = 'parent'
  )
  or events.user_id = auth.uid()
) with check (
  exists (
    select 1 from public.memberships m
    where m.baby_id = events.baby_id and m.user_id = auth.uid() and m.role = 'parent'
  )
  or events.user_id = auth.uid()
);

create policy events_delete_parent_or_own on public.events
for delete using (
  exists (
    select 1 from public.memberships m
    where m.baby_id = events.baby_id and m.user_id = auth.uid() and m.role = 'parent'
  )
  or events.user_id = auth.uid()
);

-- MEMBERSHIPS
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
  -- Parent or owner adds someone
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = memberships.baby_id and pm.user_id = auth.uid() and pm.role = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
  -- Invitee self-accept path
  or (
    memberships.user_id = auth.uid()
    and exists (
      select 1 from public.invites i
      where i.baby_id = memberships.baby_id
        and i.email = (auth.jwt() ->> 'email')
        and i.status = 'pending'
        and i.role = memberships.role
    )
  )
);

create policy memberships_update_parent_or_owner on public.memberships
for update using (
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = memberships.baby_id and pm.user_id = auth.uid() and pm.role = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
) with check (
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = memberships.baby_id and pm.user_id = auth.uid() and pm.role = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
);

create policy memberships_delete_parent_or_self on public.memberships
for delete using (
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = memberships.baby_id and pm.user_id = auth.uid() and pm.role = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
  or memberships.user_id = auth.uid()
);

-- INVITES
create policy invites_select_parent_or_invitee on public.invites
for select using (
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role in ('parent','caregiver')
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  or (invites.email = (auth.jwt() ->> 'email'))
);

create policy invites_insert_parent_or_owner on public.invites
for insert with check (
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
);

create policy invites_update_parent_or_invitee on public.invites
for update using (
  -- parent/owner path
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  -- invitee path: allow updating their own invite
  or invites.email = (auth.jwt() ->> 'email')
)
with check (
  -- parent/owner can set any valid status
  (
    exists (
      select 1 from public.memberships pm
      where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role = 'parent'
    )
    or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  )
  or (
    -- invitee can only move pending -> accepted for themselves
    invites.email = (auth.jwt() ->> 'email')
    and status = 'accepted'
    and accepted_by = auth.uid()
  )
);
