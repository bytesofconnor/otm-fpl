-- Create projection_snapshots table for freezing Fantrax weekly projections
-- This allows us to show proj vs actual even after Fantrax overwrites projections with actuals

create table if not exists public.projection_snapshots (
  id bigserial primary key,
  league_id text not null,
  period integer not null,
  player_id text not null,
  team_id text not null,
  projected numeric not null,
  manager_projected numeric,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  
  -- First snapshot wins: unique constraint on (league_id, period, player_id)
  constraint projection_snapshots_unique unique (league_id, period, player_id)
);

-- Index for fast lookups by league and period
create index if not exists projection_snapshots_league_period_idx 
  on public.projection_snapshots (league_id, period);

-- Index for player lookups
create index if not exists projection_snapshots_player_idx 
  on public.projection_snapshots (player_id);

-- Enable Row Level Security
alter table public.projection_snapshots enable row level security;

-- Policy: Public/anon can read all snapshots (consumed by Next.js server via service role, but safe to allow anon read)
create policy "Allow read access to all users"
  on public.projection_snapshots
  for select
  using (true);

-- Policy: Only service role can insert/update snapshots
-- This is enforced by using service role key in the server capture endpoint
-- Anon key cannot write
create policy "Only service role can insert"
  on public.projection_snapshots
  for insert
  with check (false); -- Deny all inserts via anon key

create policy "Only service role can update"
  on public.projection_snapshots
  for update
  using (false); -- Deny all updates via anon key

-- Comment on table
comment on table public.projection_snapshots is 
  'Frozen Fantrax weekly projections captured before fixtures start. First snapshot for (league_id, period, player_id) wins.';
