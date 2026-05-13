/* ============================================================
   🐦 Twitter/X Adapter
   
   通过 Cookie 认证访问 Twitter/X 搜索。
   Twitter API v2 已收费，改用 Cookie + 内部接口方案。
   
   配置需要:
   - cookie: 从浏览器登录 x.com 后复制的 Cookie
   
   获取方式:
   1. 浏览器登录 x.com
   2. F12 → Network → 任意请求 → 复制 Cookie 头
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions, TrendingOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

// Twitter 内部 API 的固定 Bearer Token（公开的，用于未认证请求的 guest token 获取）
const TWITTER_PUBLIC_BEARER = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

export const twitterAdapter: FlowerAdapter = {
  type: "twitter",
  name: "Twitter/X",
  icon: "🐦",
  description: "Twitter/X 社交媒体搜索（Cookie 认证）",
  capabilities: ["search", "trending", "realtime", "user_profile", "comments"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const cookie = config.cookie;
    if (!cookie) throw new Error("Twitter: 需要配置 Cookie（从浏览器登录 x.com 后获取）");

    // 从 cookie 中提取 csrf token
    const csrfToken = extractCsrfToken(cookie);
    if (!csrfToken) throw new Error("Twitter: Cookie 中未找到 ct0（csrf token），请重新复制完整 Cookie");

    const maxResults = Math.min(options?.maxResults || config.maxResults || 10, 20);

    // 构建搜索查询参数
    const variables = {
      rawQuery: query,
      count: maxResults,
      querySource: "typed_query",
      product: "Latest",
    };

    const features = {
      rweb_tipjar_consumption_enabled: true,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      articles_preview_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      rweb_video_timestamps_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_enhance_cards_enabled: false,
    };

    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(features),
    });

    const url = `https://x.com/i/api/graphql/MJpyQGqgklrVl_0X9gNy3A/SearchTimeline?${params.toString()}`;

    const response = await proxyFetch(url, {
      headers: {
        Authorization: `Bearer ${TWITTER_PUBLIC_BEARER}`,
        "x-csrf-token": csrfToken,
        Cookie: cookie,
        "x-twitter-active-user": "yes",
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-client-language": "zh-cn",
        ...config.customHeaders,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new Error("Twitter: Cookie 已过期，请重新登录 x.com 并复制新的 Cookie");
      }
      throw new Error(`Twitter API error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    
    // 解析 GraphQL 响应
    const tweets = extractTweetsFromTimeline(data);
    
    return tweets.slice(0, maxResults).map((tweet, i) => ({
      id: `twitter_${tweet.id}`,
      sourceId: "",
      sourceType: "twitter" as const,
      sourceName: "Twitter/X",
      title: `@${tweet.username}: ${tweet.text.slice(0, 80)}${tweet.text.length > 80 ? "..." : ""}`,
      content: tweet.text,
      url: `https://x.com/${tweet.username}/status/${tweet.id}`,
      author: `${tweet.name} (@${tweet.username})`,
      publishedAt: tweet.createdAt,
      metadata: {
        metrics: tweet.metrics,
        username: tweet.username,
        tweetId: tweet.id,
      },
      fetchedAt: Date.now(),
    }));
  },

  async validateConfig(config: SourceConfig): Promise<boolean> {
    return !!config.cookie && !!extractCsrfToken(config.cookie);
  },

  async trending(config: SourceConfig, options?: TrendingOptions): Promise<SourceResult[]> {
    const cookie = config.cookie;
    if (!cookie) throw new Error("Twitter: 需要配置 Cookie");

    const csrfToken = extractCsrfToken(cookie);
    if (!csrfToken) throw new Error("Twitter: Cookie 中未找到 ct0");

    // 使用 Explore 接口获取趋势
    const url = "https://x.com/i/api/2/guide.json?include_page_configuration=true&initial_tab_id=trending";

    const response = await proxyFetch(url, {
      headers: {
        Authorization: `Bearer ${TWITTER_PUBLIC_BEARER}`,
        "x-csrf-token": csrfToken,
        Cookie: cookie,
        "x-twitter-active-user": "yes",
        "x-twitter-auth-type": "OAuth2Session",
      },
    });

    if (!response.ok) {
      throw new Error(`Twitter trending error: ${response.status}`);
    }

    const data = await response.json();
    const limit = options?.limit || 20;

    // 从 guide 响应中提取趋势
    const trends = extractTrendsFromGuide(data);

    return trends.slice(0, limit).map((trend, i) => ({
      id: `twitter_trend_${Date.now()}_${i}`,
      sourceId: "",
      sourceType: "twitter" as const,
      sourceName: "Twitter/X Trending",
      title: trend.name,
      content: `趋势话题: ${trend.name} (${trend.tweetCount ? `${trend.tweetCount} tweets` : "trending"})`,
      url: `https://x.com/search?q=${encodeURIComponent(trend.name)}`,
      metadata: { tweetVolume: trend.tweetCount, rank: i + 1 },
      fetchedAt: Date.now(),
    }));
  },
};

// ─── 辅助函数 ───

/** 从 Cookie 字符串中提取 ct0 (csrf token) */
function extractCsrfToken(cookie: string): string | null {
  const match = cookie.match(/ct0=([^;]+)/);
  return match ? match[1] : null;
}

interface ParsedTweet {
  id: string;
  text: string;
  username: string;
  name: string;
  createdAt: string;
  metrics: { retweet_count: number; like_count: number; reply_count: number };
}

/** 从 GraphQL SearchTimeline 响应中提取推文 */
function extractTweetsFromTimeline(data: Record<string, unknown>): ParsedTweet[] {
  const tweets: ParsedTweet[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const instructions = (data as any)?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions || [];
    
    for (const instruction of instructions) {
      if (instruction.type !== "TimelineAddEntries") continue;
      
      for (const entry of instruction.entries || []) {
        const result = entry?.content?.itemContent?.tweet_results?.result;
        if (!result) continue;

        const tweetData = result.tweet || result;
        const legacy = tweetData?.legacy;
        const userLegacy = tweetData?.core?.user_results?.result?.legacy;

        if (!legacy || !userLegacy) continue;

        tweets.push({
          id: legacy.id_str || tweetData.rest_id,
          text: legacy.full_text || legacy.text || "",
          username: userLegacy.screen_name || "unknown",
          name: userLegacy.name || "Unknown",
          createdAt: legacy.created_at || "",
          metrics: {
            retweet_count: legacy.retweet_count || 0,
            like_count: legacy.favorite_count || 0,
            reply_count: legacy.reply_count || 0,
          },
        });
      }
    }
  } catch (e) {
    console.warn("[Twitter] Failed to parse timeline:", e);
  }

  return tweets;
}

/** 从 Guide 响应中提取趋势 */
function extractTrendsFromGuide(data: Record<string, unknown>): { name: string; tweetCount: number | null }[] {
  const trends: { name: string; tweetCount: number | null }[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const timeline = (data as any)?.timeline?.instructions || [];
    
    for (const instruction of timeline) {
      for (const entry of instruction.addEntries?.entries || []) {
        const items = entry?.content?.timelineModule?.items || [];
        for (const item of items) {
          const trend = item?.item?.content?.trend;
          if (trend?.name) {
            trends.push({
              name: trend.name,
              tweetCount: trend.trendMetadata?.metaDescription
                ? parseInt(trend.trendMetadata.metaDescription.replace(/[^0-9]/g, "")) || null
                : null,
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn("[Twitter] Failed to parse trends:", e);
  }

  return trends;
}
