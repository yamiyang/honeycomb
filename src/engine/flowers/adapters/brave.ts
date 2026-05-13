/* ============================================================
   🦁 Brave Search Adapter
   
   通过 Brave Search API 搜索网页。
   免费额度：2000 次/月（无需信用卡）。
   
   申请: https://brave.com/search/api/
   文档: https://api.search.brave.com/app/documentation/web-search
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

export const braveAdapter: FlowerAdapter = {
  type: "custom",  // 使用 custom 类型
  name: "Brave Search",
  icon: "🦁",
  description: "Brave 搜索引擎 — 独立索引，注重隐私（免费 2000次/月）",
  capabilities: ["search"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const apiKey = config.apiKey;
    if (!apiKey) throw new Error("Brave Search: 需要配置 API Key（免费申请 https://brave.com/search/api/）");

    const maxResults = Math.min(options?.maxResults || config.maxResults || 10, 20);

    const params = new URLSearchParams({
      q: query,
      count: String(maxResults),
    });

    // 语言和地区
    if (options?.language || config.language) {
      params.set("search_lang", options?.language || config.language || "zh");
    }
    if (config.region) {
      params.set("country", config.region);
    }

    // 时间范围（freshness）
    if (options?.timeRange && options.timeRange !== "all") {
      const freshnessMap: Record<string, string> = {
        hour: "ph",    // past hour
        day: "pd",     // past day
        week: "pw",    // past week
        month: "pm",   // past month
        year: "py",    // past year
      };
      params.set("freshness", freshnessMap[options.timeRange] || "");
    }

    const url = `https://api.search.brave.com/res/v1/web/search?${params.toString()}`;

    const response = await proxyFetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
        ...config.customHeaders,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new Error("Brave Search: API Key 无效或已过期");
      }
      if (response.status === 429) {
        throw new Error("Brave Search: 免费额度已用完（2000次/月）");
      }
      throw new Error(`Brave Search error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const webResults = data.web?.results || [];

    return webResults.slice(0, maxResults).map((item: BraveResult, i: number) => ({
      id: `brave_${Date.now()}_${i}`,
      sourceId: "",
      sourceType: "custom" as const,
      sourceName: "Brave Search",
      title: item.title || "Untitled",
      content: item.description || item.title || "",
      url: item.url,
      publishedAt: item.page_age || undefined,
      metadata: {
        position: i + 1,
        language: item.language,
        familyFriendly: item.family_friendly,
        extra_snippets: item.extra_snippets,
      },
      fetchedAt: Date.now(),
    }));
  },

  async validateConfig(config: SourceConfig): Promise<boolean> {
    return !!config.apiKey;
  },
};

interface BraveResult {
  title: string;
  url: string;
  description: string;
  page_age?: string;
  language?: string;
  family_friendly?: boolean;
  extra_snippets?: string[];
}
