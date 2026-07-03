import test from "node:test"
import assert from "node:assert/strict"

import {
  buildSentimentHistorySnapshot,
  calculateDailySentiment,
  getMarketDateKey,
  getMarketDateKeys,
  parseHistorySentiment,
  serializeHistorySentiment,
  shiftDateKey,
} from "../lib/sentiment-history"
import {
  createSentimentHistoryFixtureSnapshot,
  shouldUseSentimentHistoryFixtures,
} from "../lib/sentiment-history-fixtures"

test("assigns UTC timestamps to Eastern dates across DST boundaries", () => {
  assert.equal(getMarketDateKey(new Date("2026-03-08T04:59:59Z")), "2026-03-07")
  assert.equal(getMarketDateKey(new Date("2026-03-08T05:00:00Z")), "2026-03-08")
  assert.equal(getMarketDateKey(new Date("2026-03-09T03:59:59Z")), "2026-03-08")
  assert.equal(getMarketDateKey(new Date("2026-03-09T04:00:00Z")), "2026-03-09")
})

test("generates consecutive market calendar dates", () => {
  assert.deepEqual(
    getMarketDateKeys(new Date("2026-06-27T20:00:00Z"), 3),
    ["2026-06-25", "2026-06-26", "2026-06-27"],
  )
  assert.equal(shiftDateKey("2026-03-01", -1), "2026-02-28")
})

test("serializes, parses, and rejects malformed stored sentiment", () => {
  assert.equal(serializeHistorySentiment({ direction: "up", confidence: 88 }), "u|88")
  assert.deepEqual(parseHistorySentiment("d|72"), {
    direction: "down",
    confidence: 72,
  })
  assert.equal(parseHistorySentiment("sideways|80"), null)
  assert.equal(parseHistorySentiment("u|101"), null)
})

test("calculates confidence-weighted daily sentiment", () => {
  const summary = calculateDailySentiment(
    "2026-06-27",
    ["u|80", "d|20", "broken"],
    "2026-06-27",
    "2026-06-27T14:00:00.000Z",
  )

  assert.deepEqual(summary, {
    date: "2026-06-27",
    status: "live",
    direction: "up",
    netScore: 60,
    strength: 80,
    articleCount: 2,
    upArticleCount: 1,
    downArticleCount: 1,
    averageConfidence: 50,
  })
})

test("treats zero-confidence ties as mixed without dividing by zero", () => {
  const summary = calculateDailySentiment(
    "2026-06-26",
    ["u|0", "d|0"],
    "2026-06-27",
    "2026-06-25T14:00:00.000Z",
  )

  assert.equal(summary.direction, "mixed")
  assert.equal(summary.netScore, 0)
  assert.equal(summary.strength, 50)
  assert.equal(summary.averageConfidence, 0)
  assert.equal(summary.status, "complete")
})

test("distinguishes partial, complete, live, and missing dates", () => {
  const startedAt = "2026-06-25T18:00:00.000Z"

  assert.equal(
    calculateDailySentiment("2026-06-25", ["u|60"], "2026-06-27", startedAt).status,
    "partial",
  )
  assert.equal(
    calculateDailySentiment("2026-06-26", ["u|60"], "2026-06-27", startedAt).status,
    "complete",
  )
  assert.equal(
    calculateDailySentiment("2026-06-27", ["u|60"], "2026-06-27", startedAt).status,
    "live",
  )
  assert.equal(
    calculateDailySentiment("2026-06-24", [], "2026-06-27", startedAt).status,
    "no-data",
  )
})

test("builds a fixed 30-day snapshot and flags stale collection", () => {
  const now = new Date("2026-06-27T20:00:00.000Z")
  const snapshot = buildSentimentHistorySnapshot({
    available: true,
    recordsByDate: new Map([["2026-06-27", ["d|75"]]]),
    meta: {
      startedAt: "2026-06-27T18:00:00.000Z",
      lastSuccessfulCollectionAt: "2026-06-27T18:00:00.000Z",
      schemaVersion: "1",
    },
    now,
  })

  assert.equal(snapshot.days.length, 30)
  assert.equal(snapshot.days[0].date, "2026-05-29")
  assert.equal(snapshot.days.at(-1)?.direction, "down")
  assert.equal(snapshot.collectionDelayed, true)
})

test("fixture mode requires an explicit flag and is disabled in production", () => {
  assert.equal(
    shouldUseSentimentHistoryFixtures({ fixtureFlag: "1" }),
    true,
  )
  assert.equal(
    shouldUseSentimentHistoryFixtures({
      fixtureFlag: "true",
      vercelEnvironment: "preview",
    }),
    true,
  )
  assert.equal(
    shouldUseSentimentHistoryFixtures({
      fixtureFlag: "1",
      vercelEnvironment: "production",
    }),
    false,
  )
  assert.equal(shouldUseSentimentHistoryFixtures({}), false)
})

test("creates a deterministic 30-day fixture with realistic display states", () => {
  const snapshot = createSentimentHistoryFixtureSnapshot(
    new Date("2026-07-03T18:00:00.000Z"),
  )
  const populatedDays = snapshot.days.filter((day) => day.articleCount > 0)

  assert.equal(snapshot.days.length, 30)
  assert.equal(snapshot.days[0].status, "partial")
  assert.equal(snapshot.days.at(-1)?.status, "live")
  assert.equal(snapshot.collectionDelayed, false)
  assert.ok(snapshot.days.some((day) => day.status === "no-data"))
  assert.ok(populatedDays.some((day) => day.direction === "up"))
  assert.ok(populatedDays.some((day) => day.direction === "down"))
  assert.ok(populatedDays.some((day) => day.direction === "mixed"))
})
