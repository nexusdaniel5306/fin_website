import type { EpollSummary } from "./epoll"
import {
  buildSentimentHistorySnapshot,
  getMarketDateKeys,
  SENTIMENT_HISTORY_SCHEMA_VERSION,
  type SentimentHistorySnapshot,
} from "./sentiment-history"

interface FixtureEnvironment {
  fixtureFlag?: string
  vercelEnvironment?: string
}

export const shouldUseSentimentHistoryFixtures = ({
  fixtureFlag,
  vercelEnvironment,
}: FixtureEnvironment): boolean =>
  (fixtureFlag === "1" || fixtureFlag === "true") &&
  vercelEnvironment !== "production"

export const isSentimentHistoryFixtureMode = (): boolean =>
  shouldUseSentimentHistoryFixtures({
    fixtureFlag: process.env.SENTIMENT_HISTORY_FIXTURES,
    vercelEnvironment: process.env.VERCEL_ENV,
  })

const fixtureRecords = (index: number): string[] => {
  const patterns = [
    ["u|88", "u|71", "d|42"],
    ["d|91", "d|67", "u|39"],
    ["u|64", "d|64"],
    ["u|82", "u|76", "u|58", "d|44"],
    ["d|79", "d|62", "u|55", "u|31"],
  ]

  return patterns[index % patterns.length]
}

export const createSentimentHistoryFixtureSnapshot = (
  now: Date = new Date(),
): SentimentHistorySnapshot => {
  const dateKeys = getMarketDateKeys(now)
  const recordsByDate = new Map<string, string[]>()

  dateKeys.forEach((dateKey, index) => {
    if (index !== 0 && index !== dateKeys.length - 1 && index % 9 === 4) {
      return
    }

    recordsByDate.set(dateKey, fixtureRecords(index))
  })

  return buildSentimentHistorySnapshot({
    available: true,
    recordsByDate,
    meta: {
      startedAt: `${dateKeys[0]}T16:00:00.000Z`,
      lastSuccessfulCollectionAt: now.toISOString(),
      schemaVersion: SENTIMENT_HISTORY_SCHEMA_VERSION,
    },
    now,
  })
}

export const SENTIMENT_HISTORY_FIXTURE_EPOLL: EpollSummary = {
  direction: "up",
  strength: 64,
  articleCount: 18,
}
