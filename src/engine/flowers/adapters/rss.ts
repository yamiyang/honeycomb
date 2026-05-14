/* ============================================================
   📡 RSS Feeds Adapter
   
   通过 RSS/Atom 订阅源获取内容。
   完全免费，无需 API Key。
   
   支持功能：
   - 搜索：在已订阅的 RSS 源中搜索关键词
   - 实时：获取最新文章
   - 自定义源：用户可添加任意 RSS 地址
   
   配置：
   - searchParams.feeds: 逗号分隔的 RSS 地址列表
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions, TrendingOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

/** 默认 RSS 源（技术类） */
const DEFAULT_FEEDS = [
  "https://hnrss.org/newest",                          // Hacker News
  "https://feeds.arstechnica.com/arstechnica/index",   // Ars Technica
  "https://www.theverge.com/rss/index.xml",            // The Verge
  "https://blog.rust-lang.org/feed.xml",               // Rust Blog
  "https://github.blog/feed/",                         // GitHub Blog
  "https://engineering.fb.com/feed/",                  // Meta Engineering
];

export const rssAdapter: FlowerAdapter = {
  type: "rss",
  name: "RSS Feeds",
  icon: "📡",
  description: "RSS/Atom 订阅源聚合（免费，无需 Key）",
  capabilities: ["search", "realtime"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const maxResults = options?.maxResults || config.maxResults || 15;
    const feeds = getFeeds(config);

    // 并行获取所有 RSS 源
    const allItems = await fetchMultipleFeeds(feeds, config);

    // 在结果中搜索关键词
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter(Boolean);

    const matched = allItems.filter(item => {
      const text = `${item.title} ${item.content}`.toLowerCase();
      return keywords.some(kw => text.includes(kw));
    });

    // 按相关度排序（匹配关键词越多越靠前）
    matched.sort((a, b) => {
      const textA = `${a.title} ${a.content}`.toLowerCase();
      const textB = `${b.title} ${b.content}`.toLowerCase();
      const scoreA = keywords.filter(kw => textA.includes(kw)).length;
      const scoreB = keywords.filter(kw => textB.includes(kw)).length;
      return scoreB - scoreA;
    });

    return matched.slice(0, maxResults);
  },

  async validateConfig(): Promise<boolean> {
    // RSS 不需要认证
    return true;
  },

  async trending(config: SourceConfig, options?: TrendingOptions): Promise<SourceResult[]> {
    const limit = options?.limit || 20;
    const feeds = getFeeds(config);

    // 获取最新文章
    const allItems = await fetchMultipleFeeds(feeds, config);

    // 按时间排序
    allItems.sort((a, b) => {
      const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return timeB - timeA;
    });

    return allItems.slice(0, limit);
  },
};

// ─── 辅助函数 ───

/** 获取配置的 RSS 源列表 */
function getFeeds(config: SourceConfig): string[] {
  if (config.searchParams?.feeds) {
    return config.searchParams.feeds
      .split(",")
      .map(f => f.trim())
      .filter(Boolean);
  }
  return DEFAULT_FEEDS;
}

/** 并行获取多个 RSS 源 */
async function fetchMultipleFeeds(
  feeds: string[],
  config: SourceConfig
): Promise<SourceResult[]> {
  const promises = feeds.map(feedUrl =>
    fetchSingleFeed(feedUrl, config).catch(err => {
      console.warn(`[RSS] Failed to fetch ${feedUrl}:`, err.message);
      return [] as SourceResult[];
    })
  );

  const results = await Promise.all(promises);
  return results.flat();
}

/** 获取单个 RSS 源并解析 */
async function fetchSingleFeed(
  feedUrl: string,
  config: SourceConfig
): Promise<SourceResult[]> {
  const response = await proxyFetch(feedUrl, {
    headers: {
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      ...config.customHeaders,
    },
  });

  if (!response.ok) {
    throw new Error(`RSS fetch error: ${response.status} for ${feedUrl}`);
  }

  const xml = await response.text();
  return parseRSSXml(xml, feedUrl);
}

/** 解析 RSS/Atom XML */
function parseRSSXml(xml: string, feedUrl: string): SourceResult[] {
  const results: SourceResult[] = [];

  // 检测是 RSS 还是 Atom
  const isAtom = xml.includes("<feed") && xml.includes("xmlns=\"http://www.w3.org/2005/Atom\"");

  // 提取 feed 标题
  const feedTitleMatch = xml.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
  const feedTitle = feedTitleMatch ? decodeXml(feedTitleMatch[1]) : feedUrl;

  if (isAtom) {
    // Atom 格式
    const entries = xml.split(/<entry[\s>]/).slice(1);
    for (const entry of entries) {
      const item = parseAtomEntry(entry, feedTitle);
      if (item) results.push(item);
    }
  } else {
    // RSS 2.0 格式
    const items = xml.split(/<item[\s>]/).slice(1);
    for (const item of items) {
      const parsed = parseRSSItem(item, feedTitle);
      if (parsed) results.push(parsed);
    }
  }

  return results;
}

/** 解析 RSS 2.0 <item> */
function parseRSSItem(itemXml: string, feedTitle: string): SourceResult | null {
  const title = extractTag(itemXml, "title");
  const link = extractTag(itemXml, "link");
  const description = extractTag(itemXml, "description");
  const pubDate = extractTag(itemXml, "pubDate");
  const author = extractTag(itemXml, "author") || extractTag(itemXml, "dc:creator");
  const guid = extractTag(itemXml, "guid");

  if (!title && !link) return null;

  return {
    id: `rss_${hashCode(guid || link || title || "")}`,
    sourceId: "",
    sourceType: "rss",
    sourceName: `RSS: ${feedTitle}`,
    title: title || "Untitled",
    content: stripHtml(description || "").slice(0, 2000),
    url: link || "",
    author: author || undefined,
    publishedAt: pubDate ? new Date(pubDate).toISOString() : undefined,
    metadata: {
      feedTitle,
      guid,
    },
    fetchedAt: Date.now(),
  };
}

/** 解析 Atom <entry> */
function parseAtomEntry(entryXml: string, feedTitle: string): SourceResult | null {
  const title = extractTag(entryXml, "title");

  // Atom link 是 <link href="..." />
  const linkMatch = entryXml.match(/<link[^>]*href="([^"]+)"[^>]*(?:rel="alternate")?/);
  const link = linkMatch ? linkMatch[1] : "";

  const summary = extractTag(entryXml, "summary") || extractTag(entryXml, "content");
  const published = extractTag(entryXml, "published") || extractTag(entryXml, "updated");
  const authorName = entryXml.match(/<author[^>]*>[\s\S]*?<name>([^<]+)<\/name>/)?.[1];
  const id = extractTag(entryXml, "id");

  if (!title && !link) return null;

  return {
    id: `rss_${hashCode(id || link || title || "")}`,
    sourceId: "",
    sourceType: "rss",
    sourceName: `RSS: ${feedTitle}`,
    title: title || "Untitled",
    content: stripHtml(summary || "").slice(0, 2000),
    url: link || "",
    author: authorName || undefined,
    publishedAt: published || undefined,
    metadata: {
      feedTitle,
      atomId: id,
    },
    fetchedAt: Date.now(),
  };
}

/** 提取 XML 标签内容 */
function extractTag(xml: string, tag: string): string {
  // 支持 CDATA
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? decodeXml(match[1].trim()) : "";
}

/** 去除 HTML 标签 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** 解码 XML 实体 */
function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** 简单哈希 */
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
