import test from "node:test"
import assert from "node:assert/strict"

import { normalizeFeedTitle, parseRssPublishedAt } from "../lib/news-feed"

test("parses rss2json timestamps as UTC instead of local server time", () => {
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

test("normalizes encoded ampersands and bare S&P references", () => {
  assert.equal(
    normalizeFeedTitle("Markets &amp; the S&P close higher"),
    "Markets & the S&P 500 close higher",
  )
  assert.equal(normalizeFeedTitle("S&P 500 closes higher"), "S&P 500 closes higher")
})
