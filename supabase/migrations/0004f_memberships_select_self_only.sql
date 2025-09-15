-- 0004f_memberships_select_self_only.sql
-- Avoid recursion: restrict memberships SELECT to self only.
alter table public.memberships enable row level security;

-- Drop known select policies
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='memberships' and policyname='memberships_select_member_or_owner') then
    drop policy memberships_select_member_or_owner on public.memberships;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='memberships' and policyname='memberships_select_self_or_owner') then
    drop policy memberships_select_self_or_owner on public.memberships;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='memberships' and policyname='memberships_select') then
    drop policy memberships_select on public.memberships;
  end if;
end $$;

create policy memberships_select_self_only on public.memberships
for select using (user_id = auth.uid());
