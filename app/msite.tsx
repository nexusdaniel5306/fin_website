/**
 * v0 by Vercel.
 * @see https://v0.dev/t/jxPf0zgxk6x
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
import Link from "next/link"

export default function Component() {
  const newsItems = [
    {
      title: "Stocks Surge on Positive Earnings Reports",
      description:
        "The S&P 500 and Nasdaq Composite indexes reached new highs as major companies reported better-than-expected quarterly results.",
      date: "2023-08-14",
      link: "#",
      sentiment: 0.8,
    },
    {
      title: "Federal Reserve Raises Interest Rates Again",
      description:
        "The central bank increased its benchmark rate by 0.25 percentage points, citing persistent inflation concerns.",
      date: "2023-08-11",
      link: "#",
      sentiment: 0.3,
    },
    {
      title: "Oil Prices Climb Amid Supply Disruptions",
      description:
        "Geopolitical tensions and production cuts by OPEC nations have pushed crude oil prices higher in recent weeks.",
      date: "2023-08-09",
      link: "#",
      sentiment: 0.6,
    },
    {
      title: "Cryptocurrency Market Sees Renewed Volatility",
      description:
        "Bitcoin and other digital assets experienced sharp price swings as regulatory uncertainty continues to impact the sector.",
      date: "2023-08-07",
      link: "#",
      sentiment: 0.4,
    },
    {
      title: "Housing Prices Show Signs of Cooling",
      description:
        "The pace of home price appreciation has slowed in many markets, providing some relief for prospective buyers.",
      date: "2023-08-05",
      link: "#",
      sentiment: 0.7,
    },
  ]
  return (
    <div className="bg-background text-foreground">
      <header className="bg-primary text-primary-foreground py-4 px-6">
        <h1 className="text-2xl font-bold">Financial News</h1>
      </header>
      <main className="py-8 px-6">
        <div className="grid gap-6">
          {newsItems.map((item, index) => (
            <div key={index} className="bg-card p-4 rounded-lg shadow-sm flex items-center">
              <div>
                <h2 className="text-lg font-semibold">Stocks Surge on Positive Earnings Reports</h2>
                <p className="text-muted-foreground mt-2">
                  The S&P 500 and Nasdaq Composite indexes reached new highs as major companies reported
                  better-than-expected quarterly results.
                </p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">2023-08-14</span>
                  <Link href="#" className="text-primary hover:underline" prefetch={false}>
                    Read More
                  </Link>
                </div>
              </div>
              <div className="ml-4 flex flex-col items-center justify-center">
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
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function ArrowDownIcon(props: React.SVGProps<SVGSVGElement>) {
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


function ArrowUpIcon(props: React.SVGProps<SVGSVGElement>) {
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