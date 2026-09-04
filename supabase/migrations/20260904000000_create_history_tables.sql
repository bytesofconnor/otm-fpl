-- History Capture: Store actual scored FPts, minutes, started signal, and availability snapshots
-- Complements projection_snapshots (which remains first-wins for weekly projections)

-- ============================================================================
-- Table: player_week_stats
-- ============================================================================
-- Stores actual scored FPts and playing time stats after gameweeks progress/lock
-- Multiple captures per (league_id, period, player_id) allowed as week progresses
-- Latest capture_id wins for queries

create table if not exists public.player_week_stats (
  id bigserial primary key,
  capture_id text not null,        -- Unique per capture run (timestamp-based)
  league_id text not null,
  period integer not null,
  player_id text not null,
  player_name text,                -- Denormalized for Scout card display
  position text,                   -- Denormalized (e.g. "DEF", "MID")
  club text,                       -- Denormalized (e.g. "ARS", "CHE")
  
  -- Scored stats (from Fantrax after fixtures)
  scored_fpts numeric,             -- Actual FPts scored this gameweek (null if not yet played)
  
  -- Playing time signals
  minutes_played integer,          -- Minutes played (0-120, null if not available)
  started boolean,                 -- Did player start? (ACTIVE status in Fantrax)
  
  -- Metadata
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Indexes for efficient queries
create index if not exists player_week_stats_league_period_idx 
  on public.player_week_stats (league_id, period);

create index if not exists player_week_stats_player_idx 
  on public.player_week_stats (player_id);

create index if not exists player_week_stats_capture_idx 
  on public.player_week_stats (capture_id);

-- Composite index for "latest capture per player per period" queries
create index if not exists player_week_stats_player_period_captured_idx 
  on public.player_week_stats (league_id, player_id, period, captured_at desc);

-- Row Level Security
alter table public.player_week_stats enable row level security;

create policy "Allow read access to all users"
  on public.player_week_stats
  for select
  using (true);

create policy "Only service role can insert"
  on public.player_week_stats
  for insert
  with check (false);

create policy "Only service role can update"
  on public.player_week_stats
  for update
  using (false);

-- Comment
comment on table public.player_week_stats is 
  'Actual scored FPts, minutes, and started signal per player per gameweek. Multiple captures allowed as week progresses; latest capture_id wins.';

-- ============================================================================
-- Table: ownership_snapshots
-- ============================================================================
-- Stores player availability and ownership at capture time
-- Tracks FA/WW/owned status for Scout pickup intelligence

create table if not exists public.ownership_snapshots (
  id bigserial primary key,
  capture_id text not null,        -- Same as player_week_stats for correlation
  league_id text not null,
  period integer not null,
  player_id text not null,
  player_name text,                -- Denormalized
  position text,                   -- Denormalized
  club text,                       -- Denormalized
  
  -- Availability status
  availability text not null,      -- "FA", "WW", "OWNED"
  waiver_day integer,              -- If WW, which day? (null for FA/OWNED)
  owner_team_id text,              -- If OWNED, which team? (null for FA/WW)
  owner_short_code text,           -- Short code/name for owner (optional)
  
  -- Metadata
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists ownership_snapshots_league_period_idx 
  on public.ownership_snapshots (league_id, period);

create index if not exists ownership_snapshots_player_idx 
  on public.ownership_snapshots (player_id);

create index if not exists ownership_snapshots_capture_idx 
  on public.ownership_snapshots (capture_id);

-- Composite index for "latest ownership per player per period" queries
create index if not exists ownership_snapshots_player_period_captured_idx 
  on public.ownership_snapshots (league_id, player_id, period, captured_at desc);

-- Row Level Security
alter table public.ownership_snapshots enable row level security;

create policy "Allow read access to all users"
  on public.ownership_snapshots
  for select
  using (true);

create policy "Only service role can insert"
  on public.ownership_snapshots
  for insert
  with check (false);

create policy "Only service role can update"
  on public.ownership_snapshots
  for update
  using (false);

-- Comment
comment on table public.ownership_snapshots is 
  'Player availability (FA/WW/owned) and ownership tracking per gameweek. Captures daily/on-demand to track wire movement.';

-- ============================================================================
-- Views (Optional Helper Queries)
-- ============================================================================

-- Latest stats per player per period
create or replace view public.latest_player_week_stats as
select distinct on (league_id, period, player_id)
  *
from public.player_week_stats
order by league_id, period, player_id, captured_at desc;

comment on view public.latest_player_week_stats is 
  'Latest captured stats per player per gameweek (most recent capture_id).';

-- Latest ownership per player per period
create or replace view public.latest_ownership_snapshots as
select distinct on (league_id, period, player_id)
  *
from public.ownership_snapshots
order by league_id, period, player_id, captured_at desc;

comment on view public.latest_ownership_snapshots is 
  'Latest ownership status per player per gameweek (most recent capture_id).';
