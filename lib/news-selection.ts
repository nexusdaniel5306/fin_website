import { isWithinEpollWindow } from "./epoll"
import {
  dedupeAndSortFeedItems,
  NEWS_LIST_LIMIT,
  type FeedNewsItem,
} from "./news-feed"
import {
  isMarketRelevantReporting,
  type NewsSentiment,
} from "./sentiment-response"

export interface AnalyzedFeedItem {
  feedItem: FeedNewsItem
  sentiment: NewsSentiment | null
}

export const ANALYSIS_CANDIDATE_BUFFER_SIZE = NEWS_LIST_LIMIT * 3

export const selectAnalysisCandidates = (
  items: FeedNewsItem[],
  now: Date,
  candidateBufferSize = ANALYSIS_CANDIDATE_BUFFER_SIZE,
) => {
  const sortedItems = dedupeAndSortFeedItems(items)
  const inWindowItems = sortedItems.filter((item) => isWithinEpollWindow(item.date, now))
  const newestBuffer = sortedItems.slice(0, Math.max(0, candidateBufferSize))

  return dedupeAndSortFeedItems([...inWindowItems, ...newestBuffer])
}

export const isAcceptedFeedItem = ({ sentiment }: AnalyzedFeedItem) =>
  sentiment !== null && isMarketRelevantReporting(sentiment)

export const getAcceptedFeedItems = (items: AnalyzedFeedItem[]) =>
  items.filter(isAcceptedFeedItem)

const sortByDate = (a: AnalyzedFeedItem, b: AnalyzedFeedItem) =>
  new Date(b.feedItem.date).getTime() - new Date(a.feedItem.date).getTime()

const NON_REPORTING_PATTERN =
  /\b(?:opinion|analysis|commentary|trade ideas?|stock picks?|personal finance|how to|investing advice|jim cramer|mad money)\b/i
const MARKET_TERM_PATTERN =
  /\b(?:market|stocks?|shares?|s&p|nasdaq|dow|bond|yield|treasur(?:y|ies)|rate|inflation|gdp|econom(?:y|ic)|earnings?|revenue|profit|oil|gold|currency|forex|bitcoin|crypto|tariff|trade|jobs|employment|fed|federal reserve|ipo|merger|acquisition|bank|banking|investment|fund|etf|commodit(?:y|ies))\b/i

export const isSafeUnclassifiedPrimaryItem = ({
  feedItem,
  sentiment,
}: AnalyzedFeedItem) => {
  if (sentiment !== null) {
    return false
  }

  const text = `${feedItem.title} ${feedItem.description}`

  return MARKET_TERM_PATTERN.test(text) && !NON_REPORTING_PATTERN.test(text)
}

export const selectVisibleFeedItems = (
  items: AnalyzedFeedItem[],
  visibleLimit = NEWS_LIST_LIMIT,
) => {
  const acceptedItems = getAcceptedFeedItems(items).sort(sortByDate)
  const safeUnclassifiedItems = items
    .filter(isSafeUnclassifiedPrimaryItem)
    .sort(sortByDate)

  return [...acceptedItems, ...safeUnclassifiedItems].slice(0, visibleLimit)
}
