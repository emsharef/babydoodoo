-- Create baby as the authenticated user and upsert owner membership as parent.
create or replace function public.create_baby(p_name text)
returns public.babies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_baby public.babies%rowtype;
  v_role_typename text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  insert into public.babies (user_id, name)
  values (auth.uid(), p_name)
  returning * into v_baby;

  -- Determine memberships.role type (enum or text)
  select a.atttypid::regtype::text
    into v_role_typename
    from pg_attribute a
   where a.attrelid = 'public.memberships'::regclass
     and a.attname = 'role'
     and not a.attisdropped;

  if v_role_typename = 'text' then
    execute
      'insert into public.memberships (baby_id, user_id, "role", email, created_by)
       values ($1, $2, $3::text, $4, $5)
       on conflict (baby_id, user_id) do update
         set "role" = excluded."role", email = excluded.email'
    using v_baby.id, auth.uid(), 'parent', (auth.jwt() ->> 'email'), auth.uid();
  else
    execute format(
      'insert into public.memberships (baby_id, user_id, "role", email, created_by)
       values ($1, $2, $3::%s, $4, $5)
       on conflict (baby_id, user_id) do update
         set "role" = excluded."role", email = excluded.email',
      v_role_typename
    ) using v_baby.id, auth.uid(), 'parent', (auth.jwt() ->> 'email'), auth.uid();
  end if;

  return v_baby;
end;
$$;

revoke all on function public.create_baby(text) from public;
grant execute on function public.create_baby(text) to authenticated;
