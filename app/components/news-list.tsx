"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import type { NewsItem } from "@/lib/types"
import { ArrowDownIcon, ArrowUpIcon } from "@/app/icons"
import { SENTIMENT_MODEL_LABEL } from "@/lib/sentiment-model"

function formatUtcFromRssDate(dateString: string): { utcLabel: string; isValid: boolean } {
  const parsed = new Date(dateString)
  if (Number.isNaN(parsed.getTime())) {
    return { utcLabel: "—", isValid: false }
  }
  const utc = parsed.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")
  return { utcLabel: utc, isValid: true }
}

function SentimentBadge({ sentiment }: { sentiment: NewsItem["sentiment"] }) {
  if (sentiment?.direction === "up") {
    return (
      <div className="flex items-center text-green-500">
        <ArrowUpIcon className="mr-1 h-5 w-5" aria-hidden />
        <span>{sentiment.confidence}%</span>
      </div>
    )
  }
  if (sentiment?.direction === "down") {
    return (
      <div className="flex items-center text-red-500">
        <ArrowDownIcon className="mr-1 h-5 w-5" aria-hidden />
        <span>{sentiment.confidence}%</span>
      </div>
    )
  }
  return null
}

export function NewsList({ items }: { items: NewsItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const reactId = useId()
  const isOpen = openIndex !== null
  const activeItem = isOpen ? items[openIndex] : null

  const close = useCallback(() => setOpenIndex(null), [])

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, close])

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const id = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [isOpen, openIndex])

  const titleId = activeItem ? `${reactId}-article-title-${openIndex}` : undefined
  const { utcLabel, isValid: dateValid } = activeItem
    ? formatUtcFromRssDate(activeItem.date)
    : { utcLabel: "", isValid: false }

  return (
    <>
      <div className="grid gap-6">
        {items.map((item, index) => (
          <div
            key={`${item.link}-${index}`}
            className="flex flex-col gap-4 rounded-lg bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-muted-foreground">{item.description}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {new Date(item.date).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:items-end">
              <SentimentBadge sentiment={item.sentiment} />
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                className="text-left text-primary underline-offset-4 hover:underline"
              >
                Read more
              </button>
            </div>
          </div>
        ))}
      </div>

      {isOpen && activeItem && titleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/20 backdrop-blur-[1px]"
            aria-label="Close article details"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col gap-4 overflow-y-auto border border-border bg-card p-6 text-card-foreground shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id={titleId} className="pr-2 text-xl font-semibold">
                {activeItem.title}
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                className="shrink-0 border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:opacity-90"
              >
                Close
              </button>
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-card-foreground">Published (UTC): </span>
                {dateValid ? utcLabel : "Could not parse date"}
              </p>
              <p className="break-words">
                <span className="font-medium text-card-foreground">Original (RSS): </span>
                {activeItem.date}
              </p>
            </div>

            <div className="rounded-md border border-border bg-background/40 p-4">
              <p className="text-sm font-medium text-card-foreground">
                Market reaction ({SENTIMENT_MODEL_LABEL})
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <SentimentBadge sentiment={activeItem.sentiment} />
              </div>
              {activeItem.sentiment ? (
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    <span className="font-medium text-card-foreground">Reason: </span>
                    {activeItem.sentiment.reason}
                  </p>
                  <p>
                    <span className="font-medium text-card-foreground">Grain of salt: </span>
                    {activeItem.sentiment.grainOfSalt}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">No analysis available.</p>
              )}
            </div>

            <div>
              <p className="text-muted-foreground">{activeItem.description}</p>
            </div>

            <div className="border-t border-border pt-4">
              <a
                href={activeItem.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Open source article
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
