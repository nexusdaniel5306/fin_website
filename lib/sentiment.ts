import { createHash } from "node:crypto"

import Groq from "groq-sdk"
import { Redis } from "@upstash/redis"

export interface NewsSentiment {
  direction: "up" | "down"
  confidence: number
  reason?: string
}

const SENTIMENT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30
const SENTIMENT_MODEL = "openai/gpt-oss-20b"
const SENTIMENT_TIMEOUT_MS = 8000

const sentimentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["direction", "confidence", "reason"],
  properties: {
    direction: {
      type: "string",
      enum: ["up", "down"],
    },
    confidence: {
      type: "integer",
      minimum: 0,
      maximum: 100,
    },
    reason: {
      type: "string",
      minLength: 1,
      maxLength: 160,
    },
  },
} as const

let groqClient: Groq | null | undefined
let redisClient: Redis | null | undefined

const hasRedisCredentials = () =>
  Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
      (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN),
  )

const getGroqClient = () => {
  if (groqClient !== undefined) {
    return groqClient
  }

  groqClient = process.env.GROQ_API_KEY
    ? new Groq({
        apiKey: process.env.GROQ_API_KEY,
        maxRetries: 0,
        timeout: SENTIMENT_TIMEOUT_MS,
      })
    : null

  return groqClient
}

const getRedisClient = () => {
  if (redisClient !== undefined) {
    return redisClient
  }

  redisClient = hasRedisCredentials() ? Redis.fromEnv() : null
  return redisClient
}

const normalizeHeadline = (title: string) =>
  title.trim().toLowerCase().replace(/\s+/g, " ")

const getSentimentCacheKey = (title: string) => {
  const headlineHash = createHash("sha256").update(normalizeHeadline(title)).digest("hex")
  return `marketepoll:sentiment:${headlineHash}`
}

const parseSentiment = (value: unknown): NewsSentiment | null => {
  if (!value || typeof value !== "object") {
    return null
  }

  const candidate = value as Record<string, unknown>
  const confidence = candidate.confidence

  if (candidate.direction !== "up" && candidate.direction !== "down") {
    return null
  }

  if (typeof confidence !== "number" || !Number.isInteger(confidence) || confidence < 0 || confidence > 100) {
    return null
  }

  if (typeof candidate.reason !== "string" || candidate.reason.trim().length === 0) {
    return null
  }

  return {
    direction: candidate.direction,
    confidence,
    reason: candidate.reason.trim(),
  }
}

const readCachedSentiment = async (title: string) => {
  const redis = getRedisClient()

  if (!redis) {
    return null
  }

  try {
    const cachedValue = await redis.get<string>(getSentimentCacheKey(title))

    if (!cachedValue) {
      return null
    }

    return parseSentiment(JSON.parse(cachedValue))
  } catch {
    return null
  }
}

const writeCachedSentiment = async (title: string, sentiment: NewsSentiment) => {
  const redis = getRedisClient()

  if (!redis) {
    return
  }

  try {
    await redis.set(getSentimentCacheKey(title), JSON.stringify(sentiment), {
      ex: SENTIMENT_CACHE_TTL_SECONDS,
    })
  } catch {
    // Sentiment caching is an optimization, not a rendering requirement.
  }
}

export const getHeadlineSentiment = async (title: string): Promise<NewsSentiment | null> => {
  const cleanTitle = title.trim()

  if (!cleanTitle) {
    return null
  }

  const cachedSentiment = await readCachedSentiment(cleanTitle)

  if (cachedSentiment) {
    return cachedSentiment
  }

  const groq = getGroqClient()

  if (!groq) {
    return null
  }

  try {
    const completion = await groq.chat.completions.create(
      {
        model: SENTIMENT_MODEL,
        temperature: 0.2,
        max_tokens: 120,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "market_sentiment",
            strict: true,
            schema: sentimentSchema,
          },
        },
        messages: [
          {
            role: "system",
            content:
              "You classify likely immediate market reaction to financial headlines. Return only valid JSON. Choose 'up' for likely positive market reaction and 'down' for likely negative market reaction. The confidence must be an integer from 0 to 100 representing how confident you are in the predicted direction. If the headline is ambiguous, still choose the more likely direction with lower confidence.",
          },
          {
            role: "user",
            content: `Headline: ${cleanTitle}`,
          },
        ],
      },
      {
        timeout: SENTIMENT_TIMEOUT_MS,
      },
    )

    const rawContent = completion.choices[0]?.message?.content

    if (!rawContent) {
      return null
    }

    const sentiment = parseSentiment(JSON.parse(rawContent))

    if (!sentiment) {
      return null
    }

    await writeCachedSentiment(cleanTitle, sentiment)

    return sentiment
  } catch {
    return null
  }
}
