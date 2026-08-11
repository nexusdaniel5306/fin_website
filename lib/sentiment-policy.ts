export type SentimentCollectionMode = "cache-only" | "scheduled"

export const MAX_SCHEDULED_GENERATIONS = 8

export interface SentimentGenerationBudget {
  readonly remaining: number
  readonly attempted: number
  readonly completed: number
  consume: () => boolean
  recordCompletion: () => void
}

export const createSentimentGenerationBudget = (
  limit = MAX_SCHEDULED_GENERATIONS,
): SentimentGenerationBudget => {
  let remaining = Math.max(0, Math.floor(limit))
  let attempted = 0
  let completed = 0

  return {
    get remaining() {
      return remaining
    },
    get attempted() {
      return attempted
    },
    get completed() {
      return completed
    },
    consume() {
      if (remaining === 0) {
        return false
      }

      remaining -= 1
      attempted += 1
      return true
    },
    recordCompletion() {
      completed += 1
    },
  }
}

export type SentimentPolicySource = "cache" | "generated" | "unavailable"

export interface SentimentPolicyResult<T> {
  value: T | null
  source: SentimentPolicySource
}

export const resolveSentimentWithPolicy = async <T>({
  mode,
  generationBudget,
  readCached,
  generate,
}: {
  mode: SentimentCollectionMode
  generationBudget?: SentimentGenerationBudget
  readCached: () => Promise<T | null>
  generate: () => Promise<T | null>
}): Promise<SentimentPolicyResult<T>> => {
  const cachedValue = await readCached()

  if (cachedValue !== null) {
    return { value: cachedValue, source: "cache" }
  }

  if (mode !== "scheduled") {
    return { value: null, source: "unavailable" }
  }

  if (generationBudget && !generationBudget.consume()) {
    return { value: null, source: "unavailable" }
  }

  const generatedValue = await generate()

  if (generatedValue === null) {
    return { value: null, source: "unavailable" }
  }

  generationBudget?.recordCompletion()

  return { value: generatedValue, source: "generated" }
}
