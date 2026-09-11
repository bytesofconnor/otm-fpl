-- Persist Fantrax scoring returns on each capture so G/A/KP/CS can be charted over time.
-- Fantrax roster stats are year-to-date; week deltas come from consecutive captures.

alter table public.player_week_stats
  add column if not exists goals numeric,
  add column if not exists assists numeric,
  add column if not exists key_passes numeric,
  add column if not exists clean_sheets numeric,
  add column if not exists saves numeric,
  add column if not exists shots_on_target numeric;

comment on column public.player_week_stats.goals is 'Fantrax G at capture time (typically YTD).';
comment on column public.player_week_stats.assists is 'Fantrax AT (official + fantasy assists) at capture time.';
comment on column public.player_week_stats.key_passes is 'Fantrax KP at capture time.';
comment on column public.player_week_stats.clean_sheets is 'Fantrax CS at capture time.';
comment on column public.player_week_stats.saves is 'Fantrax Sv at capture time.';
comment on column public.player_week_stats.shots_on_target is 'Fantrax SOT at capture time.';
