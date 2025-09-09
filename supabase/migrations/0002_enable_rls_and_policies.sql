-- Enable RLS and add policies for per-user isolation
create extension if not exists "pgcrypto";

create table if not exists public.babies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_baby_time_idx on public.events(baby_id, occurred_at desc);

alter table public.babies enable row level security;
alter table public.events enable row level security;

-- Revoke noisy wide-open grants if present
do $$
begin
  revoke all on table public.babies from anon;
  revoke all on table public.events from anon;
exception when others then
  null;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.babies to authenticated;
grant select, insert, update, delete on public.events to authenticated;

-- Babies policies (owner-only)
drop policy if exists babies_select_own on public.babies;
drop policy if exists babies_insert_own on public.babies;
drop policy if exists babies_update_own on public.babies;
drop policy if exists babies_delete_own on public.babies;

create policy babies_select_own on public.babies
  for select using (auth.uid() = user_id);

create policy babies_insert_own on public.babies
  for insert with check (auth.uid() = user_id);

create policy babies_update_own on public.babies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy babies_delete_own on public.babies
  for delete using (auth.uid() = user_id);

-- Events policies (must belong to user's baby and match user_id)
drop policy if exists events_select_own on public.events;
drop policy if exists events_insert_own on public.events;
drop policy if exists events_update_own on public.events;
drop policy if exists events_delete_own on public.events;

create policy events_select_own on public.events
  for select using (
    auth.uid() = user_id and exists (
      select 1 from public.babies b where b.id = baby_id and b.user_id = auth.uid()
    )
  );

create policy events_insert_own on public.events
  for insert with check (
    auth.uid() = user_id and exists (
      select 1 from public.babies b where b.id = baby_id and b.user_id = auth.uid()
    )
  );

create policy events_update_own on public.events
  for update using (
    auth.uid() = user_id and exists (
      select 1 from public.babies b where b.id = baby_id and b.user_id = auth.uid()
    )
  ) with check (
    auth.uid() = user_id and exists (
      select 1 from public.babies b where b.id = baby_id and b.user_id = auth.uid()
    )
  );

create policy events_delete_own on public.events
  for delete using (
    auth.uid() = user_id and exists (
      select 1 from public.babies b where b.id = baby_id and b.user_id = auth.uid()
    )
  );
