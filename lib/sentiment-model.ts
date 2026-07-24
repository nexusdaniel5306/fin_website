import { SENTIMENT_RESPONSE_SCHEMA } from "./sentiment-response"

export const SENTIMENT_MODEL_ID = "openai/gpt-oss-120b"
export const SENTIMENT_MODEL_LABEL = "GPT-OSS 120B"

const SENTIMENT_SYSTEM_PROMPT =
  "Classify the likely immediate overall market reaction to a financial headline. Keep reason and grainOfSalt concise and under 220 characters each. The reason should explain the predicted direction. The grainOfSalt should explain what could make that first interpretation incomplete or misleading."

export const buildSentimentCompletionRequest = (headline: string) => ({
  model: SENTIMENT_MODEL_ID,
  temperature: 0.2,
  reasoning_effort: "low" as const,
  max_completion_tokens: 1024,
  response_format: {
    type: "json_schema" as const,
    json_schema: {
      name: "market_sentiment",
      description: "Immediate market-reaction classification for a financial headline.",
      strict: true,
      schema: SENTIMENT_RESPONSE_SCHEMA,
    },
  },
  messages: [
    {
      role: "system" as const,
      content: SENTIMENT_SYSTEM_PROMPT,
    },
    {
      role: "user" as const,
      content: `Headline: ${headline}`,
    },
  ],
})
