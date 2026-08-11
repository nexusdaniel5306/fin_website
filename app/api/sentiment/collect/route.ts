import { verifySignatureAppRouter } from "@upstash/qstash/nextjs"
import { revalidatePath } from "next/cache"

import { collectSentimentFeed } from "@/lib/sentiment-collector"

export const maxDuration = 120

const collect = async () => {
  try {
    const result = await collectSentimentFeed({
      mode: "scheduled",
      requirePersistence: true,
    })

    if (result.recorded > 0) {
      revalidatePath("/sentiment-history")
    }

    if (result.generated > 0 || result.recorded > 0) {
      revalidatePath("/")
    }

    return Response.json({
      ok: true,
      fetched: result.fetched,
      analyzed: result.analyzed,
      generated: result.generated,
      recorded: result.recorded,
      skipped: result.skipped,
    })
  } catch (error) {
    console.error("Scheduled sentiment collection failed", { error })

    return Response.json(
      { ok: false, error: "Sentiment collection failed" },
      { status: 503 },
    )
  }
}

let verifiedCollect: ReturnType<typeof verifySignatureAppRouter> | null = null

const getVerifiedCollect = () => {
  if (!verifiedCollect) {
    verifiedCollect = verifySignatureAppRouter(collect)
  }

  return verifiedCollect
}

export async function POST(request: Request) {
  try {
    const response = await getVerifiedCollect()(request)

    if (response.status === 403) {
      return new Response("Unauthorized", { status: 401 })
    }

    return response
  } catch (error) {
    console.error("QStash verification could not run", { error })

    return Response.json(
      { ok: false, error: "Collector authentication is unavailable" },
      { status: 503 },
    )
  }
}
