import { collectSentimentFeed } from "@/lib/sentiment-collector"
import type { NewsItem } from "@/lib/types"
import type { EpollSummary } from "@/lib/epoll"

export type { NewsItem } from "@/lib/types"

export const revalidate = 300 // revalidate every 5 minutes
const NEWS_LIST_LIMIT = 5

export interface NewsSnapshot {
  items: NewsItem[]
  epoll: EpollSummary | null
}

export const getNewsSnapshot = async (): Promise<NewsSnapshot> => {
  const { items, epoll } = await collectSentimentFeed()

  return {
    items: items.slice(0, NEWS_LIST_LIMIT),
    epoll,
  }
}

export const getNews = async (): Promise<NewsItem[]> => (await getNewsSnapshot()).items
