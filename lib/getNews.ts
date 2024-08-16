import axios from "axios"
import { cache } from 'react'

export interface NewsItem {
  title: string;
  description: string;
  date: string;
  link: string;
  sentiment: number;
}

export const revalidate = 300 // revalidate every 5 minutes

export const getNews = cache(async (): Promise<NewsItem[]> => {
  const response = await axios.get('https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fsearch.cnbc.com%2Frs%2Fsearch%2Fcombinedcms%2Fview.xml%3FpartnerId%3Dwrss01%26id%3D100727362')
  const items = response.data.items
    .map((item: any) => ({
      title: item.title,
      description: item.description,
      date: item.pubDate,
      link: item.link,
      sentiment: Math.random() // Replace this with actual sentiment analysis
    }))
    .sort((a: NewsItem, b: NewsItem) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
  return items
})