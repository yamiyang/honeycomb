/* ============================================================
   🕸️ Web Crawler Adapter
   
   通用网页爬取 — 抓取任意 URL 的内容。
   使用 Jina Reader API (r.jina.ai) 将网页转为干净文本。
   
   配置:
   - apiKey: (可选) Jina API key 提高 rate limit
   - baseUrl: (可选) 自定义 reader endpoint
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

export const webAdapter: FlowerAdapter = {
  type: "web",
  name: "Web Crawler",
  icon: "🕸️",
  description: "通用网页内容抓取",
  capabilities: ["search"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    // 如果 query 是 URL，直接爬取
    if (isUrl(query)) {
      const result = await fetchPage(query, config);
      return result ? [result] : [];
    }

    // 否则用 Jina Search (s.jina.ai)
    return searchViaJina(query, config, options);
  },

  async validateConfig(): Promise<boolean> {
    return true;
  },
};

function isUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 用 Jina Reader 抓取单个网页
 * https://r.jina.ai/{url}
 */
async function fetchPage(url: string, config: SourceConfig): Promise<SourceResult | null> {
  const readerUrl = `${config.baseUrl || "https://r.jina.ai"}/${url}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...config.customHeaders,
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  try {
    const response = await proxyFetch(readerUrl, { headers });
    if (!response.ok) return null;

    const data = await response.json();
    return {
      id: `web_${Date.now()}`,
      sourceId: "",
      sourceType: "web",
      sourceName: "Web",
      title: data.title || url,
      content: data.content || data.text || "",
      url: url,
      author: data.author,
      publishedAt: data.publishedTime,
      metadata: {
        description: data.description,
        siteName: data.siteName,
        images: data.images,
      },
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Jina Search — AI 搜索引擎
 * https://s.jina.ai/
 */
async function searchViaJina(
  query: string,
  config: SourceConfig,
  options?: SearchOptions
): Promise<SourceResult[]> {
  const searchUrl = `https://s.jina.ai/${encodeURIComponent(query)}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...config.customHeaders,
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  try {
    const response = await proxyFetch(searchUrl, { headers });
    if (!response.ok) return [];

    const data = await response.json();
    const results = data.results || data.data || [];
    const maxResults = options?.maxResults || 10;

    return results.slice(0, maxResults).map((item: {
      title: string;
      content: string;
      url: string;
      description?: string;
    }, i: number) => ({
      id: `web_jina_${Date.now()}_${i}`,
      sourceId: "",
      sourceType: "web" as const,
      sourceName: "Web",
      title: item.title || "Untitled",
      content: item.content || item.description || "",
      url: item.url,
      metadata: {},
      fetchedAt: Date.now(),
    }));
  } catch {
    return [];
  }
}
