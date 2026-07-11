-- RunningFit production schema (run in Supabase SQL editor)
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','editor','admin')),
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  name_ko text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shoes (
  id text primary key,
  brand text not null,
  model_en text not null,
  model_ko text,
  search jsonb not null default '{}'::jsonb,
  specs jsonb not null default '{}'::jsonb,
  recommendation jsonb not null default '{}'::jsonb,
  source jsonb not null default '{}'::jsonb,
  primary_use text,
  carbon_plate boolean not null default false,
  plate_type text,
  status text not null default 'active' check (status in ('draft','active','archived','deleted')),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.shoe_images (
  id uuid primary key default gen_random_uuid(),
  shoe_id text not null references public.shoes(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  image_type text not null default 'ai-generated',
  width integer,
  height integer,
  bytes integer,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.races (
  id text primary key,
  name text not null,
  race_date date,
  region text,
  location text,
  distances jsonb not null default '[]'::jsonb,
  official_url text,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.courses (
  id text primary key,
  name text not null,
  region text,
  distance_km numeric,
  level text,
  map_url text,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.shoes enable row level security;
alter table public.shoe_images enable row level security;
alter table public.races enable row level security;
alter table public.courses enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_runningfit_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role in ('editor','admin'));
$$;

create policy "public read published shoes" on public.shoes for select using (published = true and status = 'active');
create policy "admin manage shoes" on public.shoes for all using (public.is_runningfit_admin()) with check (public.is_runningfit_admin());
create policy "public read shoe images" on public.shoe_images for select using (exists(select 1 from public.shoes s where s.id=shoe_id and s.published=true and s.status='active'));
create policy "admin manage shoe images" on public.shoe_images for all using (public.is_runningfit_admin()) with check (public.is_runningfit_admin());
create policy "public read races" on public.races for select using (published=true and status='active');
create policy "admin manage races" on public.races for all using (public.is_runningfit_admin()) with check (public.is_runningfit_admin());
create policy "public read courses" on public.courses for select using (published=true and status='active');
create policy "admin manage courses" on public.courses for all using (public.is_runningfit_admin()) with check (public.is_runningfit_admin());
create policy "public read brands" on public.brands for select using (published=true);
create policy "admin manage brands" on public.brands for all using (public.is_runningfit_admin()) with check (public.is_runningfit_admin());
create policy "admin read logs" on public.audit_logs for select using (public.is_runningfit_admin());
create policy "admin add logs" on public.audit_logs for insert with check (public.is_runningfit_admin());
