import test from "node:test"
import assert from "node:assert/strict"

import {
  calculateEpollSummary,
  calculateEpollSummaryFromStoredMembers,
  parseEpollStoredMember,
  serializeEpollStoredMember,
} from "../lib/epoll"

test("calculates an up epoll from confidence-weighted recent articles", () => {
  const summary = calculateEpollSummary(
    [
      {
        date: "2026-04-23T14:00:00.000Z",
        sentiment: { direction: "up", confidence: 88 },
      },
      {
        date: "2026-04-23T13:30:00.000Z",
        sentiment: { direction: "up", confidence: 70 },
      },
      {
        date: "2026-04-23T12:45:00.000Z",
        sentiment: { direction: "down", confidence: 55 },
      },
    ],
    new Date("2026-04-23T16:00:00.000Z"),
  )

  assert.deepEqual(summary, {
    direction: "up",
    strength: 74,
    articleCount: 3,
  })
})

test("returns mixed when the weighted totals are exactly even", () => {
  const summary = calculateEpollSummary(
    [
      {
        date: "2026-04-23T14:00:00.000Z",
        sentiment: { direction: "up", confidence: 80 },
      },
      {
        date: "2026-04-23T13:00:00.000Z",
        sentiment: { direction: "down", confidence: 80 },
      },
    ],
    new Date("2026-04-23T16:00:00.000Z"),
  )

  assert.deepEqual(summary, {
    direction: "mixed",
    strength: 50,
    articleCount: 2,
  })
})

test("ignores stories outside the 8 hour window and stories without sentiment", () => {
  const summary = calculateEpollSummary(
    [
      {
        date: "2026-04-23T14:00:00.000Z",
        sentiment: { direction: "down", confidence: 76 },
      },
      {
        date: "2026-04-23T07:30:00.000Z",
        sentiment: { direction: "up", confidence: 99 },
      },
      {
        date: "not-a-date",
        sentiment: { direction: "up", confidence: 99 },
      },
      {
        date: "2026-04-23T15:00:00.000Z",
        sentiment: null,
      },
    ],
    new Date("2026-04-23T16:00:00.000Z"),
  )

  assert.deepEqual(summary, {
    direction: "down",
    strength: 100,
    articleCount: 1,
  })
})

test("returns null when no eligible analyzed stories exist", () => {
  const summary = calculateEpollSummary(
    [
      {
        date: "2026-04-22T01:00:00.000Z",
        sentiment: { direction: "up", confidence: 90 },
      },
      {
        date: "2026-04-23T15:00:00.000Z",
        sentiment: null,
      },
    ],
    new Date("2026-04-23T16:00:00.000Z"),
  )

  assert.equal(summary, null)
})

test("serializes and parses stored epoll members for the rolling set", () => {
  const raw = serializeEpollStoredMember({
    id: "abc123",
    direction: "down",
    confidence: 81,
  })

  assert.equal(raw, "abc123|down|81")
  assert.deepEqual(parseEpollStoredMember(raw), {
    id: "abc123",
    direction: "down",
    confidence: 81,
  })
})

test("builds a summary and rolling article count from stored members", () => {
  const summary = calculateEpollSummaryFromStoredMembers([
    "a1|up|88",
    "a2|down|60",
    "a3|down|72",
  ])

  assert.deepEqual(summary, {
    direction: "down",
    strength: 60,
    articleCount: 3,
  })
})

test("ignores malformed rolling-set members when building the summary", () => {
  const summary = calculateEpollSummaryFromStoredMembers([
    "a1|up|88",
    "broken",
    "a3|down|not-a-number",
  ])

  assert.deepEqual(summary, {
    direction: "up",
    strength: 100,
    articleCount: 1,
  })
})
