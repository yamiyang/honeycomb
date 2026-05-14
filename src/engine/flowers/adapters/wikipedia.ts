/* ============================================================
   📚 Wikipedia Adapter
   
   通过 MediaWiki API 搜索维基百科文章。
   完全免费，无需 API Key。
   https://www.mediawiki.org/wiki/API:Search
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

export const wikipediaAdapter: FlowerAdapter = {
  type: "wikipedia",
  name: "Wikipedia",
  icon: "📚",
  description: "维基百科知识搜索（免费，无需 Key）",
  capabilities: ["search", "historical"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const maxResults = options?.maxResults || config.maxResults || 10;
    const language = options?.language || config.language || "zh";

    // 使用 MediaWiki Action API 搜索
    const params = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: String(maxResults),
      srinfo: "totalhits",
      srprop: "snippet|titlesnippet|timestamp|wordcount",
      format: "json",
      origin: "*",
    });

    const baseUrl = config.baseUrl || `https://${language}.wikipedia.org/w/api.php`;
    const url = `${baseUrl}?${params.toString()}`;

    const response = await proxyFetch(url, {
      headers: {
        Accept: "application/json",
        ...config.customHeaders,
      },
    });

    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.query?.search || [];

    // 获取文章摘要（批量获取）
    const pageIds = results.map((r: WikiSearchResult) => r.pageid);
    const extracts = pageIds.length > 0 ? await fetchExtracts(pageIds, language, config) : {};

    return results.map((item: WikiSearchResult) => {
      const extract = extracts[item.pageid] || stripHtml(item.snippet);
      return {
        id: `wiki_${item.pageid}`,
        sourceId: "",
        sourceType: "wikipedia" as const,
        sourceName: `Wikipedia (${language})`,
        title: item.title,
        content: extract,
        url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
        publishedAt: item.timestamp,
        metadata: {
          pageId: item.pageid,
          wordCount: item.wordcount,
          language,
          snippet: stripHtml(item.snippet),
        },
        fetchedAt: Date.now(),
      };
    });
  },

  async validateConfig(): Promise<boolean> {
    // Wikipedia API 不需要认证
    return true;
  },
};

// ─── 辅助函数 ───

/** 批量获取文章摘要 */
async function fetchExtracts(
  pageIds: number[],
  language: string,
  config: SourceConfig
): Promise<Record<number, string>> {
  const params = new URLSearchParams({
    action: "query",
    pageids: pageIds.join("|"),
    prop: "extracts",
    exintro: "true",
    explaintext: "true",
    exlimit: String(pageIds.length),
    format: "json",
    origin: "*",
  });

  const url = `https://${language}.wikipedia.org/w/api.php?${params.toString()}`;

  try {
    const response = await proxyFetch(url, {
      headers: config.customHeaders,
    });

    if (!response.ok) return {};

    const data = await response.json();
    const pages = data.query?.pages || {};
    const result: Record<number, string> = {};

    for (const [id, page] of Object.entries(pages)) {
      const p = page as { extract?: string };
      if (p.extract) {
        result[Number(id)] = p.extract.slice(0, 2000);
      }
    }

    return result;
  } catch {
    return {};
  }
}

/** 去除 HTML 标签 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

interface WikiSearchResult {
  pageid: number;
  title: string;
  snippet: string;
  timestamp: string;
  wordcount: number;
}
