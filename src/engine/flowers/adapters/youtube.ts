/* ============================================================
   📺 YouTube Adapter
   
   通过 YouTube Data API v3 搜索视频。
   需要 API Key（免费额度 10000 单位/天）。
   申请: https://console.cloud.google.com/apis/credentials
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions, TrendingOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

export const youtubeAdapter: FlowerAdapter = {
  type: "youtube",
  name: "YouTube",
  icon: "📺",
  description: "YouTube 视频搜索",
  capabilities: ["search", "trending", "media"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const apiKey = config.apiKey;
    if (!apiKey) throw new Error("YouTube: 需要配置 API Key（Google Cloud Console 申请）");

    const maxResults = Math.min(options?.maxResults || config.maxResults || 10, 50);

    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      maxResults: String(maxResults),
      key: apiKey,
      order: options?.sortBy === "date" ? "date" : options?.sortBy === "popularity" ? "viewCount" : "relevance",
    });

    // 语言/地区
    if (options?.language || config.language) {
      params.set("relevanceLanguage", options?.language || config.language || "zh");
    }
    if (config.region) {
      params.set("regionCode", config.region);
    }

    // 时间范围
    if (options?.timeRange && options.timeRange !== "all") {
      const now = new Date();
      const ranges: Record<string, number> = {
        hour: 3600 * 1000,
        day: 86400 * 1000,
        week: 604800 * 1000,
        month: 2592000 * 1000,
        year: 31536000 * 1000,
      };
      const ms = ranges[options.timeRange];
      if (ms) {
        params.set("publishedAfter", new Date(now.getTime() - ms).toISOString());
      }
    }

    const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;

    const response = await proxyFetch(url, {
      headers: config.customHeaders,
    });

    if (!response.ok) {
      const err = await response.text();
      if (response.status === 403) {
        throw new Error("YouTube: API Key 无效或配额已用完");
      }
      throw new Error(`YouTube API error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const items = data.items || [];

    return items.map((item: YTSearchItem) => {
      const snippet = item.snippet;
      const videoId = item.id.videoId;
      return {
        id: `yt_${videoId}`,
        sourceId: "",
        sourceType: "youtube" as const,
        sourceName: "YouTube",
        title: snippet.title,
        content: `${snippet.title}\n\n${snippet.description}\n\n频道: ${snippet.channelTitle}\n发布时间: ${snippet.publishedAt}`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        author: snippet.channelTitle,
        publishedAt: snippet.publishedAt,
        metadata: {
          videoId,
          channelId: snippet.channelId,
          channelTitle: snippet.channelTitle,
          thumbnails: snippet.thumbnails,
          liveBroadcastContent: snippet.liveBroadcastContent,
        },
        fetchedAt: Date.now(),
      };
    });
  },

  async validateConfig(config: SourceConfig): Promise<boolean> {
    return !!config.apiKey;
  },

  async trending(config: SourceConfig, options?: TrendingOptions): Promise<SourceResult[]> {
    const apiKey = config.apiKey;
    if (!apiKey) throw new Error("YouTube: 需要配置 API Key");

    const limit = Math.min(options?.limit || 20, 50);
    const regionCode = options?.region || config.region || "US";

    const params = new URLSearchParams({
      part: "snippet,statistics",
      chart: "mostPopular",
      maxResults: String(limit),
      regionCode,
      key: apiKey,
    });

    if (options?.category) {
      params.set("videoCategoryId", options.category);
    }

    const url = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;

    const response = await proxyFetch(url, {
      headers: config.customHeaders,
    });

    if (!response.ok) {
      throw new Error(`YouTube trending error: ${response.status}`);
    }

    const data = await response.json();
    const items = data.items || [];

    return items.map((item: YTVideoItem, i: number) => {
      const snippet = item.snippet;
      const stats = item.statistics || {};
      return {
        id: `yt_trend_${item.id}`,
        sourceId: "",
        sourceType: "youtube" as const,
        sourceName: "YouTube Trending",
        title: `📺 ${snippet.title}`,
        content: `${snippet.description?.slice(0, 300) || ""}\n\n频道: ${snippet.channelTitle}\n观看: ${formatNumber(stats.viewCount)} | 点赞: ${formatNumber(stats.likeCount)}`,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        author: snippet.channelTitle,
        publishedAt: snippet.publishedAt,
        metadata: {
          rank: i + 1,
          videoId: item.id,
          viewCount: Number(stats.viewCount) || 0,
          likeCount: Number(stats.likeCount) || 0,
          commentCount: Number(stats.commentCount) || 0,
        },
        fetchedAt: Date.now(),
      };
    });
  },
};

// ─── 辅助函数 ───

function formatNumber(num: string | number | undefined): string {
  if (!num) return "0";
  const n = Number(num);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface YTSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: Record<string, { url: string; width: number; height: number }>;
    liveBroadcastContent: string;
  };
}

interface YTVideoItem {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}
