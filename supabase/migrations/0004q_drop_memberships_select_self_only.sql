do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='memberships' and policyname='memberships_select_self_only') then
    drop policy memberships_select_self_only on public.memberships;
  end if;
end $$;
