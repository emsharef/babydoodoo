alter table public.memberships enable row level security;
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='memberships' and policyname='memberships_select_member_or_owner') then
    drop policy memberships_select_member_or_owner on public.memberships;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='memberships' and policyname='memberships_select') then
    drop policy memberships_select on public.memberships;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='memberships' and policyname='memberships_select_parent') then
    drop policy memberships_select_parent on public.memberships;
  end if;
end $$;

create policy memberships_select_self_or_owner on public.memberships
for select using (
  user_id = auth.uid()
  or auth.uid() = (select b.user_id from public.babies b where b.id = memberships.baby_id)
);
