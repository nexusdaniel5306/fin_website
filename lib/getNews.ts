import axios from "axios"
import { getHeadlineSentiment, type NewsSentiment } from "@/lib/sentiment"

export interface NewsItem {
  title: string
  description: string
  date: string
  link: string
  sentiment: NewsSentiment | null
}

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

export const getNews = async (): Promise<NewsItem[]> => {
  const response = await axios.get<RssFeedResponse>(
    "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fsearch.cnbc.com%2Frs%2Fsearch%2Fcombinedcms%2Fview.xml%3FpartnerId%3Dwrss01%26id%3D100727362",
  )

  const latestItems = response.data.items
    .map((item) => ({
      title: item.title,
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
