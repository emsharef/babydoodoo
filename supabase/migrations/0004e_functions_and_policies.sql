-- 0004e_functions_and_policies.sql
-- Define SECURITY DEFINER helper functions to avoid RLS recursion and recreate policies using them.
-- Assumes tables: babies, events, memberships, invites already exist (0004d_1 ensured invites).

create extension if not exists "pgcrypto";

-- Helper functions
create or replace function public.is_member_of(baby uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.baby_id = baby and m.user_id = uid
  );
$$;

create or replace function public.is_parent_of(baby uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.baby_id = baby and m.user_id = uid and m.role::text = 'parent'
  );
$$;

grant execute on function public.is_member_of(uuid, uuid) to anon, authenticated;
grant execute on function public.is_parent_of(uuid, uuid) to anon, authenticated;

-- Drop legacy/duplicate policies if present
do $$
begin
  -- Babies
  perform 1 from pg_policies where schemaname='public' and tablename='babies' and policyname in
    ('babies_select_member','babies_insert_owner','babies_update_parent','babies_delete_parent');
  if found then
    drop policy if exists babies_select_member on public.babies;
    drop policy if exists babies_insert_owner on public.babies;
    drop policy if exists babies_update_parent on public.babies;
    drop policy if exists babies_delete_parent on public.babies;
  end if;

  -- Events
  perform 1 from pg_policies where schemaname='public' and tablename='events' and policyname in
    ('events_select_member','events_update_rules','events_delete_rules');
  if found then
    drop policy if exists events_select_member on public.events;
    drop policy if exists events_update_rules on public.events;
    drop policy if exists events_delete_rules on public.events;
  end if;

  -- Memberships
  perform 1 from pg_policies where schemaname='public' and tablename='memberships' and policyname in
    ('memberships_select','memberships_insert_creator','memberships_insert_parent','memberships_delete_parent');
  if found then
    drop policy if exists memberships_select on public.memberships;
    drop policy if exists memberships_insert_creator on public.memberships;
    drop policy if exists memberships_insert_parent on public.memberships;
    drop policy if exists memberships_delete_parent on public.memberships;
  end if;
end$$;

-- Recreate desired policies so they use helper functions (no direct self-references)

-- Babies
drop policy if exists babies_select_member_or_owner on public.babies;
drop policy if exists babies_insert_self on public.babies;
drop policy if exists babies_update_parent_or_owner on public.babies;
drop policy if exists babies_delete_owner on public.babies;

create policy babies_select_member_or_owner on public.babies
for select using (
  auth.uid() = user_id
  or public.is_member_of(id, auth.uid())
);

create policy babies_insert_self on public.babies
for insert with check (auth.uid() = user_id);

create policy babies_update_parent_or_owner on public.babies
for update using (
  auth.uid() = user_id
  or public.is_parent_of(id, auth.uid())
) with check (
  auth.uid() = user_id
  or public.is_parent_of(id, auth.uid())
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
  public.is_member_of(baby_id, auth.uid())
  or auth.uid() = (select b.user_id from public.babies b where b.id = events.baby_id)
);

create policy events_insert_member on public.events
for insert with check (
  public.is_member_of(baby_id, auth.uid())
);

create policy events_update_parent_or_own on public.events
for update using (
  public.is_parent_of(baby_id, auth.uid())
  or user_id = auth.uid()
) with check (
  public.is_parent_of(baby_id, auth.uid())
  or user_id = auth.uid()
);

create policy events_delete_parent_or_own on public.events
for delete using (
  public.is_parent_of(baby_id, auth.uid())
  or user_id = auth.uid()
);

-- Memberships (avoid recursion by using helper functions and row's user_id)
drop policy if exists memberships_select_member_or_owner on public.memberships;
drop policy if exists memberships_insert_parent_or_invitee on public.memberships;
drop policy if exists memberships_update_parent_or_owner on public.memberships;
drop policy if exists memberships_delete_parent_or_self on public.memberships;

create policy memberships_select_member_or_owner on public.memberships
for select using (
  user_id = auth.uid()
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
  or public.is_parent_of(memberships.baby_id, auth.uid())
);

create policy memberships_insert_parent_or_invitee on public.memberships
for insert with check (
  public.is_parent_of(memberships.baby_id, auth.uid())
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
  or (
    auth.uid() = user_id
    and exists (
      select 1 from public.invites i
      where i.baby_id = memberships.baby_id
        and i.email = (auth.jwt() ->> 'email')
        and i.status::text = 'pending'
        and i.role::text = memberships.role::text
    )
  )
);

create policy memberships_update_parent_or_owner on public.memberships
for update using (
  public.is_parent_of(memberships.baby_id, auth.uid())
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
) with check (
  public.is_parent_of(memberships.baby_id, auth.uid())
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
);

create policy memberships_delete_parent_or_self on public.memberships
for delete using (
  public.is_parent_of(memberships.baby_id, auth.uid())
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
  or user_id = auth.uid()
);

-- Invites
drop policy if exists invites_select_parent_or_invitee on public.invites;
drop policy if exists invites_insert_parent_or_owner on public.invites;
drop policy if exists invites_update_parent_or_invitee on public.invites;

create policy invites_select_parent_or_invitee on public.invites
for select using (
  public.is_parent_of(invites.baby_id, auth.uid())
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  or invites.email = (auth.jwt() ->> 'email')
);

create policy invites_insert_parent_or_owner on public.invites
for insert with check (
  public.is_parent_of(invites.baby_id, auth.uid())
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
);

create policy invites_update_parent_or_invitee on public.invites
for update using (
  public.is_parent_of(invites.baby_id, auth.uid())
  or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  or invites.email = (auth.jwt() ->> 'email')
)
with check (
  (
    public.is_parent_of(invites.baby_id, auth.uid())
    or auth.uid() = (select b.user_id from public.babies b where b.id = invites.baby_id)
  )
  or (
    invites.email = (auth.jwt() ->> 'email')
    and status::text = 'accepted'
    and accepted_by = auth.uid()
  )
);
