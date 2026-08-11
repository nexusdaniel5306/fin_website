import {
  calculateEpollSummary,
  isWithinEpollWindow,
  type EpollSummary,
} from "@/lib/epoll"
import { getStoredEpollSummary, recordEpollArticles } from "@/lib/epoll-store"
import {
  fetchNewsFeed,
  type FeedNewsItem,
} from "@/lib/news-feed"
import {
  getAcceptedFeedItems,
  selectAnalysisCandidates,
  selectVisibleFeedItems,
  type AnalyzedFeedItem,
} from "@/lib/news-selection"
import { getHeadlineSentiment } from "@/lib/sentiment"
import { recordSentimentHistoryArticles } from "@/lib/sentiment-history-store"
import {
  createSentimentGenerationBudget,
  type SentimentCollectionMode,
} from "@/lib/sentiment-policy"
import type { NewsItem } from "@/lib/types"

export interface SentimentCollectionResult {
  items: NewsItem[]
  epoll: EpollSummary | null
  fetched: number
  analyzed: number
  generated: number
  recorded: number
  skipped: number
}

const analyzeFeedItems = async (
  feedItems: FeedNewsItem[],
  mode: SentimentCollectionMode,
  generationBudget?: ReturnType<typeof createSentimentGenerationBudget>,
): Promise<AnalyzedFeedItem[]> => {
  const analyzeFeedItem = async (feedItem: FeedNewsItem): Promise<AnalyzedFeedItem> => ({
    feedItem,
    sentiment: await getHeadlineSentiment(feedItem.title, feedItem.description, {
      mode,
      generationBudget,
    }),
  })

  if (mode === "cache-only") {
    return Promise.all(feedItems.map(analyzeFeedItem))
  }

  const analyzedItems: AnalyzedFeedItem[] = []

  for (const feedItem of feedItems) {
    analyzedItems.push(await analyzeFeedItem(feedItem))
  }

  return analyzedItems
}

const toNewsItem = ({ feedItem, sentiment }: AnalyzedFeedItem): NewsItem => {
  const { feed, guid, ...newsItem } = feedItem

  return {
    ...newsItem,
    sentiment,
  }
}

const sortNewsItems = (items: NewsItem[]) =>
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

export const collectSentimentFeed = async ({
  now = new Date(),
  requirePersistence = false,
  mode = "cache-only",
}: {
  now?: Date
  requirePersistence?: boolean
  mode?: SentimentCollectionMode
} = {}): Promise<SentimentCollectionResult> => {
  const feedItems = await fetchNewsFeed()
  const generationBudget =
    mode === "scheduled" ? createSentimentGenerationBudget() : undefined
  const analyzedItems = await analyzeFeedItems(
    selectAnalysisCandidates(feedItems, now),
    mode,
    generationBudget,
  )

  const acceptedAnalyzedItems = getAcceptedFeedItems(analyzedItems)
  const displayAnalyzedItems = selectVisibleFeedItems(analyzedItems)
  const displayItems = sortNewsItems(displayAnalyzedItems.map(toNewsItem))
  const acceptedItems = acceptedAnalyzedItems.map(toNewsItem)
  const epollItems = acceptedItems.filter((item) => isWithinEpollWindow(item.date, now))
  const [epollPersisted, historyResult] = await Promise.all([
    recordEpollArticles(epollItems, now),
    recordSentimentHistoryArticles(acceptedItems, now),
  ])

  if (requirePersistence && (!epollPersisted || !historyResult.available)) {
    throw new Error("Sentiment persistence is unavailable")
  }

  const storedEpoll = await getStoredEpollSummary(now)
  const analyzed = analyzedItems.filter((item) => item.sentiment !== null).length

  return {
    items: displayItems,
    epoll: storedEpoll ?? calculateEpollSummary(epollItems, now),
    fetched: feedItems.length,
    analyzed,
    generated: generationBudget?.completed ?? 0,
    recorded: historyResult.recorded,
    skipped: feedItems.length - analyzed,
  }
}
