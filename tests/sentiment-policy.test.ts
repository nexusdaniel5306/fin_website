import test from "node:test"
import assert from "node:assert/strict"

import {
  createSentimentGenerationBudget,
  MAX_SCHEDULED_GENERATIONS,
  resolveSentimentWithPolicy,
} from "../lib/sentiment-policy"

test("cache-only policy never invokes generation", async () => {
  let generationCalls = 0
  const budget = createSentimentGenerationBudget()

  const result = await resolveSentimentWithPolicy({
    mode: "cache-only",
    generationBudget: budget,
    readCached: async () => null,
    generate: async () => {
      generationCalls += 1
      return "generated"
    },
  })

  assert.deepEqual(result, { value: null, source: "unavailable" })
  assert.equal(generationCalls, 0)
  assert.equal(budget.attempted, 0)
})

test("scheduled policy caps fresh generation attempts at eight", async () => {
  let generationCalls = 0
  const budget = createSentimentGenerationBudget()
  const results: Array<string | null> = []

  for (let index = 0; index < 12; index += 1) {
    const result = await resolveSentimentWithPolicy({
      mode: "scheduled",
      generationBudget: budget,
      readCached: async () => null,
      generate: async () => {
        generationCalls += 1
        return `generated-${index}`
      },
    })

    results.push(result.value)
  }

  assert.equal(MAX_SCHEDULED_GENERATIONS, 8)
  assert.equal(generationCalls, MAX_SCHEDULED_GENERATIONS)
  assert.equal(budget.attempted, MAX_SCHEDULED_GENERATIONS)
  assert.equal(budget.completed, MAX_SCHEDULED_GENERATIONS)
  assert.equal(results.filter((value) => value !== null).length, MAX_SCHEDULED_GENERATIONS)
})

test("cached results do not consume the scheduled generation budget", async () => {
  let generationCalls = 0
  const budget = createSentimentGenerationBudget()
  const results: Array<string | null> = []

  for (let index = 0; index < 12; index += 1) {
    const result = await resolveSentimentWithPolicy({
      mode: "scheduled",
      generationBudget: budget,
      readCached: async () => (index < 4 ? `cached-${index}` : null),
      generate: async () => {
        generationCalls += 1
        return `generated-${index}`
      },
    })

    results.push(result.value)
  }

  assert.deepEqual(results.slice(0, 4), ["cached-0", "cached-1", "cached-2", "cached-3"])
  assert.equal(generationCalls, 8)
  assert.equal(budget.attempted, 8)
  assert.equal(budget.completed, 8)
})
