import test from "node:test"
import assert from "node:assert/strict"

import {
  buildSentimentCompletionRequest,
  SENTIMENT_MODEL_ID,
} from "../lib/sentiment-model"
import {
  isMarketRelevantReporting,
  parseSentiment,
  SENTIMENT_RESPONSE_SCHEMA,
} from "../lib/sentiment-response"

const validSentiment = {
  contentType: "reporting",
  marketRelevant: true,
  direction: "up",
  confidence: 84,
  reason: "Lower rates can support valuations and risk appetite.",
  grainOfSalt: "The move may already be priced in.",
} as const

test("configures GPT-OSS with strict structured outputs", () => {
  const request = buildSentimentCompletionRequest("Federal Reserve cuts rates")

  assert.equal(SENTIMENT_MODEL_ID, "openai/gpt-oss-120b")
  assert.equal(request.reasoning_effort, "low")
  assert.equal(request.response_format.type, "json_schema")
  assert.equal(request.response_format.json_schema.strict, true)
  assert.deepEqual(
    [...SENTIMENT_RESPONSE_SCHEMA.required].sort(),
    ["confidence", "contentType", "direction", "grainOfSalt", "marketRelevant", "reason"],
  )
  assert.equal(SENTIMENT_RESPONSE_SCHEMA.additionalProperties, false)
})

test("parses an exact sentiment response and trims explanations", () => {
  assert.deepEqual(
    parseSentiment({
      ...validSentiment,
      reason: ` ${validSentiment.reason} `,
      grainOfSalt: ` ${validSentiment.grainOfSalt} `,
    }),
    validSentiment,
  )
  assert.equal(isMarketRelevantReporting(validSentiment), true)
  assert.equal(
    isMarketRelevantReporting({ ...validSentiment, contentType: "analysis" }),
    false,
  )
})

test("rejects malformed or schema-incompatible sentiment responses", () => {
  const invalidValues = [
    null,
    [],
    { ...validSentiment, contentType: "blog" },
    { ...validSentiment, marketRelevant: "yes" },
    { ...validSentiment, direction: "mixed" },
    { ...validSentiment, confidence: 84.5 },
    { ...validSentiment, confidence: -1 },
    { ...validSentiment, confidence: 101 },
    { ...validSentiment, reason: "" },
    { ...validSentiment, grainOfSalt: "x".repeat(221) },
    { ...validSentiment, extra: true },
    {
      direction: validSentiment.direction,
      confidence: validSentiment.confidence,
      reason: validSentiment.reason,
    },
  ]

  for (const value of invalidValues) {
    assert.equal(parseSentiment(value), null)
  }
})
