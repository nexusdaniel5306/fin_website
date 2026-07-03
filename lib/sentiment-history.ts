export const MARKET_TIME_ZONE = "America/New_York"
export const SENTIMENT_HISTORY_DAYS = 30
export const SENTIMENT_HISTORY_SCHEMA_VERSION = "1"
export const COLLECTION_DELAY_THRESHOLD_MS = 45 * 60 * 1000

export type DailySentimentStatus = "live" | "complete" | "partial" | "no-data"

export interface DailySentiment {
  date: string
  status: DailySentimentStatus
  direction: "up" | "down" | "mixed" | null
  netScore: number | null
  strength: number | null
  articleCount: number
  upArticleCount: number
  downArticleCount: number
  averageConfidence: number | null
}

export interface SentimentHistoryMeta {
  startedAt: string | null
  lastSuccessfulCollectionAt: string | null
  schemaVersion: string | null
}

export interface SentimentHistorySnapshot extends SentimentHistoryMeta {
  available: boolean
  collectionDelayed: boolean
  days: DailySentiment[]
  timeZone: typeof MARKET_TIME_ZONE
}

export interface StoredHistorySentiment {
  direction: "up" | "down"
  confidence: number
}

const marketDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MARKET_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export const getMarketDateKey = (date: Date): string => {
  const parts = marketDateFormatter.formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  if (!year || !month || !day) {
    throw new Error("Could not determine the market date")
  }

  return `${year}-${month}-${day}`
}

export const shiftDateKey = (dateKey: string, offsetDays: number): string => {
  const [year, month, day] = dateKey.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + offsetDays, 12))

  return date.toISOString().slice(0, 10)
}

export const getMarketDateKeys = (
  now: Date = new Date(),
  count: number = SENTIMENT_HISTORY_DAYS,
): string[] => {
  const currentDateKey = getMarketDateKey(now)

  return Array.from({ length: count }, (_, index) =>
    shiftDateKey(currentDateKey, index - (count - 1)),
  )
}

export const serializeHistorySentiment = (sentiment: StoredHistorySentiment) =>
  `${sentiment.direction === "up" ? "u" : "d"}|${sentiment.confidence}`

export const parseHistorySentiment = (raw: string): StoredHistorySentiment | null => {
  const [direction, confidence] = raw.split("|")
  const parsedConfidence = Number(confidence)

  if (direction !== "u" && direction !== "d") {
    return null
  }

  if (
    !Number.isInteger(parsedConfidence) ||
    parsedConfidence < 0 ||
    parsedConfidence > 100
  ) {
    return null
  }

  return {
    direction: direction === "u" ? "up" : "down",
    confidence: parsedConfidence,
  }
}

const getDailyStatus = (
  dateKey: string,
  hasData: boolean,
  currentDateKey: string,
  startedAt: string | null,
): DailySentimentStatus => {
  if (!hasData) {
    return "no-data"
  }

  if (dateKey === currentDateKey) {
    return "live"
  }

  if (!startedAt) {
    return "partial"
  }

  const parsedStartedAt = new Date(startedAt)

  if (Number.isNaN(parsedStartedAt.getTime())) {
    return "partial"
  }

  return dateKey <= getMarketDateKey(parsedStartedAt) ? "partial" : "complete"
}

export const calculateDailySentiment = (
  dateKey: string,
  rawSentiments: string[],
  currentDateKey: string,
  startedAt: string | null,
): DailySentiment => {
  let upTotal = 0
  let downTotal = 0
  let upArticleCount = 0
  let downArticleCount = 0

  for (const rawSentiment of rawSentiments) {
    const sentiment = parseHistorySentiment(rawSentiment)

    if (!sentiment) {
      continue
    }

    if (sentiment.direction === "up") {
      upTotal += sentiment.confidence
      upArticleCount += 1
    } else {
      downTotal += sentiment.confidence
      downArticleCount += 1
    }
  }

  const articleCount = upArticleCount + downArticleCount
  const totalConfidence = upTotal + downTotal
  const status = getDailyStatus(
    dateKey,
    articleCount > 0,
    currentDateKey,
    startedAt,
  )

  if (articleCount === 0) {
    return {
      date: dateKey,
      status,
      direction: null,
      netScore: null,
      strength: null,
      articleCount: 0,
      upArticleCount: 0,
      downArticleCount: 0,
      averageConfidence: null,
    }
  }

  const direction = upTotal === downTotal ? "mixed" : upTotal > downTotal ? "up" : "down"
  const netScore =
    totalConfidence === 0
      ? 0
      : Math.round(((upTotal - downTotal) / totalConfidence) * 100)
  const strength =
    totalConfidence === 0
      ? 50
      : Math.round((Math.max(upTotal, downTotal) / totalConfidence) * 100)

  return {
    date: dateKey,
    status,
    direction,
    netScore,
    strength,
    articleCount,
    upArticleCount,
    downArticleCount,
    averageConfidence: Math.round(totalConfidence / articleCount),
  }
}

export const buildSentimentHistorySnapshot = ({
  available,
  recordsByDate,
  meta,
  now = new Date(),
}: {
  available: boolean
  recordsByDate: Map<string, string[]>
  meta: SentimentHistoryMeta
  now?: Date
}): SentimentHistorySnapshot => {
  const dateKeys = getMarketDateKeys(now)
  const currentDateKey = getMarketDateKey(now)
  const lastCollectionMs = meta.lastSuccessfulCollectionAt
    ? new Date(meta.lastSuccessfulCollectionAt).getTime()
    : Number.NaN

  return {
    available,
    ...meta,
    collectionDelayed:
      !Number.isNaN(lastCollectionMs) &&
      now.getTime() - lastCollectionMs > COLLECTION_DELAY_THRESHOLD_MS,
    days: dateKeys.map((dateKey) =>
      calculateDailySentiment(
        dateKey,
        recordsByDate.get(dateKey) ?? [],
        currentDateKey,
        meta.startedAt,
      ),
    ),
    timeZone: MARKET_TIME_ZONE,
  }
}
