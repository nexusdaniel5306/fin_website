import { ArrowDownIcon, ArrowUpIcon } from "@/app/icons"
import type { EpollSummary } from "@/lib/epoll"

interface EpollBadgeProps {
  summary: EpollSummary | null
}

export function EpollBadge({ summary }: EpollBadgeProps) {
  if (!summary) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.2em]">
        <span>epoll</span>
        <span className="text-primary-foreground/60">offline</span>
      </div>
    )
  }

  const contextLabel = `${summary.articleCount} article${summary.articleCount === 1 ? "" : "s"}`

  if (summary.direction === "mixed") {
    return (
      <div className="flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]">
        <span>epoll</span>
        <span>mixed</span>
        <span>50%</span>
        <span className="text-primary-foreground/50">·</span>
        <span className="text-xs text-primary-foreground/70 normal-case tracking-normal">last 8h {contextLabel}</span>
      </div>
    )
  }

  const isUp = summary.direction === "up"

  return (
    <div className="flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]">
      <span>epoll</span>
      <span className={isUp ? "text-green-800" : "text-red-800"}>
        {isUp ? <ArrowUpIcon className="h-4 w-4" aria-hidden /> : <ArrowDownIcon className="h-4 w-4" aria-hidden />}
      </span>
      <span className={isUp ? "text-green-800" : "text-red-800"}>{summary.strength}%</span>
      <span className="text-primary-foreground/50">·</span>
      <span className="text-xs text-primary-foreground/70 normal-case tracking-normal">last 8h {contextLabel}</span>
    </div>
  )
}
