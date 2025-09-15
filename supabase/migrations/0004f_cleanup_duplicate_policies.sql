do $$
declare pol text;
begin
  foreach pol in array array['babies_select_member', 'babies_insert_owner', 'babies_update_parent', 'babies_delete_parent'] loop
    if exists (select 1 from pg_policies where schemaname='public' and tablename='babies' and policyname=pol) then
      execute format('drop policy %I on public.babies', pol);
    end if;
  end loop;
  foreach pol in array array['events_select_member', 'events_update_rules', 'events_delete_rules'] loop
    if exists (select 1 from pg_policies where schemaname='public' and tablename='events' and policyname=pol) then
      execute format('drop policy %I on public.events', pol);
    end if;
  end loop;
  foreach pol in array array['memberships_select', 'memberships_delete_parent', 'memberships_insert_creator', 'memberships_insert_parent'] loop
    if exists (select 1 from pg_policies where schemaname='public' and tablename='memberships' and policyname=pol) then
      execute format('drop policy %I on public.memberships', pol);
    end if;
  end loop;
end $$;
