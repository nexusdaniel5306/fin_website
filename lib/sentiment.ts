import { createHash } from "node:crypto"
import { setTimeout as sleep } from "node:timers/promises"

import Groq from "groq-sdk"
import { createClient } from "redis"
import { SENTIMENT_MODEL_ID } from "@/lib/sentiment-model"

export interface NewsSentiment {
  direction: "up" | "down"
  confidence: number
  reason: string
  grainOfSalt: string
}

const SENTIMENT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30
const SENTIMENT_TIMEOUT_MS = 8000
const SENTIMENT_MAX_RETRIES = 2
const MIN_GROQ_REQUEST_INTERVAL_MS = 500

let groqClient: Groq | null | undefined
type RedisClient = ReturnType<typeof createClient>

let redisClient: RedisClient | null | undefined
let redisConnectionPromise: Promise<RedisClient | null> | null = null
let groqRequestQueue: Promise<void> = Promise.resolve()
let nextGroqRequestAt = 0

const getRedisUrl = () => process.env.EPOLL_REDIS_URL || process.env.REDIS_URL || null

const getGroqClient = () => {
  if (groqClient !== undefined) {
    return groqClient
  }

  groqClient = process.env.GROQ_API_KEY
    ? new Groq({
        apiKey: process.env.GROQ_API_KEY,
        // The Groq SDK honors retry-after / retry-after-ms headers when retries are enabled.
        maxRetries: SENTIMENT_MAX_RETRIES,
        timeout: SENTIMENT_TIMEOUT_MS,
      })
    : null

  return groqClient
}

const getRedisClient = async () => {
  if (redisClient !== undefined) {
    return redisClient
  }

  if (redisConnectionPromise) {
    return redisConnectionPromise
  }

  const redisUrl = getRedisUrl()

  if (!redisUrl) {
    redisClient = null
    return redisClient
  }

  const client = createClient({
    url: redisUrl,
  })

  client.on("error", () => {
    // Redis outages should not break page rendering.
  })

  redisConnectionPromise = client
    .connect()
    .then(() => {
      redisClient = client
      return client
    })
    .catch(() => {
      redisClient = null
      return null
    })
    .finally(() => {
      redisConnectionPromise = null
    })

  return redisConnectionPromise
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
  const reason = candidate.reason
  const grainOfSalt = candidate.grainOfSalt

  if (candidate.direction !== "up" && candidate.direction !== "down") {
    return null
  }

  if (typeof confidence !== "number" || !Number.isInteger(confidence) || confidence < 0 || confidence > 100) {
    return null
  }

  if (typeof reason !== "string" || reason.trim().length === 0) {
    return null
  }

  if (typeof grainOfSalt !== "string" || grainOfSalt.trim().length === 0) {
    return null
  }

  return {
    direction: candidate.direction,
    confidence,
    reason: reason.trim(),
    grainOfSalt: grainOfSalt.trim(),
  }
}

const queueGroqRequest = async <T>(task: () => Promise<T>) => {
  const previousRequest = groqRequestQueue
  let releaseQueue: () => void = () => {}

  groqRequestQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve
  })

  await previousRequest

  try {
    const waitMs = Math.max(0, nextGroqRequestAt - Date.now())

    if (waitMs > 0) {
      await sleep(waitMs)
    }

    nextGroqRequestAt = Date.now() + MIN_GROQ_REQUEST_INTERVAL_MS

    return await task()
  } finally {
    releaseQueue()
  }
}

const readCachedSentiment = async (title: string) => {
  const redis = await getRedisClient()

  if (!redis) {
    return null
  }

  try {
    const cachedValue = await redis.get(getSentimentCacheKey(title))

    if (!cachedValue) {
      return null
    }

    return parseSentiment(JSON.parse(cachedValue))
  } catch {
    return null
  }
}

const writeCachedSentiment = async (title: string, sentiment: NewsSentiment) => {
  const redis = await getRedisClient()

  if (!redis) {
    return
  }

  try {
    await redis.setEx(getSentimentCacheKey(title), SENTIMENT_CACHE_TTL_SECONDS, JSON.stringify(sentiment))
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
    const completion = await queueGroqRequest(() =>
      groq.chat.completions.create(
        {
          model: SENTIMENT_MODEL_ID,
          temperature: 0.2,
          max_completion_tokens: 220,
          response_format: {
            type: "json_object",
          },
          messages: [
            {
              role: "system",
              content:
                'You classify likely immediate market reaction to financial headlines. Return only valid JSON with exactly these keys: "direction", "confidence", "reason", "grainOfSalt". "direction" must be "up" or "down". "confidence" must be an integer from 0 to 100. "reason" must be a concise explanation under 220 characters of why markets may react this way. "grainOfSalt" must be a concise caveat under 220 characters explaining what might make the first interpretation incomplete or misleading. Do not wrap the JSON in markdown or add any extra keys.',
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
      ),
    )

    const rawContent = completion.choices[0]?.message?.content

    if (!rawContent) {
      console.error("Groq sentiment response was empty", { title: cleanTitle })
      return null
    }

    const sentiment = parseSentiment(JSON.parse(rawContent))

    if (!sentiment) {
      console.error("Groq sentiment response did not match expected shape", {
        title: cleanTitle,
        rawContent,
      })
      return null
    }

    await writeCachedSentiment(cleanTitle, sentiment)

    return sentiment
  } catch (error) {
    console.error("Groq sentiment request failed", {
      title: cleanTitle,
      error,
    })
    return null
  }
}
