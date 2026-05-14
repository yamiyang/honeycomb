/* ============================================================
   🎓 Google Scholar Adapter
   
   通过 SerpAPI (serpapi.com) 的 Google Scholar endpoint
   搜索学术论文、引用、专利。
   
   配置:
   - apiKey: SerpAPI key
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

export const scholarAdapter: FlowerAdapter = {
  type: "scholar",
  name: "Google Scholar",
  icon: "🎓",
  description: "Google Scholar 学术搜索",
  capabilities: ["search", "papers", "historical"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const maxResults = options?.maxResults || config.maxResults || 10;

    // 如果有 SerpAPI key，使用 SerpAPI
    if (config.apiKey) {
      return searchViaSerpApi(query, config, maxResults, options);
    }

    // Fallback: 使用公开的 Scholar 搜索（通过代理）
    return searchViaProxy(query, config, maxResults, options);
  },

  async validateConfig(config: SourceConfig): Promise<boolean> {
    return !!config.apiKey;
  },
};

async function searchViaSerpApi(
  query: string,
  config: SourceConfig,
  maxResults: number,
  options?: SearchOptions
): Promise<SourceResult[]> {
  const params = new URLSearchParams({
    engine: "google_scholar",
    q: query,
    api_key: config.apiKey!,
    num: String(maxResults),
  });

  if (config.language || options?.language) {
    params.set("hl", options?.language || config.language || "en");
  }

  // 时间范围
  if (options?.timeRange) {
    const yearMap: Record<string, number> = {
      year: 1,
      month: 0, // 近一个月用 as_ylo = current year
    };
    const years = yearMap[options.timeRange];
    if (years !== undefined) {
      const currentYear = new Date().getFullYear();
      params.set("as_ylo", String(currentYear - years));
    }
  }

  const url = `https://serpapi.com/search?${params.toString()}`;
  const response = await proxyFetch(url);

  if (!response.ok) {
    throw new Error(`SerpAPI Scholar error: ${response.status}`);
  }

  const data = await response.json();
  const results = data.organic_results || [];

  return results.map((item: ScholarResult, i: number) => ({
    id: `scholar_${Date.now()}_${i}`,
    sourceId: "",
    sourceType: "scholar" as const,
    sourceName: "Google Scholar",
    title: `🎓 ${item.title}`,
    content: `${item.snippet || ""}\n\nAuthors: ${item.publication_info?.summary || "N/A"}\nCited by: ${item.inline_links?.cited_by?.total || 0}`,
    url: item.link || item.result_id || "",
    author: item.publication_info?.summary?.split(" - ")[0],
    publishedAt: item.publication_info?.summary?.match(/\d{4}/)?.[0],
    metadata: {
      citedBy: item.inline_links?.cited_by?.total,
      resultId: item.result_id,
      publicationInfo: item.publication_info,
      resources: item.resources,
    },
    fetchedAt: Date.now(),
  }));
}

/**
 * Fallback: 通过代理搜索 Scholar（有限功能）
 */
async function searchViaProxy(
  query: string,
  config: SourceConfig,
  maxResults: number,
  options?: SearchOptions
): Promise<SourceResult[]> {
  // 使用 crossref.org API 作为免费学术搜索替代
  const params = new URLSearchParams({
    query: query,
    rows: String(maxResults),
  });

  if (options?.sortBy === "date") {
    params.set("sort", "published");
    params.set("order", "desc");
  }

  const url = `https://api.crossref.org/works?${params.toString()}`;
  const response = await proxyFetch(url, {
    headers: {
      "User-Agent": "HoneyComb-Research-Bot/1.0 (mailto:research@honeycomb.ai)",
    },
  });

  if (!response.ok) return [];

  const data = await response.json();
  const items = data.message?.items || [];

  return items.map((item: CrossRefItem, i: number) => ({
    id: `scholar_cr_${Date.now()}_${i}`,
    sourceId: "",
    sourceType: "scholar" as const,
    sourceName: "CrossRef/Scholar",
    title: `🎓 ${Array.isArray(item.title) ? item.title[0] : item.title || "Untitled"}`,
    content: `${item.abstract?.replace(/<[^>]+>/g, "")?.slice(0, 2000) || "No abstract"}\n\nAuthors: ${item.author?.map((a: { given?: string; family?: string }) => `${a.given || ""} ${a.family || ""}`).join(", ") || "N/A"}\nDOI: ${item.DOI || "N/A"}\nPublished: ${item.published?.["date-parts"]?.[0]?.join("-") || "N/A"}`,
    url: item.URL || `https://doi.org/${item.DOI}`,
    author: item.author?.map((a: { given?: string; family?: string }) => `${a.given || ""} ${a.family || ""}`).join(", "),
    publishedAt: item.published?.["date-parts"]?.[0]?.join("-"),
    metadata: {
      doi: item.DOI,
      citedBy: item["is-referenced-by-count"],
      publisher: item.publisher,
      type: item.type,
    },
    fetchedAt: Date.now(),
  }));
}

interface ScholarResult {
  title: string;
  result_id: string;
  link?: string;
  snippet?: string;
  publication_info?: { summary: string };
  inline_links?: { cited_by?: { total: number } };
  resources?: unknown[];
}

interface CrossRefItem {
  title: string | string[];
  DOI: string;
  URL: string;
  abstract?: string;
  author?: { given?: string; family?: string }[];
  published?: { "date-parts": number[][] };
  publisher?: string;
  type?: string;
  "is-referenced-by-count"?: number;
}
