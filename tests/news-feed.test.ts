import test from "node:test"
import assert from "node:assert/strict"

import {
  CNBC_FEED_URLS,
  dedupeAndSortFeedItems,
  fetchNewsFeed,
  normalizeFeedDescription,
  normalizeFeedTitle,
  parseRssFeed,
  parseRssPublishedAt,
  type FeedNewsItem,
} from "../lib/news-feed"

test("parses legacy feed timestamps as UTC instead of local server time", () => {
  assert.equal(
    parseRssPublishedAt("2026-06-27 19:11:21"),
    "2026-06-27T19:11:21.000Z",
  )
})

test("preserves explicit source timezones and rejects malformed timestamps", () => {
  assert.equal(
    parseRssPublishedAt("Sat, 27 Jun 2026 19:11:21 GMT"),
    "2026-06-27T19:11:21.000Z",
  )
  assert.equal(parseRssPublishedAt("not-a-date"), null)
})

test("parses direct CNBC RSS XML and normalizes text fields", () => {
  const items = parseRssFeed(
    `
      <rss><channel>
        <item>
          <title><![CDATA[Markets &amp; the S&amp;P close higher]]></title>
          <description><![CDATA[<p>Stocks rose &amp; yields fell.</p>]]></description>
          <pubDate>Sat, 27 Jun 2026 19:11:21 -0400</pubDate>
          <link>https://www.cnbc.com/2026/06/27/story.html?utm_source=rss&amp;cid=foo</link>
          <guid isPermaLink="false">story-123</guid>
        </item>
        <item><title>Missing date</title><link>https://example.com/missing</link></item>
      </channel></rss>
    `,
    "finance",
  )

  assert.deepEqual(items, [
    {
      title: "Markets & the S&P 500 close higher",
      description: "Stocks rose & yields fell.",
      date: "2026-06-27T23:11:21.000Z",
      link: "https://www.cnbc.com/2026/06/27/story.html?utm_source=rss&cid=foo",
      guid: "story-123",
      feed: "finance",
    },
  ])
  assert.equal(normalizeFeedDescription("<![CDATA[<p>A &amp; B</p>]]>"), "A & B")
})

test("defines only the three focused primary feeds", () => {
  assert.deepEqual(Object.keys(CNBC_FEED_URLS), ["finance", "earnings", "economy"])
  assert.equal(
    CNBC_FEED_URLS.finance,
    "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
  )
  assert.equal(
    CNBC_FEED_URLS.earnings,
    "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135",
  )
  assert.equal(
    CNBC_FEED_URLS.economy,
    "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258",
  )
})

test("fetches primary feeds concurrently while tolerating an individual failure", async () => {
  const requestedUrls: string[] = []
  const originalConsoleError = console.error
  console.error = () => {}

  try {
    const items = await fetchNewsFeed(async (input) => {
        const url = String(input)
        requestedUrls.push(url)

        if (url === CNBC_FEED_URLS.earnings) {
          throw new Error("simulated feed outage")
        }

        const feed = url === CNBC_FEED_URLS.finance ? "finance" : "economy"
        return new Response(
          `<rss><channel><item><title>${feed} report</title><description>Markets update</description><pubDate>Sat, 27 Jun 2026 19:11:21 GMT</pubDate><link>https://www.cnbc.com/${feed}</link><guid>${feed}</guid></item></channel></rss>`,
          { status: 200 },
        )
    })

    assert.deepEqual(requestedUrls.sort(), [
      CNBC_FEED_URLS.economy,
      CNBC_FEED_URLS.earnings,
      CNBC_FEED_URLS.finance,
    ].sort())
    assert.deepEqual(
      items.map(({ feed }) => feed).sort(),
      ["economy", "finance"],
    )
  } finally {
    console.error = originalConsoleError
  }
})

test("deduplicates by canonical link or GUID and sorts newest first", () => {
  const item = (overrides: Partial<FeedNewsItem>): FeedNewsItem => ({
    title: "Story",
    description: "Description",
    date: "2026-06-27T18:00:00.000Z",
    link: "https://www.cnbc.com/story",
    guid: null,
    feed: "finance",
    ...overrides,
  })

  const result = dedupeAndSortFeedItems([
    item({
      title: "Oldest",
      date: "2026-06-27T16:00:00.000Z",
      link: "https://www.cnbc.com/oldest",
      guid: "oldest",
    }),
    item({
      title: "Same URL",
      date: "2026-06-27T18:00:00.000Z",
      link: "https://www.cnbc.com/story/?utm_medium=rss#details",
      guid: "different-guid",
    }),
    item({
      title: "Same GUID",
      date: "2026-06-27T17:00:00.000Z",
      link: "https://www.cnbc.com/different-url",
      guid: "oldest",
    }),
    item({
      title: "Newest",
      date: "2026-06-27T19:00:00.000Z",
      link: "https://www.cnbc.com/newest",
      guid: "newest",
    }),
  ])

  assert.deepEqual(result.map(({ title }) => title), ["Newest", "Same URL", "Same GUID"])
})

test("normalizes encoded ampersands and bare S&P references", () => {
  assert.equal(
    normalizeFeedTitle("Markets &amp; the S&P close higher"),
    "Markets & the S&P 500 close higher",
  )
  assert.equal(normalizeFeedTitle("S&P 500 closes higher"), "S&P 500 closes higher")
})
