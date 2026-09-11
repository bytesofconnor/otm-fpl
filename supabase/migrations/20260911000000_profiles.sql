-- User profiles: linked Fantrax league + squad. Plan is reserved for billing.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  league_id text not null default '8rnibtdamsxcq60v',
  team_id text,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_plan_check check (plan in ('free', 'pro'))
);

create index if not exists profiles_league_id_idx on public.profiles (league_id);

alter table public.profiles enable row level security;

grant select, insert, update on table public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id and plan = 'free');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.profiles_guard_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.id := old.id;
  new.plan := old.plan;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_guard_plan on public.profiles;
create trigger profiles_guard_plan
  before update on public.profiles
  for each row
  execute function public.profiles_guard_plan();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, league_id, plan)
  values (new.id, '8rnibtdamsxcq60v', 'free')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

revoke all on function public.profiles_guard_plan() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

comment on table public.profiles is
  'Signed-in Fantrax membership. league_id defaults to Over the Moon.';
