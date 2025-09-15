-- 0004_memberships_and_sharing.sql
-- Sets up memberships and share_links with RLS so babies can be shared.
-- Roles: 'parent' (admin) and 'caregiver' (log events + delete own).

-- Tables
create table if not exists public.memberships (
  baby_id uuid not null references public.babies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('parent','caregiver')),
  invite_token_hash text null,
  created_at timestamptz not null default now(),
  primary key (baby_id, user_id)
);

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  role text not null check (role in ('parent','caregiver')) default 'caregiver',
  token_hash text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

-- Backfill: make creators 'parent' members for existing babies
insert into public.memberships (baby_id, user_id, role)
select b.id, b.user_id, 'parent'
from public.babies b
on conflict (baby_id, user_id) do nothing;

-- Enable RLS
alter table public.memberships enable row level security;
alter table public.share_links enable row level security;

-- Babies: switch policies to membership-based
drop policy if exists babies_select_own on public.babies;
drop policy if exists babies_insert_own on public.babies;
drop policy if exists babies_update_own on public.babies;
drop policy if exists babies_delete_own on public.babies;

create policy babies_select_member on public.babies
  for select
  using (exists (
    select 1 from public.memberships m
    where m.baby_id = babies.id and m.user_id = auth.uid()
  ));

-- Creating a baby still ties to creator in babies.user_id.
create policy babies_insert_creator on public.babies
  for insert
  with check (user_id = auth.uid());

create policy babies_update_parent on public.babies
  for update
  using (exists (
    select 1 from public.memberships m
    where m.baby_id = babies.id and m.user_id = auth.uid() and m.role = 'parent'
  ))
  with check (exists (
    select 1 from public.memberships m
    where m.baby_id = babies.id and m.user_id = auth.uid() and m.role = 'parent'
  ));

create policy babies_delete_parent on public.babies
  for delete
  using (exists (
    select 1 from public.memberships m
    where m.baby_id = babies.id and m.user_id = auth.uid() and m.role = 'parent'
  ));

-- Events: membership-based access
drop policy if exists events_select_own on public.events;
drop policy if exists events_insert_own on public.events;
drop policy if exists events_update_own on public.events;
drop policy if exists events_delete_own on public.events;

create policy events_select_member on public.events
  for select
  using (exists (
    select 1 from public.memberships m
    where m.baby_id = events.baby_id and m.user_id = auth.uid()
  ));

create policy events_insert_member on public.events
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.baby_id = events.baby_id and m.user_id = auth.uid()
    )
  );

-- Delete rules:
-- - parent can delete any event for that baby
-- - caregiver can delete only events they created
create policy events_delete_parent_or_own on public.events
  for delete
  using (
    exists (
      select 1 from public.memberships m
      where m.baby_id = events.baby_id and m.user_id = auth.uid() and m.role = 'parent'
    )
    or (
      events.user_id = auth.uid()
      and exists (
        select 1 from public.memberships m
        where m.baby_id = events.baby_id and m.user_id = auth.uid()
      )
    )
  );

-- Memberships policies
drop policy if exists memberships_select on public.memberships;
drop policy if exists memberships_insert on public.memberships;
drop policy if exists memberships_delete on public.memberships;

create policy memberships_select_member_or_parent on public.memberships
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.memberships m2
      where m2.baby_id = memberships.baby_id and m2.user_id = auth.uid() and m2.role = 'parent'
    )
  );

-- Insert allowed if:
--  (a) creator adding themselves as parent for a baby they just created; OR
--  (b) user claims a valid share link (invite_token_hash references share_links)
create policy memberships_insert_claim_or_creator on public.memberships
  for insert
  with check (
    user_id = auth.uid()
    and (
      exists (
        select 1 from public.babies b
        where b.id = memberships.baby_id and b.user_id = auth.uid()
      )
      or (
        invite_token_hash is not null
        and exists (
          select 1 from public.share_links sl
          where sl.baby_id = memberships.baby_id
            and sl.token_hash = memberships.invite_token_hash
            and sl.expires_at > now()
            and sl.used_at is null
            and sl.role = memberships.role
        )
      )
    )
  );

-- Delete allowed for parents only (remove any member)
create policy memberships_delete_parent on public.memberships
  for delete
  using (
    exists (
      select 1 from public.memberships m2
      where m2.baby_id = memberships.baby_id and m2.user_id = auth.uid() and m2.role = 'parent'
    )
  );

-- Share links policies
drop policy if exists share_links_select on public.share_links;
drop policy if exists share_links_insert on public.share_links;
drop policy if exists share_links_update on public.share_links;

-- Parents can create share links
create policy share_links_insert_parent on public.share_links
  for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.baby_id = share_links.baby_id and m.user_id = auth.uid() and m.role = 'parent'
    )
  );

-- Parents can view their active links; others cannot list by default.
create policy share_links_select_parent on public.share_links
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.baby_id = share_links.baby_id and m.user_id = auth.uid() and m.role = 'parent'
    )
  );

-- After a user claims membership, allow them to mark link as used
create policy share_links_update_member on public.share_links
  for update
  using (
    exists (
      select 1 from public.memberships m
      where m.baby_id = share_links.baby_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.baby_id = share_links.baby_id and m.user_id = auth.uid()
    )
  );
