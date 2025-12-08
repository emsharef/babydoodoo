create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'en',
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can view their own profile"
  on public.users for select
  using ( auth.uid() = id );

create policy "Users can update their own profile"
  on public.users for update
  using ( auth.uid() = id );

create policy "Users can insert their own profile"
  on public.users for insert
  with check ( auth.uid() = id );

-- Function to handle new user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill for existing users (this might fail if run as non-superuser depending on permissions, but worth a try if we have access)
-- Actually, we can't easily select from auth.users usually. 
-- We'll handle missing rows in the application logic (upsert).
