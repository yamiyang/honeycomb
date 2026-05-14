/* ============================================================
   🤖 Reddit Adapter
   
   通过 Reddit JSON API 搜索帖子和讨论。
   可使用公开 JSON endpoint (无需认证) 或 OAuth API。
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions, TrendingOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

export const redditAdapter: FlowerAdapter = {
  type: "reddit",
  name: "Reddit",
  icon: "🤖",
  description: "Reddit 社区讨论搜索",
  capabilities: ["search", "trending", "comments"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const maxResults = options?.maxResults || config.maxResults || 10;

    // 使用公开 JSON API (不需要 OAuth)
    const params = new URLSearchParams({
      q: query,
      limit: String(maxResults),
      sort: options?.sortBy === "date" ? "new" : options?.sortBy === "popularity" ? "top" : "relevance",
      restrict_sr: "false",
    });

    // 时间范围
    if (options?.timeRange) {
      params.set("t", options.timeRange === "all" ? "all" : options.timeRange);
    }

    const baseUrl = config.baseUrl || "https://www.reddit.com";
    const url = `${baseUrl}/search.json?${params.toString()}`;

    const response = await proxyFetch(url, {
      headers: {
        Accept: "application/json",
        ...config.customHeaders,
      },
    });

    // 检测 Reddit 的 IP 封锁（返回 HTML 而不是 JSON）
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || contentType.includes("text/html")) {
      const text = await response.text();
      if (text.includes("blocked") || text.includes("Blocked")) {
        throw new Error("Reddit IP blocked — 需要配置 Reddit API OAuth 或代理");
      }
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const data = await response.json();
    const posts = data.data?.children || [];

    return posts.map((child: { data: RedditPost }) => {
      const post = child.data;
      return {
        id: `reddit_${post.id}`,
        sourceId: "",
        sourceType: "reddit" as const,
        sourceName: `Reddit r/${post.subreddit}`,
        title: post.title,
        content: `${post.selftext?.slice(0, 2000) || post.title}\n\nSubreddit: r/${post.subreddit}\nScore: ${post.score} | Comments: ${post.num_comments}\nAuthor: u/${post.author}`,
        url: `https://www.reddit.com${post.permalink}`,
        author: `u/${post.author}`,
        publishedAt: new Date(post.created_utc * 1000).toISOString(),
        metadata: {
          subreddit: post.subreddit,
          score: post.score,
          numComments: post.num_comments,
          upvoteRatio: post.upvote_ratio,
          flair: post.link_flair_text,
          isNsfw: post.over_18,
        },
        fetchedAt: Date.now(),
      };
    });
  },

  async validateConfig(): Promise<boolean> {
    // 公开 API 不需要认证
    return true;
  },

  async getDetail(url: string): Promise<string | null> {
    // Reddit JSON API：在 URL 后加 .json
    try {
      const jsonUrl = url.endsWith("/") ? url + ".json" : url + "/.json";
      const response = await proxyFetch(jsonUrl, {
        headers: { "User-Agent": "HoneyComb/1.0" },
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) return null;

      // 帖子内容
      const post = data[0]?.data?.children?.[0]?.data;
      if (!post) return null;
      let content = `# ${post.title}\n\n${post.selftext || ""}\n\nScore: ${post.score} | Comments: ${post.num_comments}\n`;

      // 热门评论（前 5 条）
      const comments = data[1]?.data?.children?.slice(0, 5) || [];
      if (comments.length > 0) {
        content += "\n--- TOP COMMENTS ---\n";
        for (const c of comments) {
          const cData = c.data;
          if (cData?.body) {
            content += `\n[${cData.author}] (score: ${cData.score}): ${cData.body.slice(0, 500)}\n`;
          }
        }
      }
      return content.slice(0, 8000);
    } catch {
      return null;
    }
  },

  async trending(config: SourceConfig, options?: TrendingOptions): Promise<SourceResult[]> {
    const limit = options?.limit || 20;
    const subreddit = options?.category || "all";

    const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
    const response = await proxyFetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Reddit trending error: ${response.status}`);
    }

    const data = await response.json();
    const posts = data.data?.children || [];

    return posts.map((child: { data: RedditPost }, i: number) => {
      const post = child.data;
      return {
        id: `reddit_hot_${post.id}`,
        sourceId: "",
        sourceType: "reddit" as const,
        sourceName: `Reddit r/${post.subreddit}`,
        title: `🤖 ${post.title} (${post.score}↑)`,
        content: `${post.selftext?.slice(0, 1000) || ""}\n\nr/${post.subreddit} | ${post.num_comments} comments`,
        url: `https://www.reddit.com${post.permalink}`,
        author: `u/${post.author}`,
        publishedAt: new Date(post.created_utc * 1000).toISOString(),
        metadata: {
          rank: i + 1,
          subreddit: post.subreddit,
          score: post.score,
          numComments: post.num_comments,
        },
        fetchedAt: Date.now(),
      };
    });
  },
};

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  subreddit: string;
  author: string;
  score: number;
  num_comments: number;
  upvote_ratio: number;
  permalink: string;
  created_utc: number;
  link_flair_text: string | null;
  over_18: boolean;
}
