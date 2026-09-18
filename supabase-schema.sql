-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste this in → Run)

-- Tracks each user's free-use / premium / paid-credit status.
create table if not exists public.user_plan (
  user_id uuid references auth.users(id) on delete cascade primary key,
  account_free_used boolean not null default false,
  premium boolean not null default false,
  credits integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Stores every analyzed swing so users can see progress over time.
create table if not exists public.swings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  label text,
  speed_mph numeric,
  elbow_angle numeric,
  front_knee numeric,
  torso_lean numeric
);

-- Row-level security: a logged-in user can only ever read/write their own
-- rows, never anyone else's. This is the real enforcement the local-storage
-- demo couldn't provide.
alter table public.user_plan enable row level security;
alter table public.swings enable row level security;

create policy "Users manage their own plan"
  on public.user_plan for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own swings"
  on public.swings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Automatically create a user_plan row the moment someone signs up,
-- so the app never has to worry about a missing row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_plan (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
