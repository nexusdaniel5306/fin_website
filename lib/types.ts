import type { NewsSentiment } from "@/lib/sentiment"

export interface NewsItem {
  title: string
  description: string
  date: string
  link: string
  sentiment: NewsSentiment | null
}
