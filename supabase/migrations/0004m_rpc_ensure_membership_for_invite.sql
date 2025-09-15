create or replace function public.ensure_membership_for_invite(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_baby uuid;
  v_role public.invites."role"%TYPE;
  v_email text;
  v_uid uuid;
  v_role_typename text;
begin
  select baby_id, "role", email, accepted_by
    into v_baby, v_role, v_email, v_uid
    from public.invites
   where id = p_invite_id
     and status = 'accepted'
     and accepted_by is not null;
  if not found then
    raise exception 'INVITE_NOT_ACCEPTED_OR_NOT_FOUND' using errcode = 'P0001';
  end if;

  select a.atttypid::regtype::text into v_role_typename
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
    using v_baby, v_uid, v_role, v_email, v_uid;
  else
    execute format(
      'insert into public.memberships (baby_id, user_id, "role", email, created_by)
       values ($1, $2, $3::%s, $4, $5)
       on conflict (baby_id, user_id) do update
         set "role" = excluded."role", email = excluded.email',
      v_role_typename
    ) using v_baby, v_uid, v_role, v_email, v_uid;
  end if;

  return v_baby;
end;
$$;

revoke all on function public.ensure_membership_for_invite(uuid) from public;
grant execute on function public.ensure_membership_for_invite(uuid) to anon, authenticated;
