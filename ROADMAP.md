# Over the Moon — roadmap

Companion for Over the Moon FPL. League is this-week HQ. Form is scored vs leftover. Fantrax remains the source of live data; we should not become a second Fantrax.

## Now

- [ ] **Snapshot weekly projections** (see below). Fantrax overwrites `PROJECTION_0_926_EVENT_PROJECTED_WEEKLY` with actual FPts once a fixture is done. The Form dumbbell and “left” column go flat. We need our own copy of the pre-game / in-week expected total.
- [ ] Keep League about **what’s still to play**, not a clone of the Fantrax scoreboard.
- [ ] Chart tooltips must stay fully visible (no clip at the plot edge).

## Snapshot projections in a database

Fantrax’s weekly proj view is not a frozen forecast. After kickoff it converges to scored. To keep “scored vs projected” honest we should persist the projection ourselves.

**What to store**

- League id, period (GW), player id, team id (owner), captured-at
- `projected` — Fantrax weekly expected total at capture time
- Optional: manager-level projected totals from the `proj: true` schedule view
- Do not overwrite a row once the player’s fixture has started, unless we are filling a missing first snapshot

**When to capture**

- Cron or on-demand before the GW deadline, then once more early in the GW
- First successful non-zero weekly proj for that `(leagueId, period, playerId)` wins
- Live scored always comes from Fantrax; only the projection is frozen

**How we would use it**

- Form rings / “proj” = snapshot (or live Fantrax proj if no snapshot yet)
- Form fill / “scored” = live Fantrax
- “Left” = `max(0, snapshot − scored)`
- League player `+N` leftover uses the same snapshot when present

**Likely shape**

- Postgres (Vercel or similar) with a unique key on `(league_id, period, player_id)`
- Write path: server job calling the existing `fxpa` player-stats / roster proj endpoints
- Read path: merge snapshot onto `loadFantraxForm` / `loadRosterBundle` so the UI does not care where proj came from

Until this ships, leftover is inferred from live vs current Fantrax proj, which is why finished players show scored = proj.

## Next

- [ ] Wire pickups that stay useful after GW1 (true remaining, not collapsed proj)
- [ ] Share cards that look like a scorebug, not a URL dump
- [ ] Dark matchday theme as an option, not a second product

## Later

- [ ] Multi-league without making Switch the homepage
- [ ] Push / email when a remaining projection actually moves the matchup
