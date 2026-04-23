import { createClient } from "redis"

type RedisClient = ReturnType<typeof createClient>

let redisClient: RedisClient | null | undefined
let redisConnectionPromise: Promise<RedisClient | null> | null = null

export const getRedisUrl = () => process.env.EPOLL_REDIS_URL || process.env.REDIS_URL || null

export const getRedisClient = async () => {
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
