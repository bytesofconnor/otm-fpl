# Over the Moon — roadmap

Companion for Over the Moon FPL. League is this-week HQ. Form is scored vs leftover. Fantrax remains the source of live data; we should not become a second Fantrax.

## Now

- [x] **Snapshot weekly projections** (see below). Fantrax overwrites `PROJECTION_0_926_EVENT_PROJECTED_WEEKLY` with actual FPts once a fixture is done. The Form dumbbell and "left" column go flat. We need our own copy of the pre-game / in-week expected total.
- [ ] Keep League about **what's still to play**, not a clone of the Fantrax scoreboard.
- [ ] Chart tooltips must stay fully visible (no clip at the plot edge).

## Snapshot projections in a database

✅ **Implemented** — Supabase integration added to freeze Fantrax weekly projections before fixtures start.

Fantrax's weekly proj view is not a frozen forecast. After kickoff it converges to scored. To keep "scored vs projected" honest we persist the projection ourselves.

**What we store**

- League id, period (GW), player id, team id (owner), captured-at
- `projected` — Fantrax weekly expected total at capture time
- Optional: manager-level projected totals from the `proj: true` schedule view
- First successful non-zero weekly proj for that `(leagueId, period, playerId)` wins (unique constraint)

**When to capture**

- Manual or cron before the GW deadline, then once more early in the GW
- First successful non-zero weekly proj for that `(leagueId, period, playerId)` wins
- Live scored always comes from Fantrax; only the projection is frozen

**How we use it**

- Form rings / "proj" = snapshot (or live Fantrax proj if no snapshot yet)
- Form fill / "scored" = live Fantrax
- "Left" = `max(0, snapshot − scored)`
- League player `+N` leftover uses the same snapshot when present

**Implementation**

- ✅ Postgres on Supabase with unique key on `(league_id, period, player_id)`
- ✅ SQL migration in `supabase/migrations/` with RLS enabled
- ✅ Writes from Next.js server only (service role key, never exposed to client)
- ✅ Capture path: `POST /api/fantrax/capture` fetches Fantrax rosters and upserts snapshots
- ✅ Read path: `loadFantraxForm` merges snapshots into player/manager series
- ✅ Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- ✅ Graceful fallback: app works without Supabase (uses live Fantrax projections)
- ✅ Documentation in README with setup instructions

## Next

- [ ] Wire pickups that stay useful after GW1 (true remaining, not collapsed proj)
- [ ] Share cards that look like a scorebug, not a URL dump
- [ ] Dark matchday theme as an option, not a second product

## Later

- [ ] Multi-league without making Switch the homepage
- [ ] Push / email when a remaining projection actually moves the matchup
