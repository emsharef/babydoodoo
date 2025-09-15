-- 0004d_role_casts_and_invites_create.sql
-- Purpose: Fix "operator does not exist: text = role_kind" by normalizing comparisons with ::text casts,
-- and ensure `public.invites` exists before policies reference it.

create extension if not exists "pgcrypto";

-- 1) Ensure invites table exists (idempotent)
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'invites'
  ) then
    create table public.invites (
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
    create index invites_baby_idx on public.invites(baby_id);
    create index invites_email_idx on public.invites(email);
    alter table public.invites enable row level security;
  end if;
end $$;

-- 2) Recreate policies with ::text casts wherever 'role' is compared
-- Babies
drop policy if exists babies_select_member_or_owner on public.babies;
drop policy if exists babies_insert_self on public.babies;
drop policy if exists babies_update_parent_or_owner on public.babies;
drop policy if exists babies_delete_owner on public.babies;

create policy babies_select_member_or_owner on public.babies
for select using (
  auth.uid() = user_id
  or exists (select 1 from public.memberships m where m.baby_id = id and m.user_id = auth.uid())
);

create policy babies_insert_self on public.babies
for insert with check (auth.uid() = user_id);

create policy babies_update_parent_or_owner on public.babies
for update using (
  auth.uid() = user_id
  or exists (select 1 from public.memberships m where m.baby_id = id and m.user_id = auth.uid() and m.role::text = 'parent')
) with check (
  auth.uid() = user_id
  or exists (select 1 from public.memberships m where m.baby_id = id and m.user_id = auth.uid() and m.role::text = 'parent')
);

create policy babies_delete_owner on public.babies
for delete using (auth.uid() = user_id);

-- Events
drop policy if exists events_select_member_or_owner on public.events;
drop policy if exists events_insert_member on public.events;
drop policy if exists events_update_parent_or_own on public.events;
drop policy if exists events_delete_parent_or_own on public.events;

create policy events_select_member_or_owner on public.events
for select using (
  exists (select 1 from public.memberships m where m.baby_id = baby_id and m.user_id = auth.uid())
  or auth.uid() = (select b.user_id from public.babies b where b.id = events.baby_id)
);

create policy events_insert_member on public.events
for insert with check (
  exists (select 1 from public.memberships m where m.baby_id = baby_id and m.user_id = auth.uid())
);

create policy events_update_parent_or_own on public.events
for update using (
  exists (select 1 from public.memberships m where m.baby_id = baby_id and m.user_id = auth.uid() and m.role::text = 'parent')
  or user_id = auth.uid()
) with check (
  exists (select 1 from public.memberships m where m.baby_id = baby_id and m.user_id = auth.uid() and m.role::text = 'parent')
  or user_id = auth.uid()
);

create policy events_delete_parent_or_own on public.events
for delete using (
  exists (select 1 from public.memberships m where m.baby_id = baby_id and m.user_id = auth.uid() and m.role::text = 'parent')
  or user_id = auth.uid()
);

-- Memberships
drop policy if exists memberships_select_member_or_owner on public.memberships;
drop policy if exists memberships_insert_parent_or_invitee on public.memberships;
drop policy if exists memberships_update_parent_or_owner on public.memberships;
drop policy if exists memberships_delete_parent_or_self on public.memberships;

create policy memberships_select_member_or_owner on public.memberships
for select using (
  exists (select 1 from public.memberships me where me.baby_id = memberships.baby_id and me.user_id = auth.uid())
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
);

create policy memberships_insert_parent_or_invitee on public.memberships
for insert with check (
  exists (select 1 from public.memberships pm where pm.baby_id = memberships.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent')
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
  or (
    auth.uid() = user_id
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
  exists (select 1 from public.memberships pm where pm.baby_id = memberships.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent')
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
) with check (
  exists (select 1 from public.memberships pm where pm.baby_id = memberships.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent')
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
);

create policy memberships_delete_parent_or_self on public.memberships
for delete using (
  exists (select 1 from public.memberships pm where pm.baby_id = memberships.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent')
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
  or user_id = auth.uid()
);

-- Invites
drop policy if exists invites_select_parent_or_invitee on public.invites;
drop policy if exists invites_insert_parent_or_owner on public.invites;
drop policy if exists invites_update_parent_or_invitee on public.invites;

create policy invites_select_parent_or_invitee on public.invites
for select using (
  exists (select 1 from public.memberships pm where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent')
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  or invites.email = (auth.jwt() ->> 'email')
);

create policy invites_insert_parent_or_owner on public.invites
for insert with check (
  exists (select 1 from public.memberships pm where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent')
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
);

create policy invites_update_parent_or_invitee on public.invites
for update using (
  exists (select 1 from public.memberships pm where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent')
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  or invites.email = (auth.jwt() ->> 'email')
)
with check (
  (
    exists (select 1 from public.memberships pm where pm.baby_id = invites.baby_id and pm.user_id = auth.uid() and pm.role::text = 'parent')
    or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  )
  or (
    invites.email = (auth.jwt() ->> 'email')
    and status = 'accepted'
    and accepted_by = auth.uid()
  )
);
