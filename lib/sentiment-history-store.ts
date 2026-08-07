import { createHash } from "node:crypto"

import {
  SENTIMENT_HISTORY_DAYS,
  SENTIMENT_HISTORY_SCHEMA_VERSION,
  buildSentimentHistorySnapshot,
  getMarketDateKey,
  getMarketDateKeys,
  serializeHistorySentiment,
  shiftDateKey,
  type SentimentHistoryMeta,
  type SentimentHistorySnapshot,
} from "@/lib/sentiment-history"
import { getRedisClient } from "@/lib/redis"
import type { NewsItem } from "@/lib/types"

const HISTORY_KEY_PREFIX = "marketepoll:history:day:"
const HISTORY_META_KEY = "marketepoll:history:meta"
const HISTORY_TTL_SECONDS = 60 * 60 * 24 * 35

const getHistoryDateKey = (dateKey: string) => `${HISTORY_KEY_PREFIX}${dateKey}`

const getArticleId = ({
  title,
  link,
  date,
}: Pick<NewsItem, "title" | "link" | "date">) =>
  createHash("sha256")
    .update(`${title.trim().toLowerCase()}|${link.trim()}|${date.trim()}`)
    .digest("hex")

const parseMeta = (rawMeta: Record<string, string>): SentimentHistoryMeta => ({
  startedAt: rawMeta.startedAt || null,
  lastSuccessfulCollectionAt: rawMeta.lastSuccessfulCollectionAt || null,
  schemaVersion: rawMeta.schemaVersion || null,
})

export interface HistoryRecordResult {
  available: boolean
  recorded: number
}

export const recordSentimentHistoryArticles = async (
  items: NewsItem[],
  now: Date = new Date(),
): Promise<HistoryRecordResult> => {
  const redis = await getRedisClient()

  if (!redis) {
    return { available: false, recorded: 0 }
  }

  const eligibleItems = items.flatMap((item) => {
    if (!item.sentiment) {
      return []
    }

    const publishedAt = new Date(item.date)

    if (Number.isNaN(publishedAt.getTime())) {
      return []
    }

    return [
      {
        dateKey: getMarketDateKey(publishedAt),
        id: getArticleId(item),
        value: serializeHistorySentiment(item.sentiment),
      },
    ]
  })
  const touchedDateKeys = new Set(eligibleItems.map((item) => item.dateKey))
  const currentDateKey = getMarketDateKey(now)
  const expiredDateKey = shiftDateKey(currentDateKey, -SENTIMENT_HISTORY_DAYS)
  const multi = redis.multi()

  multi.hSetNX(HISTORY_META_KEY, "startedAt", now.toISOString())
  multi.hSet(HISTORY_META_KEY, {
    lastSuccessfulCollectionAt: now.toISOString(),
    schemaVersion: SENTIMENT_HISTORY_SCHEMA_VERSION,
  })

  for (const item of eligibleItems) {
    multi.hSetNX(getHistoryDateKey(item.dateKey), item.id, item.value)
  }

  for (const dateKey of touchedDateKeys) {
    multi.expire(getHistoryDateKey(dateKey), HISTORY_TTL_SECONDS)
  }

  multi.del(getHistoryDateKey(expiredDateKey))

  try {
    const results = await multi.exec()
    const recordResults = results.slice(2, 2 + eligibleItems.length) as unknown[]
    const recorded = recordResults.filter(
      (result) => result === 1 || result === true,
    ).length

    return { available: true, recorded }
  } catch {
    return { available: false, recorded: 0 }
  }
}

export const getSentimentHistorySnapshot = async (
  now: Date = new Date(),
): Promise<SentimentHistorySnapshot> => {
  const dateKeys = getMarketDateKeys(now)
  const emptyMeta: SentimentHistoryMeta = {
    startedAt: null,
    lastSuccessfulCollectionAt: null,
    schemaVersion: null,
  }
  const redis = await getRedisClient()

  if (!redis) {
    return buildSentimentHistorySnapshot({
      available: false,
      recordsByDate: new Map(),
      meta: emptyMeta,
      now,
    })
  }

  try {
    const multi = redis.multi()

    for (const dateKey of dateKeys) {
      multi.hVals(getHistoryDateKey(dateKey))
    }

    const [rawMeta, rawRecords] = await Promise.all([
      redis.hGetAll(HISTORY_META_KEY),
      multi.exec(),
    ])
    const recordsByDate = new Map<string, string[]>()

    dateKeys.forEach((dateKey, index) => {
      const values = rawRecords[index]
      recordsByDate.set(dateKey, Array.isArray(values) ? values.map(String) : [])
    })

    return buildSentimentHistorySnapshot({
      available: true,
      recordsByDate,
      meta: parseMeta(rawMeta),
      now,
    })
  } catch {
    return buildSentimentHistorySnapshot({
      available: false,
      recordsByDate: new Map(),
      meta: emptyMeta,
      now,
    })
  }
}
