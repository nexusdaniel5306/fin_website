export const CNBC_FEED_URLS = {
  finance:
    "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
  earnings:
    "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135",
  economy:
    "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258",
} as const

export type NewsFeedName = keyof typeof CNBC_FEED_URLS

const PRIMARY_FEEDS: readonly NewsFeedName[] = ["finance", "earnings", "economy"]
const RSS_FETCH_TIMEOUT_MS = 8000
const RSS_DATE_PATTERN = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/
const RSS_ITEM_PATTERN = /<item\b[^>]*>([\s\S]*?)<\/item>/gi

export const NEWS_LIST_LIMIT = 5

export interface FeedNewsItem {
  title: string
  description: string
  date: string
  link: string
  guid: string | null
  feed: NewsFeedName
}

export type NewsFeedFetcher = typeof fetch

const XML_ENTITY_NAMES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const readXmlElement = (xml: string, tagName: string): string => {
  const escapedTagName = escapeRegExp(tagName)
  const match = new RegExp(
    `<${escapedTagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTagName}>`,
    "i",
  ).exec(xml)

  return match?.[1] ?? ""
}

const decodeXmlEntities = (value: string) =>
  value.replace(
    /&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi,
    (entity, encodedValue: string) => {
      const normalizedEntity = encodedValue.toLowerCase()

      if (normalizedEntity.startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(normalizedEntity.slice(2), 16))
      }

      if (normalizedEntity.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(normalizedEntity.slice(1), 10))
      }

      return XML_ENTITY_NAMES[normalizedEntity] ?? entity
    },
  )

const normalizeXmlText = (value: string, stripMarkup = false) => {
  const withoutCdata = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
  const decoded = decodeXmlEntities(withoutCdata)
  const withoutMarkup = stripMarkup
    ? decoded
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/p\s*>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    : decoded

  return withoutMarkup.replace(/\s+/g, " ").trim()
}

export const parseRssPublishedAt = (value: string): string | null => {
  const cleanValue = value.trim()
  const legacyDateMatch = RSS_DATE_PATTERN.exec(cleanValue)
  const timestamp = legacyDateMatch
    ? `${legacyDateMatch[1]}T${legacyDateMatch[2]}Z`
    : cleanValue
  const parsed = new Date(timestamp)

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export const normalizeFeedTitle = (title: string) =>
  normalizeXmlText(title, true).replace(/\bS&P\b(?!\s*500)/g, "S&P 500")

export const normalizeFeedDescription = (description: string) =>
  normalizeXmlText(description, true)

export const canonicalizeNewsLink = (link: string) => {
  const cleanLink = normalizeXmlText(link)

  if (!cleanLink) {
    return ""
  }

  try {
    const url = new URL(cleanLink)
    url.hash = ""

    for (const parameter of [...url.searchParams.keys()]) {
      if (/^(?:utm_|cid$|source$|__source$)/i.test(parameter)) {
        url.searchParams.delete(parameter)
      }
    }

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "")
    }

    return url.toString()
  } catch {
    return cleanLink.replace(/\/+$/, "")
  }
}

export const getFeedItemKeys = (item: Pick<FeedNewsItem, "link" | "guid">) => {
  const keys: string[] = []
  const canonicalLink = canonicalizeNewsLink(item.link)
  const guid = normalizeXmlText(item.guid ?? "").toLowerCase()

  if (canonicalLink) {
    keys.push(`link:${canonicalLink}`)
  }

  if (guid) {
    keys.push(`guid:${guid}`)
  }

  return keys
}

export const dedupeAndSortFeedItems = (items: FeedNewsItem[]) => {
  const seenKeys = new Set<string>()
  const uniqueItems: FeedNewsItem[] = []
  const sortedItems = [...items].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  for (const item of sortedItems) {
    const keys = getFeedItemKeys(item)

    if (keys.length > 0 && keys.some((key) => seenKeys.has(key))) {
      continue
    }

    keys.forEach((key) => seenKeys.add(key))
    uniqueItems.push(item)
  }

  return uniqueItems
}

export const parseRssFeed = (xml: string, feed: NewsFeedName): FeedNewsItem[] =>
  [...xml.matchAll(RSS_ITEM_PATTERN)]
    .map((match): FeedNewsItem | null => {
      const itemXml = match[1]
      const title = normalizeFeedTitle(readXmlElement(itemXml, "title"))
      const description = normalizeFeedDescription(readXmlElement(itemXml, "description"))
      const publishedAt = parseRssPublishedAt(
        readXmlElement(itemXml, "pubDate") || readXmlElement(itemXml, "dc:date"),
      )
      const link = normalizeXmlText(readXmlElement(itemXml, "link"))
      const guid = normalizeXmlText(readXmlElement(itemXml, "guid")) || null

      if (!title || !publishedAt || !link) {
        return null
      }

      return {
        title,
        description,
        date: publishedAt,
        link,
        guid,
        feed,
      }
    })
    .filter((item): item is FeedNewsItem => item !== null)

const fetchFeed = async (
  feed: NewsFeedName,
  fetcher: NewsFeedFetcher,
): Promise<FeedNewsItem[]> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RSS_FETCH_TIMEOUT_MS)

  try {
    const response = await fetcher(CNBC_FEED_URLS[feed], {
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`CNBC RSS returned HTTP ${response.status}`)
    }

    return parseRssFeed(await response.text(), feed)
  } finally {
    clearTimeout(timeoutId)
  }
}

const fetchFeedGroup = async (
  feeds: readonly NewsFeedName[],
  fetcher: NewsFeedFetcher,
) => {
  const results = await Promise.all(
    feeds.map(async (feed) => {
      try {
        return await fetchFeed(feed, fetcher)
      } catch (error) {
        console.error("CNBC RSS feed fetch failed", { feed, error })
        return []
      }
    }),
  )

  return dedupeAndSortFeedItems(results.flat())
}

export const fetchNewsFeed = async (
  fetcher: NewsFeedFetcher = fetch,
): Promise<FeedNewsItem[]> => fetchFeedGroup(PRIMARY_FEEDS, fetcher)
