import { NewsList } from "@/app/components/news-list"
import { SiteHeader } from "@/app/components/site-header"
import { getNewsSnapshot } from "@/lib/getNews"

export const revalidate = 300 // revalidate every 5 minutes

export default async function Component() {
  const { items: newsItems, epoll } = await getNewsSnapshot()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader summary={epoll} currentPage="home" />
      <main className="py-8 px-6">
        <NewsList items={newsItems} />
      </main>
    </div>
  )
}
