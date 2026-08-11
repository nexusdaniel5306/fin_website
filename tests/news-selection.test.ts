import test from "node:test"
import assert from "node:assert/strict"

import {
  ANALYSIS_CANDIDATE_BUFFER_SIZE,
  getAcceptedFeedItems,
  isSafeUnclassifiedPrimaryItem,
  selectAnalysisCandidates,
  selectVisibleFeedItems,
  type AnalyzedFeedItem,
} from "../lib/news-selection"
import { isWithinEpollWindow } from "../lib/epoll"
import type { FeedNewsItem } from "../lib/news-feed"

const baseItem = () => ({
  title: "Stocks rise as earnings beat expectations",
  description: "A market-moving company report.",
  date: "2026-06-27T19:00:00.000Z",
  link: "https://www.cnbc.com/finance-story",
  guid: "finance-story",
  feed: "finance" as const,
})

const accepted = (): AnalyzedFeedItem & {
  sentiment: NonNullable<AnalyzedFeedItem["sentiment"]>
} => ({
  feedItem: baseItem(),
  sentiment: {
    contentType: "reporting",
    marketRelevant: true,
    direction: "up",
    confidence: 80,
    reason: "The report improves market expectations.",
    grainOfSalt: "The move may already be priced in.",
  },
})

const feedItem = (id: string, date: string): FeedNewsItem => ({
  title: `Market report ${id}`,
  description: "A market-moving report.",
  date,
  link: `https://www.cnbc.com/${id}`,
  guid: id,
  feed: "finance",
})

test("keeps every in-window item and excludes the old out-of-window tail", () => {
  const now = new Date("2026-06-27T20:00:00.000Z")
  const inWindow = [
    feedItem("recent-1", "2026-06-27T19:00:00.000Z"),
    feedItem("recent-2", "2026-06-27T16:00:00.000Z"),
    feedItem("recent-boundary", "2026-06-27T12:00:00.000Z"),
  ]
  const oldTail = Array.from({ length: 20 }, (_, index) =>
    feedItem(`old-${index}`, `2026-06-27T11:${String(59 - index).padStart(2, "0")}:00.000Z`),
  )

  const selected = selectAnalysisCandidates([...oldTail, ...inWindow], now)

  assert.equal(
    selected.filter(({ date }) => isWithinEpollWindow(date, now)).length,
    inWindow.length,
  )
  assert.ok(selected.some(({ guid }) => guid === "recent-boundary"))
  assert.equal(selected.some(({ guid }) => guid === "old-19"), false)
})

test("bounds the newest out-of-window analysis buffer at fifteen items", () => {
  const now = new Date("2026-06-27T20:00:00.000Z")
  const items = [
    feedItem("recent", "2026-06-27T19:00:00.000Z"),
    ...Array.from({ length: 20 }, (_, index) =>
      feedItem(`old-${index}`, `2026-06-27T11:${String(59 - index).padStart(2, "0")}:00.000Z`),
    ),
  ]

  const selected = selectAnalysisCandidates(items, now)
  const outOfWindow = selected.filter(({ date }) => !isWithinEpollWindow(date, now))

  assert.equal(ANALYSIS_CANDIDATE_BUFFER_SIZE, 15)
  assert.ok(outOfWindow.length <= ANALYSIS_CANDIDATE_BUFFER_SIZE)
  assert.ok(selected.length <= 1 + ANALYSIS_CANDIDATE_BUFFER_SIZE)
  assert.equal(selected.some(({ guid }) => guid === "old-19"), false)
})

test("keeps later eligible stories available after several newest candidates are rejected", () => {
  const now = new Date("2026-06-27T20:00:00.000Z")
  const sourceItems = Array.from({ length: 10 }, (_, index) =>
    feedItem(
      `candidate-${index}`,
      `2026-06-27T11:${String(59 - index).padStart(2, "0")}:00.000Z`,
    ),
  )
  const selected = selectAnalysisCandidates(sourceItems, now)
  const analyzed = selected.map((item, index) => ({
    feedItem: item,
    sentiment:
      index < 4
        ? { ...accepted().sentiment, contentType: "opinion" as const }
        : accepted().sentiment,
  }))

  const visible = selectVisibleFeedItems(analyzed)

  assert.equal(visible.length, 5)
  assert.equal(visible[0].feedItem.guid, "candidate-4")
})

test("counts only reporting, market-relevant analyses as accepted", () => {
  const rejected = accepted()
  rejected.sentiment = { ...rejected.sentiment, contentType: "opinion" }
  const notRelevant = accepted()
  notRelevant.sentiment = { ...notRelevant.sentiment, marketRelevant: false }

  assert.equal(getAcceptedFeedItems([accepted(), rejected, notRelevant]).length, 1)
})

test("uses only focused primary headlines for the no-analysis display fallback", () => {
  assert.equal(isSafeUnclassifiedPrimaryItem({ feedItem: baseItem(), sentiment: null }), true)
  assert.equal(
    isSafeUnclassifiedPrimaryItem({
      feedItem: { ...baseItem(), title: "Opinion: how to pick stocks" },
      sentiment: null,
    }),
    false,
  )
})

test("keeps accepted stories ahead of safe unclassified stories", () => {
  const primary = accepted()
  primary.feedItem.date = "2026-06-27T18:00:00.000Z"
  const unclassified = { feedItem: { ...baseItem(), guid: "unclassified" }, sentiment: null }

  const visible = selectVisibleFeedItems([
    primary,
    accepted(),
    accepted(),
    accepted(),
    unclassified,
  ])

  assert.equal(visible.length, 5)
  assert.equal(visible.at(-1)?.feedItem.guid, "unclassified")
})
