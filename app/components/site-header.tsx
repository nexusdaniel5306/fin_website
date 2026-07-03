import Link from "next/link"

import { EpollBadge } from "@/app/components/epoll-badge"
import type { EpollSummary } from "@/lib/epoll"

interface SiteHeaderProps {
  summary: EpollSummary | null
  currentPage: "home" | "history"
}

export function SiteHeader({ summary, currentPage }: SiteHeaderProps) {
  return (
    <header className="bg-primary px-6 py-3 text-primary-foreground">
      <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-4">
        <Link
          href="/"
          className="w-fit text-xl font-bold leading-none transition-opacity hover:opacity-70 md:text-2xl"
        >
          MarketEpoll
        </Link>
        <div className="md:justify-self-center">
          <EpollBadge summary={summary} />
        </div>
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-4 text-sm font-bold md:justify-self-end"
        >
          <Link
            href="/sentiment-history"
            aria-current={currentPage === "history" ? "page" : undefined}
            className="border border-primary-foreground/40 px-3 py-1.5 transition-colors hover:bg-primary-foreground/10 aria-[current=page]:bg-primary-foreground aria-[current=page]:text-primary"
          >
            History
          </Link>
          <a
            href="https://itsdan.li"
            target="_blank"
            rel="noopener noreferrer"
            className="tracking-[0.16em] transition-opacity hover:opacity-70"
          >
            itsDan.Li
          </a>
        </nav>
      </div>
    </header>
  )
}
