import { getNews, NewsItem } from "@/lib/getNews"
import { ArrowUpIcon, ArrowDownIcon } from "./icons"

export const revalidate = 300 // revalidate every 5 minutes

export default async function Component() {
  const newsItems = await getNews()

  return (
    <div className="bg-background text-foreground">
      <header className="bg-primary text-primary-foreground py-4 px-6">
        <h1 className="text-2xl font-bold">MarketEpoll</h1>
      </header>
      <main className="py-8 px-6">
        <div className="grid gap-6">
          {newsItems.map((item, index) => (
            <div key={index} className="bg-card p-4 rounded-lg shadow-sm flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <p className="text-muted-foreground mt-2">{item.description}</p>
                <p className="text-sm text-muted-foreground mt-2">{new Date(item.date).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-col items-end justify-between h-full ml-4">
                {item.sentiment > 0.5 ? (
                  <div className="text-green-500 flex items-center">
                    <ArrowUpIcon className="h-5 w-5 mr-1" />
                    <span>{(item.sentiment * 100).toFixed(0)}%</span>
                  </div>
                ) : (
                  <div className="text-red-500 flex items-center">
                    <ArrowDownIcon className="h-5 w-5 mr-1" />
                    <span>{(item.sentiment * 100).toFixed(0)}%</span>
                  </div>
                )}
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline mt-4">
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