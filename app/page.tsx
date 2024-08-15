/**
 * v0 by Vercel.
 * @see https://v0.dev/t/OyscpUSNTzJ
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
"use client"

import { useState, useEffect } from "react"
import axios from "axios"

interface NewsItem {
  title: string;
  description: string;
  date: string;
  link: string;
  sentiment: number;
}

export default function Component() {
  const [newsItems, setNewsItems] = useState([])

  useEffect(() => {
    const fetchNews = async () => {
      try {
        //const response = await axios.get('https://api.rss2json.com/v1/api.json?rss_url=http://feeds.bbci.co.uk/news/business/rss.xml')
        const response = await axios.get('https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fsearch.cnbc.com%2Frs%2Fsearch%2Fcombinedcms%2Fview.xml%3FpartnerId%3Dwrss01%26id%3D100727362')
        const items = response.data.items.slice(0, 5).map(item => ({
          title: item.title,
          description: item.description,
          date: new Date(item.pubDate).toISOString().split('T')[0],
          link: item.link,
          sentiment: Math.random() // This is a placeholder. You'd need a real sentiment analysis service.
        }))
        setNewsItems(items)
      } catch (error) {
        console.error("Error fetching news:", error)
      }
    }

    fetchNews()
  }, [])

  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null)
  const handleReadMore = (item: NewsItem) => {
    setSelectedItem(item)
    setIsPopupOpen(true)
  }
  const handleClosePopup = () => {
    setIsPopupOpen(false)
    setSelectedItem(null)
  }
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
                <p className="text-sm text-muted-foreground mt-2">{item.date}</p>
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
                <button onClick={() => handleReadMore(item)} className="text-primary hover:underline mt-4">
                  Read More
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
      {isPopupOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card p-8 rounded-lg shadow-lg w-[90%] max-w-4xl">
            <h2 className="text-2xl font-semibold">{selectedItem.title}</h2>
            <p className="text-muted-foreground mt-4 text-lg">{selectedItem.description}</p>
            <button onClick={handleClosePopup} className="text-primary hover:underline mt-6">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ArrowDownIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  )
}


function ArrowUpIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </svg>
  )
}