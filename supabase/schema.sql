-- Minimal schema for BabyDooDoo smoke test (initial, RLS disabled for first run)
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

-- Dev-only: disable RLS initially. We'll enable via migration 0002.
alter table public.babies disable row level security;
alter table public.events disable row level security;

-- Basic grants for local testing
grant usage on schema public to anon, authenticated;
grant all on public.babies to anon, authenticated;
grant all on public.events to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
