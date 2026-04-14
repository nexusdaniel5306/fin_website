import { getNews } from "@/lib/getNews"
import { ArrowUpIcon, ArrowDownIcon } from "./icons"

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
          className="text-sm font-bold uppercase tracking-[0.2em] transition-opacity hover:opacity-70"
        >
          itsdan.li
        </a>
      </header>
      <main className="py-8 px-6">
        <div className="grid gap-6">
          {newsItems.map((item, index) => (
            <div
              key={index}
              className="bg-card rounded-lg p-4 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <p className="text-muted-foreground mt-2">{item.description}</p>
                <p className="text-sm text-muted-foreground mt-2">{new Date(item.date).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-col gap-4 sm:items-end">
                {item.sentiment?.direction === "up" ? (
                  <div className="flex items-center text-green-500">
                    <ArrowUpIcon className="h-5 w-5 mr-1" />
                    <span>{item.sentiment.confidence}%</span>
                  </div>
                ) : item.sentiment?.direction === "down" ? (
                  <div className="flex items-center text-red-500">
                    <ArrowDownIcon className="h-5 w-5 mr-1" />
                    <span>{item.sentiment.confidence}%</span>
                  </div>
                ) : null}
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Read More
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
