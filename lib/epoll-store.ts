import { createHash } from "node:crypto"

import {
  EPOLL_WINDOW_MS,
  calculateEpollSummaryFromStoredMembers,
  isWithinEpollWindow,
  serializeEpollStoredMember,
  type EpollSentimentInput,
  type EpollSummary,
} from "@/lib/epoll"
import { getRedisClient } from "@/lib/redis"

const EPOLL_ROLLING_KEY = "marketepoll:epoll:rolling"
const EPOLL_STORE_TTL_SECONDS = 60 * 60 * 24

interface EpollArticleRecordInput {
  title: string
  link: string
  date: string
  sentiment: EpollSentimentInput | null
}

const getEpollArticleId = ({ title, link, date }: Pick<EpollArticleRecordInput, "title" | "link" | "date">) =>
  createHash("sha256")
    .update(`${title.trim().toLowerCase()}|${link.trim()}|${date.trim()}`)
    .digest("hex")

export const recordEpollArticles = async (
  items: EpollArticleRecordInput[],
  now: Date = new Date(),
) => {
  const redis = await getRedisClient()

  if (!redis) {
    return false
  }

  const nowMs = now.getTime()
  const cutoffMs = nowMs - EPOLL_WINDOW_MS
  const multi = redis.multi()

  multi.zRemRangeByScore(EPOLL_ROLLING_KEY, 0, cutoffMs - 1)

  for (const item of items) {
    if (!item.sentiment || !isWithinEpollWindow(item.date, now)) {
      continue
    }

    const publishedAt = new Date(item.date).getTime()

    if (Number.isNaN(publishedAt)) {
      continue
    }

    multi.zAdd(
      EPOLL_ROLLING_KEY,
      {
        score: publishedAt,
        value: serializeEpollStoredMember({
          id: getEpollArticleId(item),
          direction: item.sentiment.direction,
          confidence: item.sentiment.confidence,
        }),
      },
      {
        condition: "NX",
      },
    )
  }

  multi.expire(EPOLL_ROLLING_KEY, EPOLL_STORE_TTL_SECONDS)

  try {
    await multi.exec()
    return true
  } catch {
    return false
  }
}

export const getStoredEpollSummary = async (
  now: Date = new Date(),
): Promise<EpollSummary | null> => {
  const redis = await getRedisClient()

  if (!redis) {
    return null
  }

  const nowMs = now.getTime()
  const cutoffMs = nowMs - EPOLL_WINDOW_MS

  try {
    await redis.zRemRangeByScore(EPOLL_ROLLING_KEY, 0, cutoffMs - 1)
    const members = await redis.zRangeByScore(EPOLL_ROLLING_KEY, cutoffMs, nowMs)

    return calculateEpollSummaryFromStoredMembers(members)
  } catch {
    return null
  }
}
