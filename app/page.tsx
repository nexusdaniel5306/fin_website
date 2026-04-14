import { getNews } from "@/lib/getNews"
import { NewsList } from "@/app/components/news-list"

export const revalidate = 300 // revalidate every 5 minutes

export default async function Component() {
  const newsItems = await getNews()

  return (
    <div className="bg-background text-foreground">
      <header className="bg-primary text-primary-foreground flex items-center justify-between gap-4 py-4 px-6">
        <h1 className="text-2xl font-bold">MarketEpoll</h1>
        <a
          href="https://itsdan.li"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-bold tracking-[0.2em] transition-opacity hover:opacity-70"
        >
          itsDan.Li
        </a>
      </header>
      <main className="py-8 px-6">
        <NewsList items={newsItems} />
      </main>
    </div>
  )
}
