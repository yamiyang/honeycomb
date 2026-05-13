/* ============================================================
   🔎 Searx Adapter
   
   通过公共 Searx/SearXNG 实例搜索。
   完全免费，无需 API Key，无需注册。
   
   Searx 是开源的元搜索引擎，聚合 Google、Bing、DuckDuckGo 等
   多个搜索引擎的结果，且注重隐私。
   
   公共实例列表: https://searx.space/
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

/** 公共 SearXNG 实例列表（按可靠性排序） */
const PUBLIC_INSTANCES = [
  "https://search.sapti.me",
  "https://searx.tiekoetter.com",
  "https://search.bus-hit.me",
  "https://searx.be",
  "https://search.ononoki.org",
  "https://paulgo.io",
  "https://opnxng.com",
];

export const searxAdapter: FlowerAdapter = {
  type: "custom",  // 使用 custom 类型，因为 SourceType 中没有 searx
  name: "Searx (元搜索)",
  icon: "🔎",
  description: "Searx 元搜索引擎 — 聚合 Google/Bing/DDG 结果（免费，无需 Key）",
  capabilities: ["search"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const maxResults = options?.maxResults || config.maxResults || 10;

    // 用户可以自定义 Searx 实例地址
    const instanceUrl = config.baseUrl || await findWorkingInstance();

    const params = new URLSearchParams({
      q: query,
      format: "json",
      categories: "general",
      language: options?.language || config.language || "auto",
      pageno: "1",
    });

    // 时间范围
    if (options?.timeRange && options.timeRange !== "all") {
      const timeRangeMap: Record<string, string> = {
        hour: "day",    // Searx 最小粒度是 day
        day: "day",
        week: "week",
        month: "month",
        year: "year",
      };
      params.set("time_range", timeRangeMap[options.timeRange] || "");
    }

    const url = `${instanceUrl}/search?${params.toString()}`;

    const response = await proxyFetch(url, {
      headers: {
        Accept: "application/json",
        ...config.customHeaders,
      },
    });

    if (!response.ok) {
      // 如果当前实例失败，尝试下一个
      if (!config.baseUrl) {
        return retryWithNextInstance(query, config, options, maxResults, instanceUrl);
      }
      throw new Error(`Searx error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];

    return results.slice(0, maxResults).map((item: SearxResult, i: number) => ({
      id: `searx_${Date.now()}_${i}`,
      sourceId: "",
      sourceType: "custom" as const,
      sourceName: `Searx (${item.engine || "mixed"})`,
      title: item.title || "Untitled",
      content: item.content || item.title || "",
      url: item.url,
      publishedAt: item.publishedDate || undefined,
      metadata: {
        engine: item.engine,
        engines: item.engines,
        score: item.score,
        category: item.category,
        position: i + 1,
      },
      fetchedAt: Date.now(),
    }));
  },

  async validateConfig(): Promise<boolean> {
    // Searx 不需要认证
    return true;
  },
};

// ─── 辅助函数 ───

/** 找到一个可用的 Searx 实例 */
async function findWorkingInstance(): Promise<string> {
  // 随机选择一个实例（避免总是打同一个）
  const shuffled = [...PUBLIC_INSTANCES].sort(() => Math.random() - 0.5);

  for (const instance of shuffled.slice(0, 3)) {
    try {
      const response = await proxyFetch(`${instance}/search?q=test&format=json`, {
        headers: { Accept: "application/json" },
      });
      if (response.ok) return instance;
    } catch {
      continue;
    }
  }

  // 默认返回第一个
  return PUBLIC_INSTANCES[0];
}

/** 当前实例失败时尝试其他实例 */
async function retryWithNextInstance(
  query: string,
  config: SourceConfig,
  options: SearchOptions | undefined,
  maxResults: number,
  failedInstance: string
): Promise<SourceResult[]> {
  const remaining = PUBLIC_INSTANCES.filter(i => i !== failedInstance);

  for (const instance of remaining.slice(0, 2)) {
    try {
      const params = new URLSearchParams({
        q: query,
        format: "json",
        categories: "general",
        language: options?.language || config.language || "auto",
      });

      const url = `${instance}/search?${params.toString()}`;
      const response = await proxyFetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const results = data.results || [];

      return results.slice(0, maxResults).map((item: SearxResult, i: number) => ({
        id: `searx_${Date.now()}_${i}`,
        sourceId: "",
        sourceType: "custom" as const,
        sourceName: `Searx (${item.engine || "mixed"})`,
        title: item.title || "Untitled",
        content: item.content || item.title || "",
        url: item.url,
        publishedAt: item.publishedDate || undefined,
        metadata: {
          engine: item.engine,
          engines: item.engines,
          score: item.score,
          instance,
        },
        fetchedAt: Date.now(),
      }));
    } catch {
      continue;
    }
  }

  throw new Error("Searx: 所有公共实例均不可用，请稍后重试或配置自定义实例地址");
}

interface SearxResult {
  title: string;
  url: string;
  content: string;
  engine: string;
  engines: string[];
  score: number;
  category: string;
  publishedDate?: string;
}
