export interface EpollSentimentInput {
  direction: "up" | "down"
  confidence: number
}

export interface EpollArticleInput {
  date: string
  sentiment: EpollSentimentInput | null
}

export interface EpollSummary {
  direction: "up" | "down" | "mixed"
  strength: number
  articleCount: number
}

export const EPOLL_WINDOW_HOURS = 8
export const EPOLL_WINDOW_MS = EPOLL_WINDOW_HOURS * 60 * 60 * 1000

export interface EpollStoredMember {
  id: string
  direction: "up" | "down"
  confidence: number
}

export const isWithinEpollWindow = (dateString: string, now: Date = new Date()) => {
  const nowMs = now.getTime()
  const publishedAt = new Date(dateString).getTime()

  if (Number.isNaN(publishedAt)) {
    return false
  }

  const ageMs = nowMs - publishedAt
  return ageMs >= 0 && ageMs <= EPOLL_WINDOW_MS
}

const calculateEpollSummaryFromTotals = (
  upTotal: number,
  downTotal: number,
  articleCount: number,
): EpollSummary | null => {
  if (articleCount === 0) {
    return null
  }

  const totalConfidence = upTotal + downTotal

  if (upTotal === downTotal) {
    return {
      direction: "mixed",
      strength: 50,
      articleCount,
    }
  }

  const direction = upTotal > downTotal ? "up" : "down"
  const dominantTotal = direction === "up" ? upTotal : downTotal

  return {
    direction,
    strength: Math.round((dominantTotal / totalConfidence) * 100),
    articleCount,
  }
}

export const serializeEpollStoredMember = (member: EpollStoredMember) =>
  `${member.id}|${member.direction}|${member.confidence}`

export const parseEpollStoredMember = (raw: string): EpollStoredMember | null => {
  const [id, direction, confidence] = raw.split("|")

  if (!id || (direction !== "up" && direction !== "down")) {
    return null
  }

  const parsedConfidence = Number(confidence)

  if (!Number.isInteger(parsedConfidence) || parsedConfidence < 0 || parsedConfidence > 100) {
    return null
  }

  return {
    id,
    direction,
    confidence: parsedConfidence,
  }
}

export const calculateEpollSummaryFromStoredMembers = (
  members: string[],
): EpollSummary | null => {
  let upTotal = 0
  let downTotal = 0
  let articleCount = 0

  for (const rawMember of members) {
    const member = parseEpollStoredMember(rawMember)

    if (!member) {
      continue
    }

    articleCount += 1

    if (member.direction === "up") {
      upTotal += member.confidence
      continue
    }

    downTotal += member.confidence
  }

  return calculateEpollSummaryFromTotals(upTotal, downTotal, articleCount)
}

export const calculateEpollSummary = (
  items: EpollArticleInput[],
  now: Date = new Date(),
): EpollSummary | null => {
  const nowMs = now.getTime()
  let upTotal = 0
  let downTotal = 0
  let articleCount = 0

  for (const item of items) {
    if (!item.sentiment || !isWithinEpollWindow(item.date, now)) {
      continue
    }

    articleCount += 1

    if (item.sentiment.direction === "up") {
      upTotal += item.sentiment.confidence
      continue
    }

    downTotal += item.sentiment.confidence
  }

  return calculateEpollSummaryFromTotals(upTotal, downTotal, articleCount)
}
