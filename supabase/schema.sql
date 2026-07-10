-- RunningFit Supabase 초기 스키마 초안
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  height numeric,
  weight numeric,
  gender text,
  experience text,
  width text,
  strike text,
  weekly_goal numeric,
  monthly_goal numeric,
  updated_at timestamptz default now()
);
create table if not exists public.user_shoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand text,
  name text,
  distance numeric default 0,
  created_at timestamptz default now()
);
create table if not exists public.run_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_date date,
  distance numeric,
  pace text,
  duration text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
alter table public.user_shoes enable row level security;
alter table public.run_logs enable row level security;
create policy "own profile" on public.profiles for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own shoes" on public.user_shoes for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own logs" on public.run_logs for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
