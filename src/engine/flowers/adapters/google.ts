/* ============================================================
   🔍 Google Search Adapter
   
   通过 Serper API (serper.dev) 或 Google Custom Search JSON API
   获取网页搜索结果。
   
   配置需要:
   - apiKey: Serper API key 或 Google API key
   - baseUrl: (可选) 自定义 endpoint
   - searchParams.cx: Google Custom Search engine ID (仅 Google CSE)
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

export const googleAdapter: FlowerAdapter = {
  type: "google",
  name: "Google Search",
  icon: "🔍",
  description: "谷歌网页搜索",
  capabilities: ["search", "realtime"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const maxResults = options?.maxResults || config.maxResults || 10;
    
    // 优先使用 Serper API (更简单)
    if (config.baseUrl?.includes("serper") || !config.searchParams?.cx) {
      return searchViaSerper(query, config, maxResults, options);
    }
    
    // 否则使用 Google Custom Search API
    return searchViaGoogleCSE(query, config, maxResults, options);
  },

  async validateConfig(config: SourceConfig): Promise<boolean> {
    return !!config.apiKey;
  },
};

/**
 * Serper.dev API
 * https://serper.dev/
 */
async function searchViaSerper(
  query: string,
  config: SourceConfig,
  maxResults: number,
  options?: SearchOptions
): Promise<SourceResult[]> {
  const url = config.baseUrl || "https://google.serper.dev/search";

  const body: Record<string, unknown> = {
    q: query,
    num: maxResults,
  };

  if (config.language || options?.language) {
    body.hl = options?.language || config.language;
  }
  if (config.region) {
    body.gl = config.region;
  }
  if (options?.timeRange) {
    const tbs: Record<string, string> = {
      hour: "qdr:h",
      day: "qdr:d",
      week: "qdr:w",
      month: "qdr:m",
      year: "qdr:y",
    };
    body.tbs = tbs[options.timeRange] || "";
  }

  const response = await proxyFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": config.apiKey!,
      ...config.customHeaders,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status}`);
  }

  const data = await response.json();
  const organic = data.organic || [];

  return organic.map((item: { title: string; snippet: string; link: string; date?: string; position: number }) => ({
    id: `google_${Date.now()}_${item.position}`,
    sourceId: "",  // will be filled by registry
    sourceType: "google" as const,
    sourceName: "Google",
    title: item.title,
    content: item.snippet || "",
    url: item.link,
    publishedAt: item.date,
    metadata: {
      position: item.position,
      ...data.searchParameters,
    },
    fetchedAt: Date.now(),
  }));
}

/**
 * Google Custom Search JSON API
 * https://developers.google.com/custom-search/v1/overview
 */
async function searchViaGoogleCSE(
  query: string,
  config: SourceConfig,
  maxResults: number,
  options?: SearchOptions
): Promise<SourceResult[]> {
  const params = new URLSearchParams({
    key: config.apiKey!,
    cx: config.searchParams?.cx || "",
    q: query,
    num: String(Math.min(maxResults, 10)),
  });

  if (config.language || options?.language) {
    params.set("lr", `lang_${options?.language || config.language}`);
  }

  if (options?.timeRange) {
    const dateRestrict: Record<string, string> = {
      hour: "d1",
      day: "d1",
      week: "w1",
      month: "m1",
      year: "y1",
    };
    params.set("dateRestrict", dateRestrict[options.timeRange] || "");
  }

  const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
  const response = await proxyFetch(url, {
    headers: config.customHeaders,
  });

  if (!response.ok) {
    throw new Error(`Google CSE error: ${response.status}`);
  }

  const data = await response.json();
  const items = data.items || [];

  return items.map((item: { title: string; snippet: string; link: string; pagemap?: unknown }, i: number) => ({
    id: `google_cse_${Date.now()}_${i}`,
    sourceId: "",
    sourceType: "google" as const,
    sourceName: "Google",
    title: item.title,
    content: item.snippet || "",
    url: item.link,
    metadata: { pagemap: item.pagemap },
    fetchedAt: Date.now(),
  }));
}
