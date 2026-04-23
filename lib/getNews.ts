import axios from "axios"
import { getStoredEpollSummary, recordEpollArticles } from "@/lib/epoll-store"
import { getHeadlineSentiment } from "@/lib/sentiment"
import type { NewsItem } from "@/lib/types"
import { calculateEpollSummary, isWithinEpollWindow, type EpollSummary } from "@/lib/epoll"

export type { NewsItem } from "@/lib/types"

interface RssItem {
  title: string
  description: string
  pubDate: string
  link: string
}

interface RssFeedResponse {
  items: RssItem[]
}

export const revalidate = 300 // revalidate every 5 minutes
const NEWS_LIST_LIMIT = 5

export interface NewsSnapshot {
  items: NewsItem[]
  epoll: EpollSummary | null
}

const normalizeFeedTitle = (title: string) =>
  title
    .replaceAll("&amp;", "&")
    .replace(/\bS&P\b(?!\s*500)/g, "S&P 500")

const attachSentiment = async (
  items: Omit<NewsItem, "sentiment">[],
): Promise<NewsItem[]> =>
  Promise.all(
    items.map(async (item) => ({
      ...item,
      sentiment: await getHeadlineSentiment(item.title),
    })),
  )

export const getNewsSnapshot = async (): Promise<NewsSnapshot> => {
  const response = await axios.get<RssFeedResponse>(
    "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fsearch.cnbc.com%2Frs%2Fsearch%2Fcombinedcms%2Fview.xml%3FpartnerId%3Dwrss01%26id%3D100727362",
  )

  const normalizedItems = response.data.items
    .map((item) => ({
      title: normalizeFeedTitle(item.title),
      description: item.description,
      date: item.pubDate,
      link: item.link,
      sentiment: null,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const now = new Date()
  const latestItems = normalizedItems.slice(0, NEWS_LIST_LIMIT)
  const epollItems = normalizedItems.filter((item) => isWithinEpollWindow(item.date, now))
  const itemsToAnalyze = Array.from(
    new Map([...latestItems, ...epollItems].map((item) => [item.link, item])).values(),
  )
  const analyzedItems = await attachSentiment(itemsToAnalyze)
  const analyzedByLink = new Map(analyzedItems.map((item) => [item.link, item]))
  const analyzedEpollItems = epollItems.map((item) => analyzedByLink.get(item.link) ?? item)

  await recordEpollArticles(analyzedEpollItems, now)
  const storedEpoll = await getStoredEpollSummary(now)

  return {
    items: latestItems.map((item) => analyzedByLink.get(item.link) ?? item),
    epoll: storedEpoll ?? calculateEpollSummary(analyzedEpollItems, now),
  }
}

export const getNews = async (): Promise<NewsItem[]> => (await getNewsSnapshot()).items
