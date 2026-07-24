# MarketEpoll

MarketEpoll is a lightweight market-news sentiment tracker built with Next.js. It pulls the newest CNBC market headlines as soon as they hit the feed, and uses `openai/gpt-oss-120b` through the Groq API to get a fast but thorough AI-generated estimate of how positively or negatively markets may react to each headline.

The app is designed as a compact, editorial-style market pulse rather than a full news portal. Each item links to the source article, and the detail modal includes the article timestamp, the model's market-reaction label, and a short reasoning string generated through Groq.

## What It Does

- Fetches recent CNBC market headlines through the RSS-to-JSON API
- Normalizes and sorts feed items server-side
- Keeps a rolling set of the newest 5 stories
- Generates a market-reaction sentiment for each headline with Groq
- Caches sentiment responses in Redis to avoid repeated model calls
- Shows a thin `epoll` header with the dominant market tone from the last 8 hours
- Keeps a rolling 8-hour article count alongside the `epoll` value
- Shows weekly and 30-day sentiment history grouped by US Eastern calendar date
- Collects the feed every 15 minutes through a signed QStash request
- Revalidates the homepage every 5 minutes on Vercel / Next.js ISR

## Tech Stack

- Next.js 15 App Router
- Node.js 24
- React 18
- TypeScript
- Tailwind CSS
- Axios for external feed requests
- Groq SDK for headline sentiment generation
- Strict JSON Schema outputs for GPT-OSS sentiment responses
- Redis via the `redis` Node client for sentiment caching and rolling `epoll` storage
- Vercel for deployment

## How The App Works

1. `app/page.tsx` renders the homepage on the server.
2. `lib/getNews.ts` fetches the CNBC feed from `rss2json`, normalizes titles, sorts by publish date, and slices the newest five visible items.
3. Each headline is passed to `lib/sentiment.ts`.
4. `lib/sentiment.ts` checks Redis first. If a cached sentiment exists, it returns that value.
5. If the headline is not cached, the app sends the headline title to Groq, parses a strict JSON response, stores it in Redis, and returns the result.
6. `lib/epoll-store.ts` records recent analyzed articles into a Redis sorted set keyed by publish time and trims anything older than 8 hours.
7. A separate compact Redis hash stores unique direction/confidence pairs for each Eastern calendar date and expires them after 35 days.
8. The homepage reads the rolling set for the live pulse, while `/sentiment-history` reads the latest 30 daily hashes.
9. `app/components/epoll-badge.tsx` renders the thin header signal, and `app/components/news-list.tsx` renders the feed cards and modal UI.

## How `epoll` Is Calculated

`epoll` is a rolling 8-hour market pulse built from article-level sentiment that has already been evaluated by the app.

- Only articles inside the last 8 hours are included.
- Each included article contributes its sentiment direction (`up` or `down`) and its confidence score (`0-100`).
- The app sums confidence scores separately for `up` and `down` articles.
- The direction with the larger total confidence becomes the displayed arrow.
- The displayed percentage is the dominant side's share of the total confidence across that 8-hour window.
- If the weighted `up` and `down` totals are exactly equal, the header shows `mixed 50%`.
- The article counter shown next to `epoll` is the exact number of stored analyzed articles still inside the rolling 8-hour window.

Example:

- `up` articles: `88 + 70 = 158`
- `down` articles: `55`
- `epoll` direction: `up`
- `epoll` strength: `158 / (158 + 55) = 74%`

## Redis optimization For `MarketEpoll`
I'm working with a small redis cache. In order to fit everything, extra care had to be put into thoughtfully fitting in long term sentiment and articles.
The rolling `epoll` header does not store full article payloads. For the 8-hour window, Redis keeps only compact per-article entries containing:

- publish timestamp
- sentiment direction
- confidence
- a small dedupe hash

This is enough to keep an exact rolling 8-hour strength and article count without storing article titles, descriptions, links, or reasoning text in the rolling `epoll` set.

Daily history is compact as well: each date stores only a stable article hash plus its direction and confidence. Repeated page renders and QStash retries use `HSETNX`, so an article contributes at most once per day.

## Sentiment History Collection

The signed endpoint `POST /api/sentiment/collect` is designed for a QStash schedule because Vercel Hobby cannot run a native cron every 15 minutes.

Required production environment variables:

```text
GROQ_API_KEY=...
REDIS_URL=redis://...
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...
```

Create a QStash schedule with these settings:

```text
Destination: https://fin-website-s2mw.vercel.app/api/sentiment/collect
Method: POST
Cron: */15 * * * *
Retries: 3
Body: {}
```

The QStash management token is not needed by the deployed app. Keep it in the QStash console or local setup tooling rather than adding it to Vercel.

## Local And Preview Simulation

The history page can run with deterministic sample articles without Redis, Groq, or QStash. This exercises the real 30-day aggregation and interactive chart while keeping simulated records entirely in memory.

Run it locally:

```bash
npm run dev:fixtures
```

Then open `http://localhost:3000/sentiment-history`. A visible simulation banner confirms that fixture mode is active. To verify the deployable production bundle with the same fixture path, run:

```bash
npm run build:fixtures
```

For a Vercel Preview, add `SENTIMENT_HISTORY_FIXTURES=1` scoped to **Preview** only, then redeploy the Preview. The code also refuses to enable fixtures when `VERCEL_ENV=production`, even if the variable is accidentally present there. Remove the Preview variable after acceptance testing so later previews exercise the configured Redis and QStash integration.

## Project Structure

```text
app/
  components/
    epoll-badge.tsx    Thin rolling header indicator
    news-list.tsx      Feed cards, sentiment badge, and article modal
  globals.css          Global theme, tokens, and layout styles
  layout.tsx           Root layout and metadata
  page.tsx             Homepage entrypoint

lib/
  epoll-store.ts       Rolling 8-hour Redis-backed epoll storage
  epoll.ts             Epoll summary math and parsing helpers
  getNews.ts           Homepage snapshot assembly
  news-feed.ts         CNBC feed fetch + UTC timestamp normalization
  redis.ts             Shared Redis client setup
  sentiment.ts         Groq sentiment generation + Redis cache
  sentiment-history.ts Daily sentiment math and Eastern date helpers
  sentiment-history-store.ts Redis-backed 30-day history storage
  types.ts             Shared news item and sentiment types
  utils.ts             Shared utility helpers
```
