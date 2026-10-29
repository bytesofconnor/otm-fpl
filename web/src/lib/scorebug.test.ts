import type { HeatBucket } from "./form-engine"
import { heatLabel } from "./form-engine"
import {
  cardKey,
  cardPath,
  parseCardKey,
  presentShare,
  type CardSource,
} from "./scorebug-key"
import {
  paintScorebug,
  readScorebug,
  type Broadcast,
  type BroadcastFacts,
  type MatchupFacts,
  type Scorebug,
  type ScoutFacts,
} from "./scorebug"

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

const HEAT_HEX: Record<HeatBucket, string> = {
  cold: "#3b82f6",
  warm: "#eab308",
  hot: "#f97316",
  fire: "#ef4444",
  burning: "#a855f7",
}

function matchupSource(period = 8): CardSource {
  return { kind: "matchup", leagueId: "league", teamId: "team", period }
}

function scoutSource(): CardSource {
  return { kind: "scout", leagueId: "league", teamId: "team", playerId: "player" }
}

function baseMatchup(overrides: Partial<MatchupFacts> = {}): MatchupFacts {
  return {
    teamKnown: true,
    leagueName: "Over the Moon",
    teamName: "Saints",
    period: 8,
    periodCount: 38,
    periodLabel: "GW8",
    viewedPeriod: 8,
    currentPeriod: 8,
    slate: [],
    matchup: null,
    lines: [],
    ...overrides,
  }
}

function liveSlate() {
  return [
    {
      homeScore: "10",
      awayScore: "4",
      homeProjected: "20",
      awayProjected: "18",
    },
  ]
}

async function read(source: CardSource, facts: BroadcastFacts): Promise<Broadcast> {
  return readScorebug(cardKey(source), async () => facts)
}

async function main(): Promise<void> {
  const matchup = matchupSource()
  const key = cardKey(matchup)
  const parsed = parseCardKey(key)
  assert(parsed?.kind === "matchup", "matchup key round trips")
  if (parsed?.kind === "matchup") {
    assertEqual(parsed.leagueId, "league", "matchup league id")
    assertEqual(parsed.teamId, "team", "matchup team id")
    assertEqual(parsed.period, 8, "matchup period")
  }
  assertEqual(cardPath(key), `/card/${key}`, "card path is /card/<key>")

  const slash = cardKey({ kind: "matchup", leagueId: "a/b", teamId: "100%", period: 38 })
  const slashParsed = parseCardKey(slash)
  assert(slashParsed?.kind === "matchup", "encoded slash and percent parse")
  if (slashParsed?.kind === "matchup") {
    assertEqual(slashParsed.leagueId, "a/b", "league id keeps a slash")
    assertEqual(slashParsed.teamId, "100%", "team id keeps a percent sign")
    assertEqual(slashParsed.period, 38, "period 38 parses")
  }

  const scout = cardKey({ kind: "scout", leagueId: "L", teamId: "T", playerId: "p id" })
  const scoutParsed = parseCardKey(scout)
  assert(scoutParsed?.kind === "scout" && scoutParsed.playerId === "p id", "scout player id round trips")

  assertEqual(parseCardKey("nope"), null, "bad key parses null")
  assertEqual(parseCardKey("m~~team~1"), null, "empty league id does not parse")
  assertEqual(parseCardKey("m~league~~1"), null, "empty team id does not parse")
  assertEqual(parseCardKey("m~%20~team~1"), null, "blank league id does not parse")
  assertEqual(parseCardKey("p~league~team~"), null, "empty player id does not parse")
  assertEqual(parseCardKey("m~league~team~0"), null, "period 0 does not parse")
  assertEqual(parseCardKey("m~league~team~39"), null, "period 39 does not parse")
  assertEqual(parseCardKey("m~league~team~01"), null, "padded period does not parse")
  assertEqual(parseCardKey("m~league~team~1.5"), null, "fractional period does not parse")
  assertEqual(parseCardKey("m~league~team~1~extra"), null, "extra segment does not parse")
  assertEqual(parseCardKey("%"), null, "broken escape parses null")
  const truncated = parseCardKey("m~%E0%A4%A~team~1")
  assert(truncated === null || truncated.kind === "matchup", "truncated percent-encoding does not throw")

  let calls = 0
  const bad = await readScorebug("nope", async () => {
    calls += 1
    return null
  })
  assertEqual(calls, 0, "bad key does not call the loader")
  assertEqual(bad.bug.badge, "Unavailable", "bad key badge is Unavailable")
  assertEqual(bad.bug.foot, "Score's not up.", "bad key foot is Score's not up.")
  assert(bad.board.kind === "absent", "bad key board is absent")

  const thrown = await readScorebug(cardKey(matchup), async () => {
    calls += 1
    throw new Error("fantrax down")
  })
  assertEqual(calls, 1, "loader throw still calls the loader")
  assertEqual(thrown.bug.badge, "Unavailable", "loader throw badge is Unavailable")
  assertEqual(thrown.bug.foot, "Score's not up.", "loader throw foot is Score's not up.")

  const missing = await readScorebug(cardKey(matchup), async () => null)
  assertEqual(missing.bug.badge, "Unavailable", "loader null badge is Unavailable")
  assertEqual(missing.bug.foot, "Score's not up.", "loader null foot is Score's not up.")

  const unknown = await read(
    matchup,
    {
      kind: "matchup",
      facts: baseMatchup({
        teamKnown: false,
        teamName: "",
        matchup: {
          home: "Not Your Squad",
          away: "Someone Else",
          homeShort: "NYS",
          awayShort: "SE",
          homeScore: "99",
          awayScore: "88",
          homeProjected: "70",
          awayProjected: "60",
        },
        lines: [{ position: "G", home: "Keeper", away: "Rival", homePoints: 9, awayPoints: 8 }],
      }),
    },
  )
  assert(unknown.board.kind === "absent" && unknown.board.sentence === "Unknown squad", "unknown team sentence is Unknown squad")
  const unknownText = JSON.stringify(unknown)
  assert(!unknownText.includes("99"), "unknown team does not paint someone else's score")
  assert(!unknownText.includes("Not Your Squad"), "unknown team does not paint someone else's name")
  assert(!unknownText.includes("Keeper"), "unknown team does not paint someone else's lineup")

  const bye = await read(
    matchup,
    {
      kind: "matchup",
      facts: baseMatchup({
        slate: liveSlate(),
        matchup: null,
      }),
    },
  )
  assert(bye.board.kind === "matchup", "known team with no matchup stays a matchup board")
  assertEqual(bye.bug.homeFigure, "—", "missing matchup home figure is an em dash")
  assertEqual(bye.bug.awayFigure, "—", "missing matchup away figure is an em dash")
  assertEqual(bye.bug.foot, "No matchup this week.", "missing matchup foot")
  assertEqual(bye.bug.homeName, "Saints", "missing matchup still names the squad")

  const live = await read(
    matchup,
    {
      kind: "matchup",
      facts: baseMatchup({
        slate: liveSlate(),
        matchup: {
          home: "Saints Intelligence",
          away: "Last Family",
          homeShort: "SIA",
          awayShort: "NSSA",
          homeScore: null,
          awayScore: "56.3",
          homeProjected: "70",
          awayProjected: "64",
        },
        lines: [{ position: "G", home: "Kelleher", away: "Alisson", homePoints: 4.5, awayPoints: null }],
      }),
    },
  )
  assertEqual(live.bug.badge, "Live", "current live week badge is Live")
  assertEqual(live.bug.accent, "#3dcf7a", "live accent")
  assertEqual(live.bug.homeFigure, "0", "missing actual prints 0")
  assertEqual(live.bug.awayFigure, "56.3", "posted actual is kept")
  assertEqual(live.bug.foot, "proj 70 – 64", "live week foot is the proj line")
  assertEqual(live.bug.homeName, "Saints Intelligence", "matchup home name")
  assert(live.board.kind === "matchup" && live.board.lines[0]?.homeFigure === "4.5", "line points print on the board")
  assert(live.board.kind === "matchup" && live.board.lines[0]?.awayFigure === "—", "missing line points are an em dash")

  const past = await read(
    matchupSource(7),
    {
      kind: "matchup",
      facts: baseMatchup({
        period: 7,
        periodLabel: "GW7",
        viewedPeriod: 7,
        currentPeriod: 8,
        slate: liveSlate(),
        matchup: {
          home: "Saints",
          away: "Last Family",
          homeShort: null,
          awayShort: null,
          homeScore: "40",
          awayScore: "30",
          homeProjected: "70",
          awayProjected: "64",
        },
      }),
    },
  )
  assertEqual(past.bug.badge, "Final", "a past live slate shows Final")
  assertEqual(past.bug.accent, "#a1a1aa", "final accent")
  assert(!past.bug.foot.startsWith("proj"), "proj foot is absent when the proj line is hidden")

  const projected = await read(
    matchup,
    {
      kind: "matchup",
      facts: baseMatchup({
        matchup: {
          home: "Saints",
          away: "Last Family",
          homeShort: null,
          awayShort: null,
          homeScore: null,
          awayScore: null,
          homeProjected: null,
          awayProjected: null,
        },
      }),
    },
  )
  assertEqual(projected.bug.badge, "Projected", "pre-match badge is Projected")
  assertEqual(projected.bug.accent, "#d4b56a", "projected accent")
  assertEqual(projected.bug.homeFigure, "—", "missing projection prints an em dash")
  assertEqual(projected.bug.awayFigure, "—", "missing away projection prints an em dash")
  assert(!projected.bug.foot.startsWith("proj"), "pre-match foot is not a proj line")

  const offWire = await read(scoutSource(), {
    kind: "scout",
    facts: {
      onWire: false,
      name: "Erling Haaland",
      detail: "MCI",
      heat: null,
      adjusted: null,
      beatsName: null,
      beatsHeat: null,
      beatsScore: null,
      whyNow: null,
      minutes: null,
      confidence: null,
      killLine: null,
    },
  })
  assertEqual(offWire.bug.badge, "Off the wire", "player off the wire badge")
  assertEqual(offWire.bug.accent, "#a1a1aa", "off-wire accent is absent")
  assertEqual(offWire.bug.homeName, "Erling Haaland", "off-wire bug keeps the name")
  assert(offWire.board.kind === "scout" && offWire.board.onWire === false, "off-wire board stays a scout board")

  const heats: HeatBucket[] = ["cold", "warm", "hot", "fire", "burning"]
  for (const heat of heats) {
    const scoutBug = await read(scoutSource(), {
      kind: "scout",
      facts: {
        onWire: true,
        name: "João Pedro",
        detail: "Brighton",
        heat,
        adjusted: 42.5,
        beatsName: "Matheus Cunha",
        beatsHeat: "cold",
        beatsScore: 18.2,
        whyNow: "Hot form",
        minutes: "78′ played",
        confidence: "high",
        killLine: "Loses starting spot",
      } satisfies ScoutFacts,
    })
    assertEqual(scoutBug.bug.badge, heatLabel(heat), `${heat} badge uses heatLabel`)
    assertEqual(scoutBug.bug.accent, HEAT_HEX[heat], `${heat} accent matches heatColor`)
    assertEqual(scoutBug.bug.homeName, "João Pedro", `${heat} card names the player`)
    assertEqual(scoutBug.bug.homeDetail, "Brighton", `${heat} card names the club`)
    assertEqual(scoutBug.bug.homeFigure, "42.5", `${heat} card prints the adjusted form`)
    assertEqual(scoutBug.bug.awayName, "Matheus Cunha", `${heat} card names who they beat`)
  }

  const shareKey = cardKey(matchup)
  let copied = false
  const cancelled = await presentShare(shareKey, {
    origin: "https://otm.test",
    share: async () => {
      throw Object.assign(new Error("dismissed"), { name: "AbortError" })
    },
    copy: async () => {
      copied = true
    },
  })
  assertEqual(cancelled, "cancelled", "AbortError returns cancelled")
  assert(!copied, "AbortError does not copy")

  copied = false
  const failed = await presentShare(shareKey, {
    origin: "https://otm.test",
    share: async () => {
      throw new Error("blocked")
    },
    copy: async () => {
      copied = true
    },
  })
  assertEqual(failed, "failed", "share rejection returns failed")
  assert(!copied, "share rejection does not copy")

  let sharedUrl = ""
  const shared = await presentShare(shareKey, {
    origin: "https://otm.test",
    share: async (data) => {
      sharedUrl = data.url
      assertEqual(data.title, "Over the Moon", "share sheet title")
      assertEqual(data.text, "League matchup", "matchup share sheet text")
    },
    copy: async () => {
      throw new Error("copy should not run")
    },
  })
  assertEqual(shared, "shared", "navigator.share returns shared")
  assertEqual(sharedUrl, `https://otm.test${cardPath(shareKey)}`, "share sheet uses the absolute card url")

  const scoutKey = cardKey(scoutSource())
  let copiedUrl = ""
  const copiedReceipt = await presentShare(scoutKey, {
    origin: "https://otm.test",
    copy: async (url) => {
      copiedUrl = url
    },
  })
  assertEqual(copiedReceipt, "copied", "copy runs when share is absent")
  assertEqual(copiedUrl, `https://otm.test${cardPath(scoutKey)}`, "copy writes the absolute card url")

  const scoutSheet = await presentShare(scoutKey, {
    origin: "https://otm.test",
    share: async (data) => {
      assertEqual(data.text, "Scout recommendation", "scout share sheet text")
    },
  })
  assertEqual(scoutSheet, "shared", "scout share sheet completes")

  const copyFailed = await presentShare(shareKey, {
    origin: "https://otm.test",
    copy: async () => {
      throw new Error("denied")
    },
  })
  assertEqual(copyFailed, "failed", "failed copy returns failed")

  await assertPng(bad.bug, "bad key")
  await assertPng(unknown.bug, "unknown team")
  await assertPng(offWire.bug, "player off the wire")
  await assertPng(thrown.bug, "loader throw")
  await assertPng(live.bug, "live matchup")
}

async function assertPng(bug: Scorebug, label: string): Promise<void> {
  const image = await paintScorebug(bug)
  const type = image.headers.get("content-type") ?? ""
  assert(type.includes("image/png"), `${label} content-type includes image/png`)
  const bytes = new Uint8Array(await image.arrayBuffer())
  assert(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47, `${label} paints a png`)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
