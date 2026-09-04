# Over the Moon — roadmap

Companion for Over the Moon FPL. **Scout is the paid intelligence layer**—the spine of the product. League is this-week HQ. Form is heat (Warm/Hot/Fire/Burning), not dead charts. Fantrax remains the source of live data; we are the decision layer, not a data replicator.

## Now

- [x] **Snapshot weekly projections** (✅ Implemented). Fantrax overwrites `PROJECTION_0_926_EVENT_PROJECTED_WEEKLY` with actual FPts once a fixture is done. We freeze pre-game projections in Supabase so "scored vs projected" stays honest.
- [x] **Scout: Form Engine** (PR2, ✅ Merged) — Pure TS lib computing continuous form scores (0-100) + heat buckets (Cold/Warm/Hot/Fire/Burning) from recent FPts, minutes, starts, and surprise bumps when players beat projections. Unit tested.
- [x] **Scout: API** (PR3, ✅ Merged) — Server route `/api/scout/opportunities` returning ranked pickup candidates with rec-card fields (why now, form chip, beats who, confidence, kill conditions). Respects hard filters: availability (FA/WW only), roster holes, signal threshold, SIA drop bans (Garner/Truffert/Havertz), no Arsenal inbound.
- [x] **History Capture** (PR4, ✅ Merged) — Extended `/api/fantrax/capture` to persist actual scored FPts, minutes, started signal, and ownership snapshots (FA/WW/owner) in new `player_week_stats` and `ownership_snapshots` tables. Enables Scout form history over time.
- [ ] **Scout: Opportunity Board UI** (PR5) — New `/scout` page with mobile-friendly, WCAG AA rec cards. SIA-first (cbarrett97), shows top 10-15 opportunities per position. Fantrax projections as tiny footnote only—never ground truth.
- [ ] **Form page heat chips** (PR5) — Wire existing Form page to form engine. Replace proj-only vibes with heat buckets (Warm/Hot/Fire/Burning/Cold) next to player names. Existing charts preserved, just enhanced with color-coded form intelligence.

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

## Next (Season 1.5)

**Scout Intelligence Expansion** — These features extend the core Scout model with context and priority logic:

- [ ] **Fixture Context Layer** — Blend fixture difficulty ratings (1-10) into form scoring. Show "Next 5" fixture runs on player cards. Boost/penalty for easy/tough schedules. Fixes form-only blindspot.
- [ ] **Waiver Claim Helper** — Ranked waiver priority order at `/scout/waivers`. Logic: form score + roster gap urgency + ownership pressure. Flag "likely to clear waivers" players. Helps managers avoid wasting high claims.
- [ ] **Scout: Pricing & Auth** — Stripe integration + Convex auth. Scout is paid-brain tier ($5-10/mo or per-league). Freemium option: Opportunity Board free, Matchup Prep paid (TBD).
- [ ] **League-wide Scout rollout** — Expand beyond SIA (cbarrett97) to all Over the Moon managers. Each team gets personalized Opportunity Board based on their roster holes.
- [ ] **Share cards** that look like a scorebug, not a URL dump (League + Scout recs)
- [ ] Dark matchday theme as an option, not a second product

## Season 2 Features

**Scout Platform Evolution** — These features transform Scout from a decision aid into a league intelligence platform:

- [ ] **Trade Desk** — Trade suggestion engine based on form + roster gaps. Show "win-win" bundles with fair-value checks. Input: "Which teams might trade for Player X?" Output: Suggested partners + trade proposals.
- [ ] **Commissioner Power Map** — League-wide roster strength heatmap at `/scout/league`. Aggregate form scores per team. Show trends ("Team X gained +15 form this week"). Roster depth comparisons. For admins who care about league balance + engagement.
- [ ] **Kill-Condition Alerts** — Real-time push notifications when kill conditions trigger (injury/red card/rotation news). Monitor Fantrax news feed or external injury APIs. Alert: "⚠️ Rec expired: Zinchenko not in predicted XI."
- [ ] **Morning Scout Brief** — Daily email/SMS digest summarizing overnight changes. "Good morning, here's what changed in your league." Hot pickups, lineup alerts, league standings shifts.
- [ ] **Share Cards** (Visual) — Export rec cards as shareable PNG images (Twitter/WhatsApp friendly). "Scout Rec: Garnacho (MUN) · Form: Fire (71) · Powered by Over the Moon." Tracks shares for virality.
- [ ] **Decision Log & Retrospective** — Freeze recommendations when shown, log outcomes post-GW. Retrospective view at `/scout/history` shows hit rate (e.g., "Scout was right 72% of the time"). Model learning: Use logged outcomes to tune form weights. Builds trust through validation.
- [ ] **Scout: Model Refinements** — Incorporate opponent defensive strength, home/away splits, fixture congestion. Backtest on historical GW data. Move from rule-based (Season 1) to hybrid ML (Season 2+).

## Season 3+

- [ ] **Multi-League Support** — Aggregate Scout across all user's leagues. Cross-league opportunity board: "This player is hot in 2 of your leagues." Unified form scoring, different rosters.
- [ ] Push / email when a remaining projection actually moves the matchup
