/**
 * Rollover and week-phase cases for issue #78.
 * Run with: npx tsx src/lib/scoring-week.test.ts
 */

import {
  currentPeriodNumber,
  weekChrome,
  weekPhase,
  weekPhaseFromSnapshot,
  type SlateScore,
} from "./scoring-week"

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
  console.info(`PASS: ${message}`)
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    console.error(`FAIL: ${message} (expected ${String(expected)}, got ${String(actual)})`)
    process.exit(1)
  }
  console.info(`PASS: ${message}`)
}

const overlapPeriods = [
  {
    number: 7,
    startDate: "2026-10-16T00:00:00.0-0400",
    endDate: "2026-10-23T23:59:59.0-0400",
  },
  {
    number: 8,
    startDate: "2026-10-23T00:00:00.0-0400",
    endDate: "2026-10-30T23:59:59.0-0400",
  },
]

const oct22 = Date.parse("2026-10-22T18:00:00.000Z")
const oct23Noon = Date.parse("2026-10-23T12:00:00.000Z")
const oct24 = Date.parse("2026-10-24T12:00:00.000Z")

assertEqual(currentPeriodNumber(overlapPeriods, oct22), 7, "Oct 22 stays on GW7")
assertEqual(
  currentPeriodNumber(overlapPeriods, oct23Noon),
  8,
  "Oct 23 12:00 UTC opens GW8 when GW7's window still contains now",
)
assertEqual(currentPeriodNumber(overlapPeriods, oct24), 8, "Oct 24 stays on GW8")

assertEqual(currentPeriodNumber([], oct23Noon), null, "empty period list is null")
assertEqual(
  currentPeriodNumber(
    [
      { number: 1, startDate: "2026-08-01T00:00:00.0-0400", endDate: "2026-08-08T00:00:00.0-0400" },
      { number: 2, startDate: "2026-08-08T00:00:00.0-0400", endDate: "2026-08-15T00:00:00.0-0400" },
    ],
    Date.parse("2026-07-15T12:00:00.000Z"),
  ),
  1,
  "before the season, first upcoming period",
)
assertEqual(
  currentPeriodNumber(overlapPeriods, Date.parse("2026-11-10T12:00:00.000Z")),
  8,
  "after the last period, last period",
)

const pre: SlateScore[] = [
  { homeScore: 0, awayScore: 0, homeProjected: 88.4, awayProjected: 91.2 },
  { homeScore: null, awayScore: null, homeProjected: 70, awayProjected: 65 },
]
assertEqual(weekPhase(pre), "pre", "no scores yet is pre-match")
assertEqual(weekPhase([]), "pre", "empty slate is pre-match")

const liveMidweek: SlateScore[] = [
  { homeScore: 40.2, awayScore: 38.1, homeProjected: 88.4, awayProjected: 91.2 },
  { homeScore: 0, awayScore: 0, homeProjected: 70, awayProjected: 65 },
]
assertEqual(weekPhase(liveMidweek), "live", "any play with remaining projection is live")

const gw7Final: SlateScore[] = [
  { homeScore: 102, awayScore: 100.8, homeProjected: 102, awayProjected: 100.8 },
  { homeScore: 87.4, awayScore: 91.2, homeProjected: 87.4, awayProjected: 91.2 },
]
assertEqual(weekPhase(gw7Final), "final", "every fixture at projection is final (issue #78)")

const almostDone: SlateScore[] = [
  { homeScore: 102, awayScore: 100.8, homeProjected: 102, awayProjected: 100.8 },
  { homeScore: 87.4, awayScore: 90.0, homeProjected: 87.4, awayProjected: 91.2 },
]
assertEqual(weekPhase(almostDone), "live", "one side still has remaining points, stay live")

const overProj: SlateScore[] = [
  { homeScore: 110, awayScore: 105, homeProjected: 102, awayProjected: 100.8 },
]
assertEqual(weekPhase(overProj), "final", "scores at or above projection count as final")

assertEqual(
  weekPhaseFromSnapshot([], { homeScore: "102", awayScore: "100.8", homeProjected: "102", awayProjected: "100.8" }),
  "final",
  "empty slate falls back to the viewed matchup",
)
assertEqual(weekPhaseFromSnapshot([], null), "pre", "no slate and no matchup is pre")

assertEqual(weekChrome("pre", true).badge, null, "pre-match current week has no badge")
assertEqual(weekChrome("pre", true).label, "Projected", "pre-match label is Projected")
assert(!weekChrome("pre", true).showActuals, "pre-match shows projections, not actuals")

assertEqual(weekChrome("live", true).badge, "live", "current live week shows LIVE")
assertEqual(weekChrome("live", true).label, "Live", "current live week label is Live")
assert(weekChrome("live", true).showActuals, "live week shows actual scores")
assert(weekChrome("live", true).showProjLine, "live week still shows the proj line")

assertEqual(weekChrome("final", true).badge, "final", "finished current week shows FINAL")
assertEqual(weekChrome("final", true).label, "Final", "finished current week label is Final")
assert(weekChrome("final", true).showActuals, "finished week shows actual scores")
assert(!weekChrome("final", true).showProjLine, "finished week hides the proj line")

assertEqual(weekChrome("final", false).badge, "final", "a finished past week shows FINAL")
assertEqual(weekChrome("live", false).badge, "final", "paging back to a played week shows FINAL, not LIVE")
assertEqual(weekChrome("live", false).label, "Final", "past played week label is Final")

console.info("\nAll scoring-week tests passed.")
