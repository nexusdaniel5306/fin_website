import { SENTIMENT_RESPONSE_SCHEMA } from "./sentiment-response"

export const SENTIMENT_MODEL_ID = "openai/gpt-oss-120b"
export const SENTIMENT_MODEL_LABEL = "GPT-OSS 120B"

const SENTIMENT_SYSTEM_PROMPT =
  "Classify the item before estimating its likely immediate overall market reaction. Use reporting only for a factual news report of an event, result, data release, decision, or development; use analysis, opinion, trade_idea, personal_finance, or non_financial when those fit better. Set marketRelevant true only when the item is likely to affect financial markets or macroeconomic conditions. Only reporting items with marketRelevant true are eligible for the public market-news feed. Keep reason and grainOfSalt concise and under 220 characters each. The reason should explain the predicted direction. The grainOfSalt should explain what could make that first interpretation incomplete or misleading."

export const buildSentimentCompletionRequest = (headline: string, description = "") => ({
  model: SENTIMENT_MODEL_ID,
  temperature: 0.2,
  reasoning_effort: "low" as const,
  max_completion_tokens: 1024,
  response_format: {
    type: "json_schema" as const,
    json_schema: {
      name: "market_sentiment",
      description: "Editorial and immediate market-reaction classification for a financial news item.",
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
      content: `Headline: ${headline}${description.trim() ? `\nDescription: ${description.trim()}` : ""}`,
    },
  ],
})
