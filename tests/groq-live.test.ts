import test from "node:test"
import assert from "node:assert/strict"

import Groq from "groq-sdk"

import {
  buildSentimentCompletionRequest,
  SENTIMENT_MODEL_ID,
} from "../lib/sentiment-model"
import { parseSentiment } from "../lib/sentiment-response"

const headlines = [
  "Federal Reserve unexpectedly cuts interest rates by 50 basis points as inflation falls",
  "Major U.S. bank reports insolvency after emergency capital raise fails",
  "Oil prices rise as producers announce a surprise extension of supply cuts",
  "Large technology company beats earnings estimates but lowers next-quarter guidance",
  "Congress reaches a last-minute agreement that avoids a government shutdown",
]

test(
  "GPT-OSS structured output matches the production sentiment contract",
  { skip: process.env.GROQ_LIVE_TEST !== "1" },
  async () => {
    assert.ok(process.env.GROQ_API_KEY, "GROQ_API_KEY is required")

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      maxRetries: 0,
      timeout: 20_000,
    })

    for (const headline of headlines) {
      const completion = await groq.chat.completions.create(
        buildSentimentCompletionRequest(headline),
      )
      const choice = completion.choices[0]
      const rawContent = choice?.message?.content

      assert.equal(completion.model, SENTIMENT_MODEL_ID)
      assert.equal(choice?.finish_reason, "stop")
      assert.ok(rawContent, `Expected content for: ${headline}`)

      const rawSentiment = JSON.parse(rawContent)
      const sentiment = parseSentiment(rawSentiment)

      assert.ok(sentiment, `Expected schema-compliant sentiment for: ${headline}`)
      assert.deepEqual(
        Object.keys(rawSentiment).sort(),
        ["confidence", "direction", "grainOfSalt", "reason"],
      )
      assert.ok(sentiment.reason.length <= 220)
      assert.ok(sentiment.grainOfSalt.length <= 220)
    }
  },
)
