import { EpollBadge } from "@/app/components/epoll-badge"
import { NewsList } from "@/app/components/news-list"
import { getNewsSnapshot } from "@/lib/getNews"

export const revalidate = 300 // revalidate every 5 minutes

export default async function Component() {
  const { items: newsItems, epoll } = await getNewsSnapshot()

  return (
    <div className="bg-background text-foreground">
      <header className="bg-primary text-primary-foreground px-6 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-4">
          <h1 className="text-xl font-bold leading-none md:text-2xl">MarketEpoll</h1>
          <div className="md:justify-self-center">
            <EpollBadge summary={epoll} />
          </div>
          <a
            href="https://itsdan.li"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold tracking-[0.2em] transition-opacity hover:opacity-70 md:justify-self-end"
          >
            itsDan.Li
          </a>
        </div>
      </header>
      <main className="py-8 px-6">
        <NewsList items={newsItems} />
      </main>
    </div>
  )
}
