create extension if not exists "pgcrypto";
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  email text not null,
  role text not null,
  status text not null default 'pending',
  invited_by uuid not null references auth.users(id),
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index if not exists invites_baby_idx on public.invites(baby_id);
create index if not exists invites_email_idx on public.invites(email);
alter table public.invites enable row level security;
