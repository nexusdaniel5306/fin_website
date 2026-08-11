export type NewsContentType =
  | "reporting"
  | "analysis"
  | "opinion"
  | "trade_idea"
  | "personal_finance"
  | "non_financial"

export interface NewsSentiment {
  contentType: NewsContentType
  marketRelevant: boolean
  direction: "up" | "down"
  confidence: number
  reason: string
  grainOfSalt: string
}

const MAX_EXPLANATION_LENGTH = 220
const SENTIMENT_KEYS = [
  "confidence",
  "contentType",
  "direction",
  "grainOfSalt",
  "marketRelevant",
  "reason",
]

export const isMarketRelevantReporting = (sentiment: NewsSentiment) =>
  sentiment.contentType === "reporting" && sentiment.marketRelevant

export const SENTIMENT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    contentType: {
      type: "string",
      enum: [
        "reporting",
        "analysis",
        "opinion",
        "trade_idea",
        "personal_finance",
        "non_financial",
      ],
      description: "The primary editorial type of the item.",
    },
    marketRelevant: {
      type: "boolean",
      description: "Whether the item is likely to affect financial markets or macro conditions.",
    },
    direction: {
      type: "string",
      enum: ["up", "down"],
      description: "The likely immediate direction of the overall market reaction.",
    },
    confidence: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Confidence in the predicted direction from 0 to 100.",
    },
    reason: {
      type: "string",
      description: "A concise explanation under 220 characters.",
    },
    grainOfSalt: {
      type: "string",
      description: "A concise caveat under 220 characters.",
    },
  },
  required: [
    "contentType",
    "marketRelevant",
    "direction",
    "confidence",
    "reason",
    "grainOfSalt",
  ],
  additionalProperties: false,
} as const

export const parseSentiment = (value: unknown): NewsSentiment | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>
  const keys = Object.keys(candidate).sort()
  const contentType = candidate.contentType
  const confidence = candidate.confidence
  const marketRelevant = candidate.marketRelevant
  const reason = candidate.reason
  const grainOfSalt = candidate.grainOfSalt

  if (
    keys.length !== SENTIMENT_KEYS.length ||
    keys.some((key, index) => key !== SENTIMENT_KEYS[index])
  ) {
    return null
  }

  if (
    contentType !== "reporting" &&
    contentType !== "analysis" &&
    contentType !== "opinion" &&
    contentType !== "trade_idea" &&
    contentType !== "personal_finance" &&
    contentType !== "non_financial"
  ) {
    return null
  }

  if (typeof marketRelevant !== "boolean") {
    return null
  }

  if (candidate.direction !== "up" && candidate.direction !== "down") {
    return null
  }

  if (
    typeof confidence !== "number" ||
    !Number.isInteger(confidence) ||
    confidence < 0 ||
    confidence > 100
  ) {
    return null
  }

  if (
    typeof reason !== "string" ||
    reason.trim().length === 0 ||
    reason.trim().length > MAX_EXPLANATION_LENGTH
  ) {
    return null
  }

  if (
    typeof grainOfSalt !== "string" ||
    grainOfSalt.trim().length === 0 ||
    grainOfSalt.trim().length > MAX_EXPLANATION_LENGTH
  ) {
    return null
  }

  return {
    contentType,
    marketRelevant,
    direction: candidate.direction,
    confidence,
    reason: reason.trim(),
    grainOfSalt: grainOfSalt.trim(),
  }
}
