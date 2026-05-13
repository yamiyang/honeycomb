/* ============================================================
   🧡 Hacker News Adapter
   
   通过 Algolia HN Search API 搜索 Hacker News 帖子和评论。
   完全免费，无需 API key。
   https://hn.algolia.com/api
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions, TrendingOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

export const hackernewsAdapter: FlowerAdapter = {
  type: "hackernews",
  name: "Hacker News",
  icon: "🧡",
  description: "Hacker News 技术社区搜索",
  capabilities: ["search", "trending", "comments"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const maxResults = options?.maxResults || config.maxResults || 10;
    const baseUrl = "https://hn.algolia.com/api/v1";

    const params = new URLSearchParams({
      query,
      hitsPerPage: String(maxResults),
      tags: "story",  // 搜索帖子
    });

    // 时间范围
    if (options?.timeRange) {
      const now = Math.floor(Date.now() / 1000);
      const ranges: Record<string, number> = {
        hour: now - 3600,
        day: now - 86400,
        week: now - 604800,
        month: now - 2592000,
        year: now - 31536000,
      };
      const start = ranges[options.timeRange];
      if (start) {
        params.set("numericFilters", `created_at_i>${start}`);
      }
    }

    // 排序
    const endpoint = options?.sortBy === "date" ? "search_by_date" : "search";
    const url = `${baseUrl}/${endpoint}?${params.toString()}`;

    const response = await proxyFetch(url, {
      headers: config.customHeaders,
    });

    if (!response.ok) {
      throw new Error(`HN API error: ${response.status}`);
    }

    const data = await response.json();
    const hits = data.hits || [];

    return hits.map((hit: HNHit) => ({
      id: `hn_${hit.objectID}`,
      sourceId: "",
      sourceType: "hackernews" as const,
      sourceName: "Hacker News",
      title: hit.title || hit.story_title || "Untitled",
      content: `${hit.title || hit.story_title || ""}\n\n${hit.url ? `Link: ${hit.url}` : ""}\nPoints: ${hit.points || 0} | Comments: ${hit.num_comments || 0}\nBy: ${hit.author}`,
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      author: hit.author,
      publishedAt: hit.created_at,
      metadata: {
        objectID: hit.objectID,
        points: hit.points,
        numComments: hit.num_comments,
        hnUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      },
      fetchedAt: Date.now(),
    }));
  },

  async validateConfig(): Promise<boolean> {
    // HN API 不需要 key
    return true;
  },

  async trending(config: SourceConfig, options?: TrendingOptions): Promise<SourceResult[]> {
    const limit = options?.limit || 20;
    const url = `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${limit}`;

    const response = await proxyFetch(url);
    if (!response.ok) {
      throw new Error(`HN trending error: ${response.status}`);
    }

    const data = await response.json();
    const hits = data.hits || [];

    return hits.map((hit: HNHit, i: number) => ({
      id: `hn_front_${hit.objectID}`,
      sourceId: "",
      sourceType: "hackernews" as const,
      sourceName: "Hacker News Front Page",
      title: `🧡 ${hit.title || "Untitled"} (${hit.points || 0}↑)`,
      content: `${hit.title || ""}\nPoints: ${hit.points} | Comments: ${hit.num_comments}\nAuthor: ${hit.author}`,
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      author: hit.author,
      publishedAt: hit.created_at,
      metadata: {
        rank: i + 1,
        objectID: hit.objectID,
        points: hit.points,
        numComments: hit.num_comments,
      },
      fetchedAt: Date.now(),
    }));
  },
};

interface HNHit {
  objectID: string;
  title: string | null;
  story_title: string | null;
  url: string | null;
  author: string;
  points: number;
  num_comments: number;
  created_at: string;
}
