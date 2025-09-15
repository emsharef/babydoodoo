-- 0004_memberships_invites.sql
-- Adds roles & memberships, invite codes, and updates RLS policies for babies/events.

create type role_kind as enum ('parent', 'caregiver');

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role role_kind not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (baby_id, user_id)
);

create table if not exists public.baby_invites (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  role role_kind not null,
  code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null
);

-- Indexes
create index if not exists memberships_baby_user_idx on public.memberships(baby_id, user_id);
create index if not exists invites_baby_idx on public.baby_invites(baby_id);
create index if not exists invites_code_idx on public.baby_invites(code);

-- Enable RLS
alter table public.memberships enable row level security;
alter table public.baby_invites enable row level security;

-- Babies: update policies to allow members to see baby; only owners/parents manage
drop policy if exists babies_select_own on public.babies;
drop policy if exists babies_insert_own on public.babies;
drop policy if exists babies_update_own on public.babies;
drop policy if exists babies_delete_own on public.babies;

create policy babies_select_member on public.babies
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.memberships m
      where m.baby_id = babies.id and m.user_id = auth.uid()
    )
  );

create policy babies_insert_owner on public.babies
  for insert
  with check (auth.uid() = user_id);

-- Optional (not used in UI yet): only parents may update/delete baby
create policy babies_update_parent on public.babies
  for update
  using (
    exists (
      select 1 from public.memberships m
      where m.baby_id = babies.id and m.user_id = auth.uid() and m.role = 'parent'
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.baby_id = babies.id and m.user_id = auth.uid() and m.role = 'parent'
    )
  );

create policy babies_delete_parent on public.babies
  for delete
  using (
    exists (
      select 1 from public.memberships m
      where m.baby_id = babies.id and m.user_id = auth.uid() and m.role = 'parent'
    )
  );

-- Events: membership-based access
drop policy if exists events_select_own on public.events;
drop policy if exists events_insert_own on public.events;
drop policy if exists events_update_own on public.events;
drop policy if exists events_delete_own on public.events;

-- Read if member of the baby
create policy events_select_member on public.events
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.baby_id = events.baby_id and m.user_id = auth.uid()
    )
  );

-- Insert if member (parent or caregiver)
create policy events_insert_member on public.events
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.memberships m
      where m.baby_id = events.baby_id and m.user_id = auth.uid()
    )
  );

-- Update: parent or the creator of the event
create policy events_update_rules on public.events
  for update
  using (
    exists (
      select 1 from public.memberships m
      where m.baby_id = events.baby_id and m.user_id = auth.uid() and m.role in ('parent')
    )
    or user_id = auth.uid()
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.baby_id = events.baby_id and m.user_id = auth.uid() and m.role in ('parent')
    )
    or user_id = auth.uid()
  );

-- Delete: parent, or caregiver may delete only their own events
create policy events_delete_rules on public.events
  for delete
  using (
    exists (
      select 1 from public.memberships m
      where m.baby_id = events.baby_id and m.user_id = auth.uid() and m.role = 'parent'
    )
    or (user_id = auth.uid() and exists (
      select 1 from public.memberships m
      where m.baby_id = events.baby_id and m.user_id = auth.uid() and m.role = 'caregiver'
    ))
  );

-- Memberships table policies
drop policy if exists memberships_select on public.memberships;
drop policy if exists memberships_insert_parent on public.memberships;
drop policy if exists memberships_insert_creator on public.memberships;
drop policy if exists memberships_delete_parent on public.memberships;

-- Any member can see the membership list for their baby
create policy memberships_select on public.memberships
  for select
  using (
    exists (
      select 1 from public.memberships me
      where me.baby_id = memberships.baby_id and me.user_id = auth.uid()
    )
  );

-- Creator may create their own parent membership for a baby they own
create policy memberships_insert_creator on public.memberships
  for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.babies b where b.id = memberships.baby_id and b.user_id = auth.uid())
  );

-- Parent may add any membership on their baby
create policy memberships_insert_parent on public.memberships
  for insert
  with check (
    exists (
      select 1 from public.memberships me
      where me.baby_id = memberships.baby_id and me.user_id = auth.uid() and me.role = 'parent'
    )
  );

-- Only parent may delete memberships on their baby
create policy memberships_delete_parent on public.memberships
  for delete
  using (
    exists (
      select 1 from public.memberships me
      where me.baby_id = memberships.baby_id and me.user_id = auth.uid() and me.role = 'parent'
    )
  );

-- Invites table policies (MVP):
drop policy if exists invites_select_all on public.baby_invites;
drop policy if exists invites_insert_parent on public.baby_invites;
drop policy if exists invites_update_redeem on public.baby_invites;

-- Allow selecting invites (by code) for redemption.
-- (Codes are random; we will move to tighter policies later.)
create policy invites_select_all on public.baby_invites
  for select
  using (true);

-- Only parents can create invites for their baby
create policy invites_insert_parent on public.baby_invites
  for insert
  with check (
    exists (
      select 1 from public.memberships me
      where me.baby_id = baby_invites.baby_id and me.user_id = auth.uid() and me.role = 'parent'
    )
  );

-- Redeem policy: allow update from unclaimed -> claimed-by-current-user
create policy invites_update_redeem on public.baby_invites
  for update
  using (redeemed_at is null)
  with check (redeemed_by = auth.uid() and redeemed_at is not null);
