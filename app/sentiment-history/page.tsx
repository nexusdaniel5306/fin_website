import type { Metadata } from "next"

import { SiteHeader } from "@/app/components/site-header"
import { SentimentHistoryChart } from "@/app/sentiment-history/sentiment-history-chart"
import { getStoredEpollSummary } from "@/lib/epoll-store"
import {
  createSentimentHistoryFixtureSnapshot,
  isSentimentHistoryFixtureMode,
  SENTIMENT_HISTORY_FIXTURE_EPOLL,
} from "@/lib/sentiment-history-fixtures"
import { getSentimentHistorySnapshot } from "@/lib/sentiment-history-store"

export const metadata: Metadata = {
  title: "Sentiment History | MarketEpoll",
  description: "Seven- and thirty-day market news sentiment history.",
}

export const revalidate = 300

export default async function SentimentHistoryPage() {
  const now = new Date()
  const fixtureMode = isSentimentHistoryFixtureMode()
  const [snapshot, epoll] = fixtureMode
    ? [createSentimentHistoryFixtureSnapshot(now), SENTIMENT_HISTORY_FIXTURE_EPOLL]
    : await Promise.all([
        getSentimentHistorySnapshot(now),
        getStoredEpollSummary(now),
      ])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader summary={epoll} currentPage="history" />
      <main className="px-6 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
              MarketEpoll archive
            </p>
            <h1 className="mt-2 text-3xl font-bold md:text-4xl">Sentiment history</h1>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              A daily view of the same confidence-weighted headline sentiment behind the rolling eight-hour pulse.
            </p>
          </div>
          {fixtureMode ? (
            <div
              role="status"
              className="mb-6 border border-amber-500/50 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            >
              <span className="font-bold">Simulation mode:</span> deterministic sample articles are shown. Redis, Groq, and QStash are not being used on this page.
            </div>
          ) : null}
          <SentimentHistoryChart snapshot={snapshot} />
        </div>
      </main>
    </div>
  )
}
