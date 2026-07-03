import { calculateEpollSummary, isWithinEpollWindow, type EpollSummary } from "@/lib/epoll"
import { getStoredEpollSummary, recordEpollArticles } from "@/lib/epoll-store"
import { fetchNewsFeed } from "@/lib/news-feed"
import { getHeadlineSentiment } from "@/lib/sentiment"
import { recordSentimentHistoryArticles } from "@/lib/sentiment-history-store"
import type { NewsItem } from "@/lib/types"

export interface SentimentCollectionResult {
  items: NewsItem[]
  epoll: EpollSummary | null
  fetched: number
  analyzed: number
  recorded: number
  skipped: number
}

export const collectSentimentFeed = async ({
  now = new Date(),
  requirePersistence = false,
}: {
  now?: Date
  requirePersistence?: boolean
} = {}): Promise<SentimentCollectionResult> => {
  const feedItems = await fetchNewsFeed()
  const analyzedItems = await Promise.all(
    feedItems.map(async (item): Promise<NewsItem> => ({
      ...item,
      sentiment: await getHeadlineSentiment(item.title),
    })),
  )
  const epollItems = analyzedItems.filter((item) => isWithinEpollWindow(item.date, now))
  const [epollPersisted, historyResult] = await Promise.all([
    recordEpollArticles(epollItems, now),
    recordSentimentHistoryArticles(analyzedItems, now),
  ])

  if (requirePersistence && (!epollPersisted || !historyResult.available)) {
    throw new Error("Sentiment persistence is unavailable")
  }

  const storedEpoll = await getStoredEpollSummary(now)
  const analyzed = analyzedItems.filter((item) => item.sentiment !== null).length

  return {
    items: analyzedItems,
    epoll: storedEpoll ?? calculateEpollSummary(epollItems, now),
    fetched: feedItems.length,
    analyzed,
    recorded: historyResult.recorded,
    skipped: feedItems.length - analyzed,
  }
}
