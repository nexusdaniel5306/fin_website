# MarketEpoll

MarketEpoll is a lightweight market-news sentiment tracker built with Next.js. It pulls the newest CNBC market headlines as soon as they hit the feed, and utlilzes llama-3.3-70b-versatile through the Groq API to get a blazing fast but thorough AI-generated estimate of how positively or negatively markets may react to each headline.

The app is designed as a compact, editorial-style market pulse rather than a full news portal. Each item links to the source article, and the detail modal includes the article timestamp, the model's market-reaction label, and a short reasoning string generated through Groq.

## What It Does

- Fetches recent CNBC market headlines through the RSS-to-JSON API
- Normalizes and sorts feed items server-side
- Keeps a rolling set of the newest 5 stories
- Generates a market-reaction sentiment for each headline with Groq
- Caches sentiment responses in Redis to avoid repeated model calls
- Revalidates the homepage every 5 minutes on Vercel / Next.js ISR

## Tech Stack

- Next.js 15 App Router
- React 18
- TypeScript
- Tailwind CSS
- Axios for external feed requests
- Groq SDK for headline sentiment generation
- Redis via the `redis` Node client for sentiment caching
- Vercel for deployment

## How The App Works

1. `app/page.tsx` renders the homepage on the server.
2. `lib/getNews.ts` fetches the CNBC feed from `rss2json`, normalizes titles, sorts by publish date, and slices the newest five items.
3. Each headline is passed to `lib/sentiment.ts`.
4. `lib/sentiment.ts` checks Redis first. If a cached sentiment exists, it returns that value.
5. If the headline is not cached, the app sends the headline title to Groq, parses a strict JSON response, stores it in Redis, and returns the result.
6. `app/components/news-list.tsx` renders the feed cards and modal UI.

## Project Structure

```text
app/
  components/
    news-list.tsx      Feed cards, sentiment badge, and article modal
  globals.css          Global theme, tokens, and layout styles
  layout.tsx           Root layout and metadata
  page.tsx             Homepage entrypoint

lib/
  getNews.ts           CNBC feed fetch + normalization + top-5 selection
  sentiment.ts         Groq sentiment generation + Redis cache
  types.ts             Shared news item and sentiment types
  utils.ts             Shared utility helpers
```
