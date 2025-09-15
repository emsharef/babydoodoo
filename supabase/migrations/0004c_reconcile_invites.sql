-- 0004c_reconcile_invites.sql
-- Use this if you see: ERROR 42P01: relation "public.invites" does not exist
-- This will (re)create the invites table and its RLS policies idempotently.

create extension if not exists "pgcrypto";

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

create index if not exists invites_baby_idx on public.invites(baby_id);
create index if not exists invites_email_idx on public.invites(email);

alter table public.invites enable row level security;

-- Recreate invites policies (safe to re-run)
drop policy if exists invites_select_parent_or_invitee on public.invites;
drop policy if exists invites_insert_parent_or_owner on public.invites;
drop policy if exists invites_update_parent_or_invitee on public.invites;

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
  -- parent/owner can update
  exists (
    select 1 from public.memberships pm
    where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role = 'parent'
  )
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  -- invitee may update their own invite
  or invites.email = (auth.jwt() ->> 'email')
)
with check (
  -- parent/owner can set any valid fields
  (
    exists (
      select 1 from public.memberships pm
      where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role = 'parent'
    )
    or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  )
  -- invitee path: allow pending -> accepted for themselves only
  or (
    invites.email = (auth.jwt() ->> 'email')
    and status = 'accepted'
    and accepted_by = auth.uid()
  )
);
