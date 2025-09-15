-- Transactional accept using SECURITY DEFINER to avoid RLS races.
-- Preconditions: tables exist; caller is authenticated; email must match invite (case-insensitive).
create or replace function public.accept_invite_tx(p_invite_id uuid, p_user_id uuid, p_email text)
returns table (baby_id uuid)
language plpgsql
security definer
as $$
declare
  v_baby uuid;
  v_role text;
begin
  -- Lock the invite row and verify ownership & status
  select i.baby_id, i.role
    into v_baby, v_role
    from public.invites i
   where i.id = p_invite_id
     and lower(i.email) = lower(p_email)
     and i.status = 'pending'
   for update;
  if not found then
    raise exception 'INVITE_NOT_FOUND_OR_NOT_OWNED_OR_NOT_PENDING' using errcode = 'P0001';
  end if;

  -- Upsert membership for the user
  insert into public.memberships (baby_id, user_id, role, email, created_by)
  values (v_baby, p_user_id, v_role, p_email, p_user_id)
  on conflict (baby_id, user_id) do update set role = excluded.role, email = excluded.email
  returning memberships.baby_id into baby_id;

  -- Mark invite accepted
  update public.invites
     set status = 'accepted', accepted_by = p_user_id, accepted_at = now()
   where id = p_invite_id;

  return;
end;
$$;

revoke all on function public.accept_invite_tx(uuid, uuid, text) from public;
grant execute on function public.accept_invite_tx(uuid, uuid, text) to anon, authenticated;
