import axios from "axios"
import { getHeadlineSentiment } from "@/lib/sentiment"
import type { NewsItem } from "@/lib/types"

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

const normalizeFeedTitle = (title: string) =>
  title
    .replaceAll("&amp;", "&")
    .replace(/\bS&P\b(?!\s*500)/g, "S&P 500")

export const getNews = async (): Promise<NewsItem[]> => {
  const response = await axios.get<RssFeedResponse>(
    "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fsearch.cnbc.com%2Frs%2Fsearch%2Fcombinedcms%2Fview.xml%3FpartnerId%3Dwrss01%26id%3D100727362",
  )

  const latestItems = response.data.items
    .map((item) => ({
      title: normalizeFeedTitle(item.title),
      description: item.description,
      date: item.pubDate,
      link: item.link,
      sentiment: null,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  return Promise.all(
    latestItems.map(async (item) => ({
      ...item,
      sentiment: await getHeadlineSentiment(item.title),
    })),
  )
}
