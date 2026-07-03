import axios from "axios"

import type { NewsItem } from "@/lib/types"

interface RssItem {
  title: string
  description: string
  pubDate: string
  link: string
}

interface RssFeedResponse {
  items?: RssItem[]
}

export type FeedNewsItem = Omit<NewsItem, "sentiment">

const CNBC_FEED_URL =
  "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fsearch.cnbc.com%2Frs%2Fsearch%2Fcombinedcms%2Fview.xml%3FpartnerId%3Dwrss01%26id%3D100727362"

const RSS2JSON_DATE_PATTERN = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/

export const parseRssPublishedAt = (value: string): string | null => {
  const cleanValue = value.trim()
  const rss2jsonMatch = RSS2JSON_DATE_PATTERN.exec(cleanValue)
  const timestamp = rss2jsonMatch
    ? `${rss2jsonMatch[1]}T${rss2jsonMatch[2]}Z`
    : cleanValue
  const parsed = new Date(timestamp)

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export const normalizeFeedTitle = (title: string) =>
  title
    .replace(/&amp;/g, "&")
    .replace(/\bS&P\b(?!\s*500)/g, "S&P 500")

export const fetchNewsFeed = async (): Promise<FeedNewsItem[]> => {
  const response = await axios.get<RssFeedResponse>(CNBC_FEED_URL)

  return (response.data.items ?? [])
    .map((item): FeedNewsItem | null => {
      const publishedAt = parseRssPublishedAt(item.pubDate)

      if (!publishedAt) {
        return null
      }

      return {
        title: normalizeFeedTitle(item.title),
        description: item.description,
        date: publishedAt,
        link: item.link,
      }
    })
    .filter((item): item is FeedNewsItem => item !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
