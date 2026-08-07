import { createHash } from "node:crypto"
import { setTimeout as sleep } from "node:timers/promises"

import Groq from "groq-sdk"
import { getRedisClient } from "@/lib/redis"
import {
  buildSentimentCompletionRequest,
  SENTIMENT_MODEL_ID,
} from "@/lib/sentiment-model"
import {
  parseSentiment,
  type NewsSentiment,
} from "@/lib/sentiment-response"

export type { NewsSentiment } from "@/lib/sentiment-response"

const SENTIMENT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30
const SENTIMENT_TIMEOUT_MS = 8000
const SENTIMENT_MAX_RETRIES = 2
const MIN_GROQ_REQUEST_INTERVAL_MS = 500

let groqClient: Groq | null | undefined
let groqRequestQueue: Promise<void> = Promise.resolve()
let nextGroqRequestAt = 0

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

const normalizeHeadline = (title: string) =>
  title.trim().toLowerCase().replace(/\s+/g, " ")

const getSentimentCacheKey = (title: string) => {
  const headlineHash = createHash("sha256")
    .update(`${SENTIMENT_MODEL_ID}|${normalizeHeadline(title)}`)
    .digest("hex")
  return `marketepoll:sentiment:${headlineHash}`
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
        buildSentimentCompletionRequest(cleanTitle),
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
