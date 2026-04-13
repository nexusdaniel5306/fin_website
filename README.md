# MarketEpoll

MarketEpoll is a small Next.js App Router project that experiments with a simple idea: turn a live stream of financial headlines into a compact, readable market pulse. Right now the app renders a short list of recent CNBC market stories, adds a lightweight sentiment-style score to each item, and presents everything through a custom visual system instead of the default Next.js starter styling.

The project is still an early prototype, but the structure is already clear: one server-rendered page, one data-fetching boundary, and one shared styling layer that defines the brand look and feel.

## Concept

At a product level, this repo is exploring a finance interface built around three layers:

1. News ingestion: pull recent market-related headlines from an external feed.
2. Interpretation: attach a directional signal to each story so the feed feels closer to a market dashboard than a generic article list.
3. Presentation: display those stories in a visually opinionated, editorial-style layout.

In the current implementation, the ingestion layer is real, the presentation layer is real, and the interpretation layer is still placeholder logic. The `sentiment` score is currently generated with `Math.random()`, so the UI behaves like a sentiment-driven product without yet being backed by real analysis.

## Technical Structure

This app uses:

- Next.js 14 with the App Router
- React 18
- TypeScript
- Tailwind CSS
- `next/font` for typography
- `axios` for external data fetching
- `clsx` + `tailwind-merge` for class composition

### Request and render flow

The main request path is straightforward:

1. `app/page.tsx` runs on the server.
2. It calls `getNews()` from `lib/getNews.ts`.
3. `getNews()` requests CNBC RSS data through the `rss2json` API.
4. The feed items are normalized into a local `NewsItem` shape.
5. Items are sorted by publish date, trimmed to the five newest stories, and rendered into cards.
6. Each card shows title, description, date, external link, and an up/down indicator based on the generated sentiment value.

### Caching and freshness

The homepage is configured with `revalidate = 300`, so the project is intended to use incremental revalidation every 5 minutes. This keeps the page feeling fresh without requiring full per-request rendering.

## Project Layout

```text
app/
  favicon.ico
  globals.css        Global design tokens and base styles
  icons.tsx          Shared arrow icons used by the homepage
  layout.tsx         Root layout, font setup, global body classes
  msite.tsx          Older/static prototype component, not an active route
  page.tsx           Main homepage route

lib/
  getNews.ts         External news fetch + normalization
  utils.ts           `cn()` helper for merging class names

public/
  next.svg
  vercel.svg

README.md
components.json      shadcn/ui-style config metadata
next.config.mjs
postcss.config.mjs
tailwind.config.ts
tsconfig.json
```

## Important Files

### `app/page.tsx`

This is the active application surface. It is an async server component that fetches data before render and outputs the full homepage UI.

### `lib/getNews.ts`

This file is the current data layer. It defines the `NewsItem` interface and converts external RSS JSON into the local format the UI expects.

Two implementation details matter here:

- The app currently depends on a third-party RSS-to-JSON bridge rather than talking to a first-party market/news API.
- Sentiment is placeholder logic today, so this file is the most obvious extension point for future intelligence features.

### `app/layout.tsx`

The root layout sets the project typography using Google-hosted `DM Sans` for headings and `Space Mono` for body copy. Those font variables are then consumed by Tailwind classes in the global theme.

### `app/globals.css` and `tailwind.config.ts`

These two files define the design system. Instead of default Tailwind colors, the app uses CSS custom properties for background, foreground, card, accent, border, and typography settings. The palette leans warm and editorial, giving the product a more distinct finance-dashboard identity.

## Current Product State

What is already implemented:

- A working App Router setup
- A server-rendered homepage
- External news fetching
- A normalized local data shape
- A custom typography and color system
- A simple directional sentiment indicator in the UI

What is still prototype-level:

- Sentiment scoring is random, not analytical
- Error handling for failed news requests is minimal
- There is no loading/empty/error state strategy yet
- There are no tests
- There is only one active route
- `app/msite.tsx` appears to be a preserved mockup/reference component rather than part of the live app

## Local Development

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Build Notes

In this environment, `npm run build` could not complete because `next/font` tried to fetch Google Fonts and network access to `fonts.googleapis.com` was unavailable. That means the repo structure and code were reviewed directly, but production build verification depends on either network access or switching to a local/self-hosted font strategy.

## Where This Project Can Grow

The current architecture makes a few next steps especially natural:

- Replace random sentiment with real NLP or rule-based scoring
- Introduce ticker/company extraction from headlines
- Split the homepage into reusable feed, card, and sentiment components
- Add filtering by topic, asset class, or market regime
- Add a stronger data abstraction so the UI is not tied to one feed source
- Add tests around feed normalization and rendering behavior

## Summary

This repo is best understood as an early-stage financial news product prototype, not just a generic Next.js starter. The technical structure is intentionally small: one route, one fetch layer, one styling system. The conceptual structure is larger than the implementation: it is already aiming at a product that interprets financial news, not merely displays it.
