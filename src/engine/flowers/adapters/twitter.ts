/* ============================================================
   🐦 Twitter/X Adapter
   
   通过 Twitter API v2 搜索推文、获取趋势。
   
   配置需要:
   - bearerToken: Twitter API Bearer Token
   - 或 apiKey + apiSecret 用于 OAuth
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions, TrendingOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

export const twitterAdapter: FlowerAdapter = {
  type: "twitter",
  name: "Twitter/X",
  icon: "🐦",
  description: "Twitter/X 社交媒体搜索",
  capabilities: ["search", "trending", "realtime", "user_profile", "comments"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const token = config.bearerToken || config.apiKey;
    if (!token) throw new Error("Twitter: Bearer Token required");

    const maxResults = Math.min(options?.maxResults || config.maxResults || 10, 100);
    const baseUrl = config.baseUrl || "https://api.twitter.com/2";

    const params = new URLSearchParams({
      query: query,
      max_results: String(maxResults),
      "tweet.fields": "created_at,author_id,public_metrics,entities",
      expansions: "author_id",
      "user.fields": "name,username,verified",
    });

    // Time range
    if (options?.timeRange) {
      const now = new Date();
      const startTime: Record<string, Date> = {
        hour: new Date(now.getTime() - 3600000),
        day: new Date(now.getTime() - 86400000),
        week: new Date(now.getTime() - 604800000),
        month: new Date(now.getTime() - 2592000000),
        year: new Date(now.getTime() - 31536000000),
      };
      const start = startTime[options.timeRange];
      if (start) {
        params.set("start_time", start.toISOString());
      }
    }

    // Sort
    if (options?.sortBy === "date") {
      params.set("sort_order", "recency");
    } else {
      params.set("sort_order", "relevancy");
    }

    const url = `${baseUrl}/tweets/search/recent?${params.toString()}`;
    const response = await proxyFetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...config.customHeaders,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Twitter API error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const tweets = data.data || [];
    const users = data.includes?.users || [];

    return tweets.map((tweet: {
      id: string;
      text: string;
      author_id: string;
      created_at: string;
      public_metrics: { retweet_count: number; like_count: number; reply_count: number };
    }, i: number) => {
      const author = users.find((u: { id: string; name: string; username: string }) => u.id === tweet.author_id);
      return {
        id: `twitter_${tweet.id}`,
        sourceId: "",
        sourceType: "twitter" as const,
        sourceName: "Twitter/X",
        title: `@${author?.username || "unknown"}: ${tweet.text.slice(0, 80)}...`,
        content: tweet.text,
        url: `https://x.com/${author?.username}/status/${tweet.id}`,
        author: author ? `${author.name} (@${author.username})` : undefined,
        publishedAt: tweet.created_at,
        metadata: {
          metrics: tweet.public_metrics,
          authorId: tweet.author_id,
          tweetId: tweet.id,
        },
        fetchedAt: Date.now(),
      };
    });
  },

  async validateConfig(config: SourceConfig): Promise<boolean> {
    return !!(config.bearerToken || config.apiKey);
  },

  async trending(config: SourceConfig, options?: TrendingOptions): Promise<SourceResult[]> {
    const token = config.bearerToken || config.apiKey;
    if (!token) throw new Error("Twitter: Bearer Token required");

    // 默认用全球趋势，woeid=1
    const woeid = options?.region || "1";
    const baseUrl = config.baseUrl || "https://api.twitter.com/1.1";
    const url = `${baseUrl}/trends/place.json?id=${woeid}`;

    const response = await proxyFetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Twitter trending error: ${response.status}`);
    }

    const data = await response.json();
    const trends = data[0]?.trends || [];
    const limit = options?.limit || 20;

    return trends.slice(0, limit).map((trend: { name: string; url: string; tweet_volume: number | null }, i: number) => ({
      id: `twitter_trend_${Date.now()}_${i}`,
      sourceId: "",
      sourceType: "twitter" as const,
      sourceName: "Twitter/X Trending",
      title: trend.name,
      content: `趋势话题: ${trend.name} (${trend.tweet_volume ? `${trend.tweet_volume} tweets` : "trending"})`,
      url: trend.url,
      metadata: { tweetVolume: trend.tweet_volume, rank: i + 1 },
      fetchedAt: Date.now(),
    }));
  },
};
