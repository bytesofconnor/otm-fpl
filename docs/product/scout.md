# Scout System — Product Specification

**Version:** 1.0  
**Last Updated:** 2026-09-04  
**Status:** In Development

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Product Vision](#product-vision)
4. [Users & Personas](#users--personas)
5. [Core Features](#core-features)
6. [Data Sources & Architecture](#data-sources--architecture)
7. [Form Model Specification](#form-model-specification)
8. [Opportunity Board](#opportunity-board)
9. [Matchup Prep](#matchup-prep)
10. [Recommendation Card Schema](#recommendation-card-schema)
11. [Hard Filters & Business Rules](#hard-filters--business-rules)
12. [Confidence & Kill Conditions](#confidence--kill-conditions)
13. [Learning Loop & Decision Log](#learning-loop--decision-log)
14. [Non-Goals](#non-goals)
15. [Open Questions](#open-questions)
16. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

Scout is the **paid intelligence layer** for Over the Moon FPL managers. It unifies two critical decisions—**pickups** (Opportunity Board) and **start/sit** (Matchup Prep)—using a single, proprietary form-scoring model.

**Key differentiators:**
- **SIA-first design**: Prioritizes Saints Intelligence Agency (cbarrett97) needs, the marquee power user
- **Form as Heat Index**: Warm → Hot → Fire → Burning (not dead projection charts)
- **Fantrax projections as noisy prior**: A footnote, never ground truth
- **Decision quality proof layer**: Future retrospective logging validates recommendations

Scout turns Over the Moon from a league companion into a competitive advantage tool.

---

## Problem Statement

### Current State
Over the Moon managers face two recurring weekly challenges:

1. **Pickup paralysis**: Who should I pick up from the wire? Current tools:
   - Form page shows "unowned" list but lacks context on *why now* or *who to drop*
   - Fantrax projections are static, noisy, and become stale post-kickoff
   - No intelligence on whether a player fits roster holes or beats bench depth

2. **Start/sit anxiety**: Should I start Player A or Player B? Current solutions:
   - Manual comparison across scattered data (minutes, fixtures, form)
   - Fantrax projections give false precision without confidence bounds
   - No guidance on kill conditions (when to pivot away)

### User Pain Points
- **Time sink**: Scouring Fantrax rosters, news, and projection tables takes 20-30 minutes per gameweek
- **FOMO**: Fear of missing obvious pickups or starting the wrong player
- **No memory**: Can't track if past recommendations were good or lucky
- **Projection over-reliance**: Fantrax numbers feel authoritative but are often wrong

### Opportunity
Managers **trust a human scout** (cbarrett97) more than Fantrax. Scout systematizes that intelligence into software, providing:
- Personalized recommendations tied to *your* roster holes
- Transparent reasoning ("Why now")
- Confidence levels with kill conditions
- Retrospective learning from decision outcomes

---

## Product Vision

**Scout is the paid brain that makes Over the Moon managers smarter, faster, and more confident.**

### North Star Principles

1. **One model, two views**  
   Opportunity Board (pickups) and Matchup Prep (start/sit) share the same underlying form-scoring engine. A player's "hotness" is consistent everywhere.

2. **SIA-first, league-wide later**  
   Launch with Saints Intelligence Agency as the primary user. Expand to all Over the Moon managers once validated. Future: Commissioner tools for league-wide insights.

3. **Form = Heat, not lines**  
   Replace flat projection charts with dynamic heat buckets:
   - **Cold**: Avoid (injured, benched, bad form)
   - **Warm**: Watchlist (occasional returns, uncertain minutes)
   - **Hot**: Reliable starter with recent returns
   - **Fire**: Multi-goal/assist upside or clean sheet lock
   - **Burning**: Elite form + high ceiling fixture

4. **Fantrax projections are a noisy prior**  
   Never show Fantrax numbers as ground truth. Use them as baseline signal, then:
   - Boost when recent actuals beat projections
   - Decay when projections miss badly
   - Label as "market expected X" in small print, if shown at all

5. **Decision quality proof layer**  
   Future iterations freeze recommendations and log outcomes. Scout earns trust through retrospective accuracy, not just vibes.

---

## Users & Personas

### Primary User: SIA Manager (cbarrett97)
**Profile:**
- Highly engaged, multiple-league player
- Watches matches, follows injury news, understands tactical nuances
- Wants to **save time** without losing edge
- Needs recommendations that respect his preferences (e.g., no Arsenal inbound players, never drop Garner/Truffert/Havertz)

**Use Cases:**
1. Sunday night: Check Opportunity Board for Wednesday pickups
2. Friday morning: Review start/sit for weekend fixtures
3. Post-GW: Validate Scout's recs against actual outcomes (future feature)

**Success Metrics:**
- Reduces wire research time from 20min → 5min
- Catches 80%+ of optimal pickups (validated retrospectively)
- Trusts Scout enough to pay for it

---

### Secondary User: OTM Manager (Any team)
**Profile:**
- Casual to moderate engagement
- Checks league weekly but doesn't watch every match
- Wants quick, actionable advice without deep research

**Use Cases:**
1. Weekly: "Who should I pick up?" → Opportunity Board
2. Matchday: "Should I bench Player X?" → Matchup Prep
3. Season-long: Track form trends for long-term planning

---

### Future User: Commissioner
**Profile:**
- League admin, cares about fairness and engagement
- Wants to understand league-wide trends (e.g., which teams are active on wire)

**Use Cases (Post-MVP):**
1. League health dashboard: pickup activity, form trends
2. Balance insights: are waiver players clustered by position?

---

## Core Features

### 1. Opportunity Board (Pickups)
**What:** Ranked list of available players (FA or waiver) who fit your roster holes or clearly beat your bench.

**Key Elements:**
- Personalized to **your roster** (e.g., SIA needs a DEF, show DEFs)
- **Why now**: 1-2 sentence English explanation
- **Form chip**: Visual heat indicator (Warm/Hot/Fire/Burning or Cold)
- **Recent GW summary**: Last 2-3 gameweeks scored + start/minutes context
- **Beats who**: "This player beats [Bench Player] on your roster"
- **Confidence + kill conditions**: Low/Med/High confidence, conditions to abort

**Example Card:**
```
Matheus Cunha · WOL · F · FA
Why now: Scored in 3 straight, home vs SOU (worst DEF)
Form: 🔥 Fire
Last 3 GW: 7, 9, 8 (all starts, 270 min)
Beats: [Your bench forward]
Confidence: High | Kill if: benched or injury news pre-GW
Fantrax market: 8.2 proj (footnote)
```

---

### 2. Matchup Prep (Start/Sit)
**What:** For your upcoming fixture, see which starters are hot/cold and get start/sit guidance.

**Key Elements:**
- **Lineup heatmap**: Visual grid of your starting XI with form chips
- **Bench comparison**: "Should I start Player A or Player B?"
- **Fixture context**: Opponent defensive strength, home/away
- **Confidence**: Low/Med/High on each recommendation

**Example View:**
```
GW18 Lineup Heat (vs Opponent)

GK: Sá (Hot) ✅ Start
DEF: Trippier (Fire) ✅ Start, Zinchenko (Cold) ⚠️ Bench risk
MID: Palmer (Burning) ✅ Start, Paquetá (Warm) 🤔 Monitor
FWD: Watkins (Fire) ✅ Start

Bench: Should start Gibbs-White (Hot) over Zinchenko (Cold)?
Confidence: High | Reasoning: Zinchenko didn't train, Gibbs-White home vs NEW
```

---

## Data Sources & Architecture

### Existing Data (v1)
1. **Fantrax API** (via `/api/fantrax/*` routes):
   - Ownership status (FA, WW, owned by Team X)
   - Recent FPts (year-to-date, last 3 GW)
   - Weekly projections (noisy prior)
   - Player metadata (name, team, position)

2. **Projection Snapshots** (Supabase `projection_snapshots` table):
   - Frozen pre-GW projections (before Fantrax overwrites with actuals)
   - Enables "scored vs projected" comparison
   - Already implemented, captured via `/api/fantrax/capture` cron

3. **Player Week Stats** (Supabase `player_week_stats` table):
   - Actual scored FPts per player per gameweek (after fixtures)
   - Minutes played and started signal
   - Denormalized position and club for Scout cards
   - Multiple captures allowed as week progresses
   - Captured via `/api/fantrax/capture` cron

4. **Ownership Snapshots** (Supabase `ownership_snapshots` table):
   - Player availability (FA/WW/owned) at capture time
   - Waiver day and owner team_id tracking
   - Multiple captures allowed (e.g., daily) for wire movement intelligence
   - Captured via `/api/fantrax/capture` cron

5. **SIA Roster** (Fantrax team roster API):
   - Current starting XI + bench
   - Position holes (e.g., weak DEF depth)
   - Players to never drop (hardcoded in config)

### Future Data (v2+)
- **Predicted XI**: Community sources or FPL API (nice-to-have)
- **Decision log**: Scout's own recommendations + outcomes (for learning loop)
- **Opponent defensive strength**: For refined form scoring (v2)

### Data Flow
```
Fantrax API → /api/fantrax/* routes → Form Engine (TS lib)
                                           ↓
                                      Form Score (0-100)
                                           ↓
                                      Heat Bucket (Cold/Warm/Hot/Fire/Burning)
                                           ↓
              ┌────────────────────────────┴─────────────────────────┐
              ↓                                                      ↓
    Opportunity Board API                                    Matchup Prep API
    (/api/scout/opportunities)                              (/api/scout/matchup)
              ↓                                                      ↓
    Scout UI (/scout)                                       Scout UI (/scout/matchup)
```

---

## Form Model Specification

**Goal:** Compute a **continuous form score (0-100)** from recent Fantrax points, then bucket into heat levels.

### Formula (Season 1)

**Inputs:**
- `lastGW`: FPts from most recent gameweek (if finished)
- `priorGW`: FPts from 2 gameweeks ago
- `prior2GW`: FPts from 3 gameweeks ago
- `minutesStability`: Proportion of recent games with 60+ minutes (0-1)
- `startRate`: Proportion of recent games started (0-1)
- `projBeat`: Boolean, did recent actual beat frozen projection?
- `projSnapshot`: Frozen Fantrax projection for current GW

**Base Score:**
```
baseScore = (lastGW * 3.0) + (priorGW * 1.5) + (prior2GW * 0.5)
```

**Minutes Adjustment:**
```
minutesBonus = (minutesStability * 8) + (startRate * 6)
```

**Surprise Bump:**
```
surpriseBonus = projBeat ? 5 : 0
```

**Decay:**
```
decayFactor = max(0, 1 - (gameweeksSinceLastReturn / 4))
// If player hasn't returned in 4 GW, decay to zero
```

**Final Score:**
```
formScore = (baseScore + minutesBonus + surpriseBonus) * decayFactor
```

**Clamped to 0-100.**

---

### Heat Buckets (Display)

| Bucket    | Score Range | Meaning                                      | UI Color |
|-----------|-------------|----------------------------------------------|----------|
| Cold      | 0-15        | Injured, benched, or no returns              | Blue     |
| Warm      | 16-35       | Occasional returns, uncertain minutes        | Yellow   |
| Hot       | 36-60       | Reliable starter, recent returns             | Orange   |
| Fire      | 61-80       | Multi-returns or clean sheet lock            | Red      |
| Burning   | 81-100      | Elite form + high ceiling                    | Purple   |

**Display on UI:**
- Chip badge: `🔥 Fire` or `❄️ Cold`
- Color-coded background for visual scan
- Tooltip shows raw score for power users

---

### Model Transparency (Season 1)

Scout v1 uses **transparent, rule-based scoring**—no black-box ML. This builds trust:
- Users see "recent FPts weighted heavier for last GW"
- Surprise bumps labeled: "Beat Fantrax proj by 3 FPts"
- Decay logic explained: "No returns in 3 GW → score decays"

**Future Iterations (Season 2+):**
- Incorporate opponent defensive strength (e.g., vs SOU DEF = +5%)
- Home/away splits for players with strong H/A bias
- Fixture congestion adjustments (e.g., 3 games in 7 days)
- Validate model with retrospective accuracy metrics

---

## Opportunity Board

### Purpose
Help managers identify **available players** (FA or waiver) who:
1. **Fit roster holes**: Same position as a gap or clearly worse player
2. **Have recent signal**: Scored FPts and/or started recently
3. **Are actionable now**: Hot/Fire/Burning form, not Cold

---

### Hard Filters (v1)

#### 1. Availability Filter
- **Include:** Players with status `FA` (Free Agent) or `WW` (Waiver)
- **Exclude:** Owned by any Over the Moon team

#### 2. Roster Hole Filter
- **Logic:** For SIA roster (or target team):
  - Check each bench/weak starter by position
  - Find available players in **same position bucket** (GK, DEF, MID, FWD)
  - Compare form scores: only show if available player scores ≥10 points higher

**Example:**
- SIA bench DEF: Player X (form score 22, Warm)
- Available DEF: Player Y (form score 48, Hot)
- **Include Y**: beats X by 26 points

#### 3. Signal Filter
- **Minimum signal threshold:**
  - Recent FPts (last 3 GW total ≥ 8 FPts) **OR**
  - Start/minutes signal (≥2 starts in last 3 GW) **OR**
  - Current GW projection ≥6 FPts (if no recent actuals yet)

**Exclude players with zero signal** (e.g., young prospect never played, injured all season).

#### 4. Drop Bans (SIA-specific)
**Never recommend dropping:**
- Garner
- Truffert
- Havertz

**Encoded as config constant:**
```ts
// web/src/lib/scout-config.ts
export const SIA_DROP_BANS = ["Garner", "Truffert", "Havertz"]
```

#### 5. Transfer Preference Filters (SIA-specific)
**No Arsenal inbound players** for SIA.
- Exclude any available Arsenal players from SIA's Opportunity Board
- Rationale: Personal preference to avoid Arsenal assets

**Encoded as config:**
```ts
export const SIA_TEAM_FILTERS = { exclude: ["ARS"] }
```

---

### Ranking Algorithm

**Sort available players by:**
1. **Form score (descending)**: Hot/Fire/Burning rank higher
2. **Gap to bench player (descending)**: If beats bench by +30, rank higher than +15
3. **Availability (FA > WW)**: Free agents rank slightly higher than waiver
4. **Tiebreaker**: Alphabetical by name

**Limit:** Show **top 10-15** opportunities per position to avoid clutter.

---

### Recommendation Card Schema

Each card includes:

#### **Player Metadata**
- Name, Club, Position, Availability (FA or WW day)

#### **Why Now** (1-2 sentences, English)
- "Scored in 3 straight, home vs SOU (worst DEF)"
- "Started last 4 GW, clean sheet odds vs injured ATT"

#### **Form Chip**
- Heat bucket badge: Warm/Hot/Fire/Burning (or Cold)
- Visual indicator (color-coded)

#### **Recent GW Summary**
- Last 2-3 GW scored: "7, 9, 8"
- Start/minutes context: "(all starts, 270 min)" or "(2 starts, 1 off bench)"

#### **Beats Who on SIA Roster** (mandatory)
- "Beats: [Bench Player Name] (Warm, 22 pts form score)"
- Shows user exactly who to drop or bench

#### **Confidence + Kill Conditions**
- **Confidence:** Low / Med / High
- **Kill conditions:** "If benched or injury news pre-GW, skip"
- **Reasoning:** Transparent logic for confidence level

#### **Fantrax Projection** (optional, footnote)
- Tiny text: "Market expected 8.2 FPts" (if shown at all)
- De-emphasized: never the primary decision signal

---

### Example Card (Full)
```
┌─────────────────────────────────────────────────────────────┐
│ Matheus Cunha · WOL · F · FA                                │
├─────────────────────────────────────────────────────────────┤
│ Why now: Scored in 3 straight, home vs SOU (worst DEF)     │
│                                                             │
│ Form: 🔥 Fire (68 pts)                                      │
│ Last 3 GW: 7, 9, 8 (all starts, 270 min)                   │
│                                                             │
│ Beats: Ivan Toney (Warm, 24 pts)                           │
│                                                             │
│ Confidence: High                                            │
│ Kill if: Benched or injury news pre-GW                      │
│                                                             │
│ Fantrax market: 8.2 proj (footnote)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Matchup Prep

### Purpose
Help managers **optimize their starting XI** for the upcoming gameweek:
- Visual heatmap of form across positions
- Start/sit recommendations for close calls
- Confidence levels with reasoning

---

### Key Views

#### 1. Lineup Heatmap
**Visual grid** of starting XI with form chips:
```
GK:  Sá (Hot) ✅
DEF: Trippier (Fire) ✅ | Zinchenko (Cold) ⚠️ | Gvardiol (Hot) ✅
MID: Palmer (Burning) ✅ | Paquetá (Warm) 🤔 | Kudus (Hot) ✅
FWD: Watkins (Fire) ✅ | Isak (Hot) ✅
```

**Color-coded:**
- Burning/Fire: Green ✅ (strong start)
- Hot/Warm: Yellow 🤔 (monitor)
- Cold: Red ⚠️ (bench risk)

---

#### 2. Start/Sit Comparisons
**For each close call**, show:
- Player A (Warm) vs Player B (Hot)
- Form scores: 32 vs 48
- Reasoning: "Player B started last 3 GW, Player A rotated"
- Confidence: Med/High
- Recommendation: "Start Player B"

**Example:**
```
Should you start Gibbs-White (Hot, 54) over Zinchenko (Cold, 18)?

Reasoning:
- Gibbs-White home vs NEW, started last 4 GW (360 min)
- Zinchenko didn't train Friday, rotation risk
- Form gap: +36 points

Recommendation: Start Gibbs-White
Confidence: High
Kill if: Gibbs-White not in predicted XI 1hr before kickoff
```

---

#### 3. Bench Order
**Suggest optimal bench order** based on:
- Form scores (higher = first sub)
- Position (e.g., GK always last)
- Fixture timing (early KO = higher priority if starter doubt)

**Example:**
```
Recommended Bench Order:
1. Gibbs-White (Hot, 54) — first sub
2. Toney (Warm, 24) — second sub
3. Zinchenko (Cold, 18) — third sub
```

---

## Confidence & Kill Conditions

### Confidence Levels

**High Confidence:**
- Form score gap ≥20 points
- Recent starts (3+ in last 4 GW)
- No injury/rotation news
- Example: "Start Palmer (Burning) over Zinchenko (Cold)"

**Medium Confidence:**
- Form score gap 10-20 points
- Some minutes uncertainty (e.g., 1 benching in last 4 GW)
- Marginal fixture advantage
- Example: "Start Paquetá (Warm) over Kudus (Warm) — slight form edge"

**Low Confidence:**
- Form score gap <10 points
- High rotation risk (both players)
- Injury doubts
- Example: "Toss-up between two Warm players, check team news"

---

### Kill Conditions (When to Abort)

Each recommendation includes **explicit abort triggers**:

**Common kill conditions:**
1. **Injury news pre-GW**: "If player doesn't train Friday, skip"
2. **Not in predicted XI**: "If not in predicted XI 1hr before KO, bench"
3. **Benched last GW unexpectedly**: "If benched without injury, downgrade to Warm"
4. **Fixture postponed**: "If fixture moves, re-evaluate"
5. **Manager comments**: "If manager says 'rotation needed', bench"

**Example:**
```
Recommendation: Pick up Cunha
Kill conditions:
- If Cunha injured in training (check Wolves news Wed/Thu)
- If Cunha not in predicted XI by Friday
- If better Fire/Burning option appears on wire before deadline
```

**Why kill conditions?**
- Teaches managers **when to pivot**, not just what to do
- Builds trust: "Scout gave me an out when news changed"
- Reduces buyer's remorse: "I followed Scout, but the kill condition hit"

---

## Learning Loop & Decision Log

**Post-MVP feature** (PR7, later phase).

### Purpose
Track Scout's recommendations + outcomes to:
1. **Validate model accuracy**: Did Hot players outperform Warm?
2. **Improve future recommendations**: Learn which signals matter most
3. **Build user trust**: Show retrospective "Scout was right 78% of the time"

---

### Data Captured

When Scout shows a recommendation:
- **Freeze the rec**: Player, form score, heat bucket, confidence
- **Freeze context**: GW, fixture, opponent, minutes played
- **User action**: Did they follow Scout's advice? (optional tracking)

After GW completes:
- **Actual outcome**: FPts scored, minutes played
- **Hit/miss**: Did Hot player beat Warm player? (if start/sit)
- **Kill condition triggered?**: Was there injury news? (manual or scraped)

---

### Retrospective Views

**For Users (Manager):**
- "Scout's Accuracy This Season": % of recs that beat bench/wire alternatives
- "Your Best Follows": Top 5 pickups where you followed Scout
- "Missed Opportunities": Top 3 wires Scout flagged but you skipped

**For Product Team:**
- Model calibration: Are "High confidence" recs actually 80%+ accurate?
- Signal importance: Do minutes matter more than FPts for DEF?
- Failure modes: Which kill conditions fire most often?

---

### Example Retrospective Card (Future)
```
GW17 Recommendation: Pick up Cunha (Fire, 68)
Your action: Picked up, started
Outcome: Cunha scored 9 FPts (goal, assist)
Bench player: Toney scored 2 FPts (no returns)
Result: ✅ Hit (+7 FPts vs bench)

Scout accuracy this GW: 4/5 recs hit (80%)
```

---

## Non-Goals

**What Scout will NOT do (at least in v1):**

### 1. Replicate Fantrax
- We don't show full league tables, scoreboard, or matchup grids
- League page remains the "this week HQ" for live scoring
- Scout focuses on **decisions**, not **data replication**

### 2. Long-Term Planning
- No "ROS rankings" (rest-of-season projections)
- No "fixture ticker" showing GW20-38 schedules
- Scout is a **weekly decision tool**, not a draft guide

### 3. Multi-League Support (v1)
- Launch with **OTM league only**, SIA-first
- Future: Expand to other Fantrax leagues, but not day 1

### 4. Trade Recommendations
- Scout focuses on **wire pickups** and **start/sit**
- No "should I trade Player A for Player B?" (too complex for v1)

### 5. Advanced Metrics
- No xG, xA, xGI, or other Opta-style analytics (requires paid data)
- Stick to Fantrax FPts + minutes/starts as signals

### 6. Chatbot / Conversational UI
- Scout shows structured cards, not a chat interface
- No "Scout, who should I start?" natural language queries (maybe v2)

---

## Open Questions

**To resolve before/during implementation:**

### Data & Modeling
1. **Minutes data source?**
   - Option A: FPL API (free, good coverage)
   - Option B: Scrape Fantrax detailed stats (more work)
   - Option C: Stub for v1, show "started Y/N" only

2. **Predicted XI source?**
   - Community sources (e.g., Ben Dinnery, Fantasy Football Scout)
   - FPL API (limited, only "chance of playing")
   - Stub for v1, rely on availability icons only

3. **How often to refresh form scores?**
   - Recompute after every GW (obvious)
   - Recompute mid-week if minutes/news changes? (nice-to-have)

---

### UX & Design
4. **How many opportunities to show per position?**
   - Top 5? Top 10? Dynamic based on form gaps?
   - Tradeoff: Completeness vs clutter

5. **Mobile-first or desktop-first?**
   - Scout must work on mobile (most users check on phone)
   - Ensure cards fit in portrait viewport

6. **How to surface kill conditions?**
   - Inline in card (verbose)?
   - Tooltip/expandable (hidden until clicked)?
   - Separate "Watch List" section?

---

### Product & Pricing
7. **Pricing model?**
   - Flat monthly ($5-10/mo)?
   - Per-league ($3/league/season)?
   - Freemium (Opportunity Board free, Matchup Prep paid)?

8. **How to gate Scout (auth)?**
   - Convex auth + Stripe subscription?
   - Simple team ID cookie (trust-based, no paywall for v1)?

9. **Commissioner tools timing?**
   - Add in v1 (league-wide Opportunity Board)?
   - Defer to Season 2?

---

### Technical
10. **Where to host form engine?**
    - Pure TS lib in `web/src/lib/form-engine.ts`?
    - Separate npm package for reusability?
    - Answer: Keep in `lib/` for v1, extract later if needed

11. **How to test form model?**
    - Unit tests with fixture data (easy)
    - Backtest on historical GW data (harder, requires data collection)
    - Answer: Unit tests for v1, backtest in Season 2

---

## Implementation Roadmap

**Phased PR plan with acceptance criteria per PR.**

---

### **PR1: Documentation** ✅ (This PR)

**Goal:** Comprehensive product doc + updated ROADMAP.

**Files:**
- `docs/product/scout.md` (this file)
- `ROADMAP.md` (updated to reflect Scout as spine)

**Acceptance Criteria:**
- [ ] Product doc covers all sections (problem, vision, features, model, filters, roadmap)
- [ ] ROADMAP reflects Now/Next/Later with Scout milestones
- [ ] Linked from root README (optional)
- [ ] PR reviewed and merged to `main`

**Effort:** 1-2 hours  
**Dependencies:** None

---

### **PR2: Form Engine**

**Goal:** Pure TypeScript library for computing continuous form scores + heat buckets.

**Files:**
- `web/src/lib/form-engine.ts` (core scoring logic)
- `web/src/lib/form-engine.test.ts` (unit tests)

**Exports:**
```ts
export function computeFormScore(input: FormInput): number
export function formScoreToHeat(score: number): HeatBucket
export type HeatBucket = "cold" | "warm" | "hot" | "fire" | "burning"
```

**FormInput:**
```ts
type FormInput = {
  lastGW: number | null        // FPts most recent GW
  priorGW: number | null       // FPts 2 GW ago
  prior2GW: number | null      // FPts 3 GW ago
  minutesStability: number     // 0-1, % recent games with 60+ min
  startRate: number            // 0-1, % recent games started
  projBeat: boolean            // Did recent actual beat frozen proj?
}
```

**Unit Tests:**
- High form player (3 straight returns): expect Fire/Burning
- Low form player (0 returns, benched): expect Cold
- Moderate form (1 return, rotation): expect Warm/Hot
- Decay after 4 GW: expect score → 0

**Acceptance Criteria:**
- [ ] `computeFormScore` produces 0-100 score
- [ ] `formScoreToHeat` buckets correctly (Cold/Warm/Hot/Fire/Burning)
- [ ] Unit tests pass (5+ test cases)
- [ ] No Fantrax API calls (pure function, no side effects)
- [ ] No UI changes (lib only)
- [ ] No new env vars required
- [ ] `npm run build` succeeds
- [ ] `npm test` passes (if test script exists)

**Effort:** 3-4 hours  
**Dependencies:** None  
**Merge Strategy:** Squash-merge to `main` when CI green

---

### **PR3: Scout API**

**Goal:** Server route that returns ranked opportunity candidates with rec-card fields.

**Files:**
- `web/src/app/api/scout/opportunities/route.ts` (new)
- `web/src/lib/scout-config.ts` (SIA drop bans, team filters)
- Update `web/src/lib/fantrax.ts` if needed (fetch available players)

**API Endpoint:**
```
GET /api/scout/opportunities?leagueId=X&teamId=Y
```

**Response:**
```json
{
  "opportunities": [
    {
      "player": {
        "id": "abc123",
        "name": "Matheus Cunha",
        "club": "WOL",
        "position": "F",
        "availability": "FA"
      },
      "whyNow": "Scored in 3 straight, home vs SOU (worst DEF)",
      "formChip": "fire",
      "formScore": 68,
      "recentGW": [7, 9, 8],
      "minutesContext": "all starts, 270 min",
      "beatsWho": {
        "benchPlayer": "Ivan Toney",
        "benchFormChip": "warm",
        "benchFormScore": 24
      },
      "confidence": "high",
      "killConditions": ["Benched or injury news pre-GW"],
      "fantraxProj": 8.2
    }
  ]
}
```

**Logic:**
1. Fetch SIA roster (or `teamId`) via Fantrax API
2. Fetch available players (FA + WW) via Fantrax API
3. For each available player:
   - Compute form score (call form engine)
   - Check hard filters (availability, roster hole, signal, drop bans)
   - If passes, generate rec card fields
4. Rank by form score, availability, gap to bench
5. Return top 10-15 per position

**Acceptance Criteria:**
- [ ] API returns valid JSON with rec card fields
- [ ] Respects hard filters (availability, roster hole, signal, drop bans, SIA team filters)
- [ ] Graceful when data thin (empty response, not error)
- [ ] No new env vars required (uses existing Fantrax API)
- [ ] No UI changes (API only)
- [ ] `npm run build` succeeds
- [ ] Manually test with OTM league ID + SIA team ID

**Effort:** 4-5 hours  
**Dependencies:** PR2 (form engine)  
**Merge Strategy:** Squash-merge to `main` when CI green

---

### **PR4: Scout UI**

**Goal:** New `/scout` page with Opportunity Board, mobile-friendly, WCAG AA.

**Files:**
- `web/src/app/scout/page.tsx` (new)
- `web/src/components/scout/opportunity-board.tsx` (new component)
- `web/src/components/scout/rec-card.tsx` (individual card component)
- Update `web/src/components/app-header.tsx` (add Scout nav link)

**Page Structure:**
```
/scout (or /scout/opportunities)

[ Header: Opportunity Board · GW18 ]
[ Filter: Position (All, GK, DEF, MID, FWD) ]

[ Rec Card 1: Matheus Cunha (Fire) ]
[ Rec Card 2: Alex Iwobi (Hot) ]
[ Rec Card 3: ... ]

[ Footer: Powered by Scout · cbarrett97 ]
```

**Rec Card Component:**
- Visual form chip (color-coded badge)
- Player metadata (name, club, position, FA/WW)
- "Why now" text
- Recent GW summary
- "Beats who" comparison
- Confidence + kill conditions (collapsible/tooltip)
- Fantrax proj (tiny footnote, if shown)

**Mobile UX:**
- Cards stack vertically (no horizontal scroll)
- Touch-friendly (tap to expand kill conditions)
- Works in portrait viewport (375px wide)

**Accessibility (WCAG AA):**
- Semantic HTML (`<article>` for card, `<button>` for expand)
- Color not sole indicator (text labels + icons for heat)
- Keyboard navigable (tab through cards)
- Screen reader friendly (aria-labels for form chips)

**Acceptance Criteria:**
- [ ] `/scout` page loads with rec cards
- [ ] Fetches from `/api/scout/opportunities`
- [ ] SIA-first (defaults to cbarrett97 team ID)
- [ ] Mobile responsive (portrait viewport works)
- [ ] WCAG AA compliant (run axe DevTools)
- [ ] Nav link in header (Scout)
- [ ] No new env vars required
- [ ] No breaking changes to existing League/Form pages
- [ ] `npm run build` succeeds

**Effort:** 5-6 hours  
**Dependencies:** PR3 (Scout API)  
**Merge Strategy:** Squash-merge to `main` when CI green

---

### **PR5: Form Page Heat**

**Goal:** Wire existing Form page to use form engine chips/heat instead of proj-only vibes.

**Files:**
- `web/src/app/form/page.tsx` (update)
- `web/src/components/league-form.tsx` (update)
- `web/src/lib/fantrax.ts` (update `loadFantraxForm` to compute form scores)

**Changes:**
- For each player in `FantraxPlayerSeries`:
  - Compute form score via form engine
  - Add `formScore` and `formChip` fields
- Update Form UI:
  - Show heat chip next to player name (Cold/Warm/Hot/Fire/Burning)
  - Replace flat proj chart with color-coded bars or badges
  - Tooltip shows raw form score for power users

**Acceptance Criteria:**
- [ ] Form page shows heat chips (Warm/Hot/Fire/Burning/Cold)
- [ ] Existing functionality preserved (charts, tooltips)
- [ ] No breaking changes to League page
- [ ] No new env vars required
- [ ] `npm run build` succeeds

**Effort:** 3-4 hours  
**Dependencies:** PR2 (form engine)  
**Merge Strategy:** Squash-merge to `main` when CI green

---

### **PR6: Matchup Prep**

**Goal:** Start/sit view on Scout (or `/scout/matchup`) using same form scores.

**Files:**
- `web/src/app/scout/matchup/page.tsx` (new)
- `web/src/components/scout/lineup-heatmap.tsx` (new component)
- `web/src/components/scout/start-sit-comparison.tsx` (new component)
- `web/src/app/api/scout/matchup/route.ts` (new API)

**API Endpoint:**
```
GET /api/scout/matchup?leagueId=X&teamId=Y&period=Z
```

**Response:**
```json
{
  "lineup": [
    { "player": "Sá", "position": "GK", "formChip": "hot", "formScore": 54, "status": "start" },
    { "player": "Trippier", "position": "DEF", "formChip": "fire", "formScore": 72, "status": "start" },
    ...
  ],
  "comparisons": [
    {
      "playerA": { "name": "Zinchenko", "formChip": "cold", "formScore": 18 },
      "playerB": { "name": "Gibbs-White", "formChip": "hot", "formScore": 54 },
      "recommendation": "Start Gibbs-White",
      "reasoning": "Form gap +36, Zinchenko rotation risk",
      "confidence": "high",
      "killConditions": ["If Gibbs-White not in predicted XI"]
    }
  ]
}
```

**UI Views:**
1. **Lineup Heatmap**: Visual grid of starting XI with form chips
2. **Start/Sit Cards**: Show comparisons for close calls
3. **Bench Order**: Suggested order based on form

**Acceptance Criteria:**
- [ ] `/scout/matchup` page loads with lineup + comparisons
- [ ] Fetches from `/api/scout/matchup`
- [ ] SIA-first (defaults to cbarrett97 team ID)
- [ ] Mobile responsive
- [ ] WCAG AA compliant
- [ ] No new env vars required
- [ ] `npm run build` succeeds

**Effort:** 5-6 hours  
**Dependencies:** PR2 (form engine), PR4 (Scout UI patterns)  
**Merge Strategy:** Squash-merge to `main` when CI green

---

### **PR7: Decision Log (Later)**

**Goal:** Freeze recommendations + log outcomes for retrospective accuracy.

**Scope:** Post-MVP, Season 2 feature.

**Files (Future):**
- `web/src/app/api/scout/log/route.ts` (write recs to DB)
- `web/src/app/scout/history/page.tsx` (retrospective view)
- Supabase migration: `scout_recommendations` table
- Supabase migration: `scout_outcomes` table

**Deferred Rationale:**
- Requires persistent storage (Supabase tables)
- Adds complexity (tracking user actions)
- Not critical for v1 launch (nice-to-have)

**Future Acceptance Criteria:**
- [ ] Freeze rec when shown to user
- [ ] Log actual outcome after GW completes
- [ ] Retrospective view shows hit rate
- [ ] Privacy-compliant (no PII leakage)

**Effort:** 8-10 hours  
**Dependencies:** PR2-6 (Scout core features)

---

## Next Steps (Post-MVP)

After the Scout core launches (Opportunity Board, Matchup Prep, Form heat chips), these features expand the intelligence layer:

### **Fixture Context Layer**

**Problem:** Form-only scoring misses fixture difficulty. A hot player with 5 tough matches ahead may underperform a warm player with easy fixtures.

**Solution:** Fixture difficulty ratings (1-10) blended into form scores or shown as context notes.

**Implementation:**
- Data source: FPL-style fixture difficulty ratings (crowd-sourced or model-based)
- API endpoint: `/api/scout/fixtures?leagueId=X` returns upcoming fixtures per club
- UI: Show "Next 5" difficulty bars next to player cards
- Confidence boost/penalty: Adjust recommendations based on fixture run

**Example:**
```
🔥 Saka (Arsenal)
Form: Fire (68)
Next 5: ⚫⚫⚪⚪⚪ (2 tough, 3 easy)
→ "Hot form, but tricky fixtures ahead. Monitor closely."
```

**Scope:** Medium (1-2 weeks). Requires fixture data source + blending logic.

---

### **Waiver Claim Helper**

**Problem:** Multiple hot players on waivers → priority order unclear. Managers waste high claims on players that could've been free agents.

**Solution:** Recommend waiver claim priority order based on form + ownership pressure (% roster gap in league).

**Implementation:**
- UI: `/scout/waivers` page showing ranked waiver targets
- API: `/api/scout/waivers?leagueId=X&teamId=Y&period=Z`
- Logic:
  - Filter to players on waivers (not FA yet)
  - Sort by form score + roster gap urgency
  - Flag "likely to clear waivers" (low % rostered, multiple alternatives)
  - Show claim priority: "Use #1 claim on Player X, wait for Player Y"

**Example:**
```
🔥 Garnacho (MUN) — Claim Priority: #1
  Form: Fire (71), 12% league rostered, fills your MID hole
  → "High form, low ownership, top claim"

🔥 Rogers (AVL) — Claim Priority: #3
  Form: Fire (69), 18% league rostered
  → "Hot, but likely to clear waivers. Wait and see."
```

**Scope:** Medium (1-2 weeks). Extends Opportunity Board logic.

---

## Season 2 Features

These features transform Scout from a decision aid into a **league intelligence platform**:

### **Trade Desk**

**Problem:** Manual trade proposals are guesswork. Hard to know fair value or what opponents need.

**Solution:** Trade suggestion engine based on form + roster gaps for both teams. Show "win-win" trades.

**Features:**
- Input: "Which teams might trade for Player X?"
- Output: Suggested trade partners + fair-value bundles
- Context: Form differential, position needs, team standings

**Example:**
```
Trade Analyzer: Trippier (your team)

Suggested Partners:
1. Team B (needs DEF, has surplus MID)
   → Offer: Trippier for Gibbs-White
   Fair Value: ✅ (form parity + position swap)
   
2. Team C (needs premium DEF)
   → Offer: Trippier + bench MID for Saliba + bench FWD
   Fair Value: ⚠️ (slight overpay, but fills gap)
```

---

### **Commissioner Power Map**

**Problem:** In competitive leagues, who's dominant? Who's rebuilding? Unclear.

**Solution:** League-wide roster strength heatmap based on aggregated form scores per team.

**Features:**
- Team rankings by total form score (all starters)
- Trend: "Team X gained +15 form this week"
- Roster depth comparison: "Team Y has fire bench, Team Z is thin"

**UI:**
- `/scout/league` power rankings
- Color-coded heatmap (teams as rows, positions as columns)
- Alerts: "Team B added 3 fire players this week — watch out!"

---

### **Kill-Condition Alerts**

**Problem:** Recommendations go stale. A player's injury/red card/team news invalidates the rec.

**Solution:** Real-time alerts when kill conditions trigger. Push notification or in-app banner.

**Implementation:**
- Monitor Fantrax news feed or external injury APIs
- Match news keywords to kill conditions (e.g., "rotation risk" → flag when player benched)
- Push alert: "⚠️ Rec expired: Zinchenko not in predicted XI"

**Scope:** High complexity (requires external APIs + push infra). Post-launch.

---

### **Morning Scout Brief**

**Problem:** Managers want a daily summary, not manual dashboard checks.

**Solution:** Email/SMS digest summarizing overnight changes. "Good morning, here's what changed in your league."

**Example:**
```
Over the Moon Morning Brief — Oct 15, 2024

🔥 Hot Pickups:
- Garnacho (MUN) went Fire (+12 form)
- 3 managers added him overnight

⚠️ Lineup Alerts:
- Your starter Zinchenko may be rotated (kill condition triggered)

📊 League Update:
- Team B climbed to #2 after adding 2 fire players
```

**Scope:** Medium (1-2 weeks). Requires email integration (Resend, SendGrid).

---

### **Share Cards**

**Problem:** Recommendations are valuable → managers want to share wins with friends.

**Solution:** Export rec cards as shareable images (Twitter/WhatsApp friendly).

**Features:**
- "Share this rec" button on Opportunity Board cards
- Generates PNG with branding: "Over the Moon Scout · Rec by cbarrett97"
- Tracks shares for virality metrics

**Example:**
```
[Shareable Image]
🔥 Scout Rec: Garnacho (MUN)
Form: Fire (71) | Beats: Sterling (36)
Why Now: 3-game hot streak, easy fixtures
Kill Conditions: If not in predicted XI

Powered by Over the Moon Scout
```

---

### **Decision Log & Retrospective**

**Problem:** Did Scout recs work? No feedback loop → managers lose trust.

**Solution:** Log all recs + outcomes. Show accuracy % per rec type. "Scout hit 72% last month."

**Features:**
- Auto-log recs when shown to user
- After GW completes: compare rec to actual FPts
- Retrospective view: "Your accepted recs scored +18 FPts vs. your declined ones"
- Model learning: Use logged outcomes to tune form weights

**UI:**
- `/scout/history` page with win/loss timeline
- Accuracy badges: "Scout Opportunity Board: 68% hit rate"

**Scope:** High (2-3 weeks). Requires Supabase tables + outcome tracking.

---

### **Multi-League Support**

**Problem:** Managers in multiple leagues must context-switch. No unified Scout.

**Solution:** Aggregate Scout across all user's leagues. "Here are top pickups across your 3 leagues."

**Features:**
- League switcher dropdown on Scout pages
- Cross-league opportunity board: "This player is hot in 2 of your leagues"
- Unified form scoring (same model, different rosters)

**Scope:** Medium (1-2 weeks). Extends existing API with league iteration.

---

## Summary

Scout transforms Over the Moon from a league companion into a **competitive advantage tool**. By unifying pickups and start/sit decisions with a transparent form-scoring model, Scout saves managers time while improving decision quality.

**Launch Strategy:**
1. **Season 1 (v1)**: SIA-first, Opportunity Board + Matchup Prep + Form heat chips (✅ Complete)
2. **Season 1.5 (Next)**: Fixture context layer + Waiver claim helper
3. **Season 2**: Trade desk, Commissioner power map, Kill-condition alerts, Morning Scout brief, Share cards, Decision log
4. **Season 3+**: Multi-league support, Model refinements, Premium tier

Scout earns trust through **transparency** (explicit reasoning, kill conditions) and **validation** (retrospective accuracy). This product brief serves as the north star for implementation.

---

**Questions or feedback?** Ping cbarrett97 or Connor (bytesofconnor).
