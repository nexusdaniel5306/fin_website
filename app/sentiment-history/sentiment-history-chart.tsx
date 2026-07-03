"use client"

import { useState } from "react"

import { ArrowDownIcon, ArrowUpIcon } from "@/app/icons"
import type {
  DailySentiment,
  SentimentHistorySnapshot,
} from "@/lib/sentiment-history"

type HistoryView = "week" | "month"

interface SentimentHistoryChartProps {
  snapshot: SentimentHistorySnapshot
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
})

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
})

const parseDateKey = (dateKey: string) => new Date(`${dateKey}T12:00:00Z`)

const getDefaultSelectedDate = (days: DailySentiment[]) =>
  [...days].reverse().find((day) => day.articleCount > 0)?.date ?? days.at(-1)?.date ?? ""

const formatStatus = (status: DailySentiment["status"]) =>
  status === "no-data" ? "No data" : `${status[0].toUpperCase()}${status.slice(1)}`

const formatSignedScore = (score: number) => `${score > 0 ? "+" : ""}${score}`

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-border pl-3">
      <dt className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-bold text-card-foreground">{value}</dd>
    </div>
  )
}

export function SentimentHistoryChart({ snapshot }: SentimentHistoryChartProps) {
  const [view, setView] = useState<HistoryView>("week")
  const [selectedDate, setSelectedDate] = useState(() =>
    getDefaultSelectedDate(snapshot.days),
  )
  const visibleDays = view === "week" ? snapshot.days.slice(-7) : snapshot.days
  const selectedDay =
    snapshot.days.find((day) => day.date === selectedDate) ?? visibleDays.at(-1)

  const changeView = (nextView: HistoryView) => {
    const nextDays = nextView === "week" ? snapshot.days.slice(-7) : snapshot.days
    setView(nextView)

    if (!nextDays.some((day) => day.date === selectedDate)) {
      setSelectedDate(getDefaultSelectedDate(nextDays))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Daily sentiment uses unique headlines published in Eastern time.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Recording started: {snapshot.startedAt ? timestampFormatter.format(new Date(snapshot.startedAt)) : "Not yet"}
            </span>
            <span>
              Last collected: {snapshot.lastSuccessfulCollectionAt ? timestampFormatter.format(new Date(snapshot.lastSuccessfulCollectionAt)) : "Not yet"}
            </span>
          </div>
        </div>
        <div
          role="group"
          className="inline-flex w-fit border border-border bg-background p-1"
          aria-label="History range"
        >
          {(["week", "month"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => changeView(option)}
              className="px-4 py-2 text-sm font-bold capitalize transition-colors hover:bg-muted/50 aria-pressed:bg-foreground aria-pressed:text-background"
            >
              {option === "week" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      {!snapshot.available && (
        <div role="status" className="border border-destructive/40 bg-destructive/5 p-4 text-sm">
          Sentiment history is temporarily unavailable because Redis is not connected.
        </div>
      )}

      {snapshot.available && snapshot.collectionDelayed && (
        <div role="status" className="border border-accent bg-accent/10 p-4 text-sm">
          Collection is delayed. The most recent bars may be incomplete.
        </div>
      )}

      <div className="overflow-x-auto pb-2">
        <div className={view === "month" ? "min-w-[70rem]" : "min-w-[21rem]"}>
          <div className="relative pl-10">
            <span className="absolute left-0 top-0 text-xs text-muted-foreground">+100</span>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">0</span>
            <span className="absolute bottom-7 left-0 text-xs text-muted-foreground">−100</span>
            <div className="pointer-events-none absolute inset-x-10 top-1/2 border-t border-foreground/40" />
            <div className="pointer-events-none absolute inset-x-10 top-0 border-t border-border/70" />
            <div className="pointer-events-none absolute inset-x-10 bottom-7 border-t border-border/70" />

            <div
              role="group"
              className="flex h-72 items-stretch gap-2"
              aria-label={`${view === "week" ? "Seven" : "Thirty"}-day sentiment chart`}
            >
              {visibleDays.map((day) => {
                const hasData = day.netScore !== null
                const score = day.netScore ?? 0
                const magnitude = Math.max(2, Math.abs(score) / 2)
                const isPositive = score > 0
                const isNegative = score < 0
                const ariaLabel = hasData
                  ? `${longDateFormatter.format(parseDateKey(day.date))}: ${day.direction}, net sentiment ${formatSignedScore(score)}, ${day.articleCount} articles, ${formatStatus(day.status)}`
                  : `${longDateFormatter.format(parseDateKey(day.date))}: no data`

                return (
                  <button
                    key={day.date}
                    type="button"
                    disabled={!hasData}
                    aria-label={ariaLabel}
                    aria-pressed={hasData ? selectedDay?.date === day.date : undefined}
                    onClick={() => setSelectedDate(day.date)}
                    className="group relative flex min-w-8 flex-1 flex-col items-center outline-none disabled:cursor-default"
                  >
                    <span className="relative block h-64 w-full border-x border-transparent group-focus-visible:border-ring">
                      {hasData ? (
                        <span
                          className={`absolute inset-x-[18%] border border-current transition-opacity group-hover:opacity-80 group-aria-pressed:ring-2 group-aria-pressed:ring-foreground group-aria-pressed:ring-offset-2 group-aria-pressed:ring-offset-background ${
                            isPositive
                              ? "bottom-1/2 bg-green-600 text-green-800"
                              : isNegative
                                ? "top-1/2 bg-red-600 text-red-800"
                                : "top-1/2 -translate-y-1/2 bg-foreground text-foreground"
                          }`}
                          style={{ height: isPositive || isNegative ? `${magnitude}%` : "3px" }}
                        />
                      ) : (
                        <span className="absolute inset-x-[28%] top-1/2 h-2 -translate-y-1/2 border border-dashed border-muted-foreground/50" />
                      )}
                    </span>
                    <span className="mt-2 text-[0.68rem] font-bold text-muted-foreground group-aria-pressed:text-foreground">
                      {dateFormatter.format(parseDateKey(day.date))}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {selectedDay && selectedDay.articleCount > 0 ? (
        <section aria-live="polite" className="border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Selected day
              </p>
              <h2 className="mt-1 text-xl font-bold">
                {longDateFormatter.format(parseDateKey(selectedDay.date))}
              </h2>
            </div>
            <div className="flex items-center gap-2 font-bold">
              {selectedDay.direction === "up" && <ArrowUpIcon className="h-5 w-5 text-green-700" aria-hidden />}
              {selectedDay.direction === "down" && <ArrowDownIcon className="h-5 w-5 text-red-700" aria-hidden />}
              <span className="capitalize">{selectedDay.direction}</span>
              <span className="border border-border px-2 py-1 text-xs uppercase tracking-wide">
                {formatStatus(selectedDay.status)}
              </span>
            </div>
          </div>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Net sentiment" value={formatSignedScore(selectedDay.netScore ?? 0)} />
            <Metric label="Dominant strength" value={`${selectedDay.strength}%`} />
            <Metric label="Articles" value={String(selectedDay.articleCount)} />
            <Metric label="Up / Down" value={`${selectedDay.upArticleCount} / ${selectedDay.downArticleCount}`} />
            <Metric label="Average confidence" value={`${selectedDay.averageConfidence}%`} />
            <Metric label="Day boundary" value="Eastern time" />
          </dl>
        </section>
      ) : (
        <section className="border border-dashed border-border p-5 text-sm text-muted-foreground">
          No sentiment has been recorded for this date yet.
        </section>
      )}
    </div>
  )
}
