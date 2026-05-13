/* ============================================================
   📺 Bilibili Adapter
   
   通过 Bilibili 搜索 API 搜索视频内容。
   完全免费，无需 API Key。
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions, TrendingOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

export const bilibiliAdapter: FlowerAdapter = {
  type: "bilibili",
  name: "Bilibili",
  icon: "📺",
  description: "B站视频搜索（免费，无需 Key）",
  capabilities: ["search", "trending", "media", "comments"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const maxResults = options?.maxResults || config.maxResults || 10;
    const page = 1;

    // 排序方式映射
    const orderMap: Record<string, string> = {
      relevance: "",        // 默认综合排序
      date: "pubdate",      // 最新发布
      popularity: "click",  // 最多播放
    };
    const order = orderMap[options?.sortBy || "relevance"] || "";

    // 时间范围
    let duration = "";
    if (options?.timeRange === "hour" || options?.timeRange === "day") {
      duration = "1"; // 10分钟以下
    }

    const params = new URLSearchParams({
      keyword: query,
      page: String(page),
      pagesize: String(maxResults),
      search_type: "video",
      ...(order && { order }),
      ...(duration && { duration }),
    });

    const url = `https://api.bilibili.com/x/web-interface/search/type?${params.toString()}`;

    const response = await proxyFetch(url, {
      headers: {
        Referer: "https://www.bilibili.com",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        ...config.customHeaders,
      },
    });

    if (!response.ok) {
      throw new Error(`Bilibili API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`Bilibili API error: ${data.message || data.code}`);
    }

    const items = data.data?.result || [];

    return items.slice(0, maxResults).map((item: BiliVideo) => ({
      id: `bili_${item.bvid || item.aid}`,
      sourceId: "",
      sourceType: "bilibili" as const,
      sourceName: "Bilibili",
      title: stripHtml(item.title),
      content: `${stripHtml(item.title)}\n\n${item.description || ""}\n\nUP主: ${item.author}\n播放: ${formatNumber(item.play)} | 弹幕: ${formatNumber(item.danmaku)} | 收藏: ${formatNumber(item.favorites)}\n时长: ${item.duration}`,
      url: `https://www.bilibili.com/video/${item.bvid}`,
      author: item.author,
      publishedAt: new Date(item.pubdate * 1000).toISOString(),
      metadata: {
        bvid: item.bvid,
        aid: item.aid,
        play: item.play,
        danmaku: item.danmaku,
        favorites: item.favorites,
        duration: item.duration,
        pic: item.pic?.startsWith("//") ? `https:${item.pic}` : item.pic,
        tag: item.tag,
        typeName: item.typename,
      },
      fetchedAt: Date.now(),
    }));
  },

  async validateConfig(): Promise<boolean> {
    // Bilibili 搜索不需要认证
    return true;
  },

  async trending(_config: SourceConfig, options?: TrendingOptions): Promise<SourceResult[]> {
    const limit = options?.limit || 20;

    // 使用热门视频接口
    const url = `https://api.bilibili.com/x/web-interface/popular?ps=${limit}&pn=1`;

    const response = await proxyFetch(url, {
      headers: {
        Referer: "https://www.bilibili.com",
      },
    });

    if (!response.ok) {
      throw new Error(`Bilibili trending error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`Bilibili trending error: ${data.message}`);
    }

    const items = data.data?.list || [];

    return items.slice(0, limit).map((item: BiliPopularVideo, i: number) => ({
      id: `bili_hot_${item.bvid || item.aid}`,
      sourceId: "",
      sourceType: "bilibili" as const,
      sourceName: "Bilibili 热门",
      title: `📺 ${item.title}`,
      content: `${item.desc || ""}\n\nUP主: ${item.owner?.name}\n播放: ${formatNumber(item.stat?.view)} | 点赞: ${formatNumber(item.stat?.like)}`,
      url: `https://www.bilibili.com/video/${item.bvid}`,
      author: item.owner?.name || "Unknown",
      publishedAt: new Date(item.pubdate * 1000).toISOString(),
      metadata: {
        rank: i + 1,
        bvid: item.bvid,
        aid: item.aid,
        view: item.stat?.view,
        like: item.stat?.like,
        danmaku: item.stat?.danmaku,
        pic: item.pic,
      },
      fetchedAt: Date.now(),
    }));
  },
};

// ─── 辅助函数 ───

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function formatNumber(num: number | undefined): string {
  if (!num) return "0";
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
  return String(num);
}

interface BiliVideo {
  bvid: string;
  aid: number;
  title: string;
  description: string;
  author: string;
  play: number;
  danmaku: number;
  favorites: number;
  duration: string;
  pubdate: number;
  pic: string;
  tag: string;
  typename: string;
}

interface BiliPopularVideo {
  bvid: string;
  aid: number;
  title: string;
  desc: string;
  pubdate: number;
  pic: string;
  owner?: { name: string; mid: number };
  stat?: {
    view: number;
    like: number;
    danmaku: number;
    reply: number;
  };
}
