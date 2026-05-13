/* ============================================================
   🦆 DuckDuckGo Adapter
   
   通过 DuckDuckGo 搜索网页。
   完全免费，无需 API Key，注重隐私。
   使用 DuckDuckGo HTML 搜索 + Instant Answer API。
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

export const duckduckgoAdapter: FlowerAdapter = {
  type: "duckduckgo",
  name: "DuckDuckGo",
  icon: "🦆",
  description: "DuckDuckGo 隐私搜索（免费，无需 Key）",
  capabilities: ["search"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const maxResults = options?.maxResults || config.maxResults || 10;

    // 方案1: 使用 DuckDuckGo HTML lite 版本搜索
    const results = await searchDDGHtml(query, config, maxResults);

    // 方案2: 补充 Instant Answer API 的结果（如果有的话）
    const instantResult = await fetchInstantAnswer(query, config);
    if (instantResult) {
      results.unshift(instantResult);
    }

    return results.slice(0, maxResults);
  },

  async validateConfig(): Promise<boolean> {
    // DuckDuckGo 不需要认证
    return true;
  },
};

// ─── 搜索实现 ───

/** 通过 DuckDuckGo HTML lite 搜索 */
async function searchDDGHtml(
  query: string,
  config: SourceConfig,
  maxResults: number
): Promise<SourceResult[]> {
  const params = new URLSearchParams({
    q: query,
    kl: config.region || "wt-wt", // 地区，wt-wt = 全球
  });

  const url = `https://html.duckduckgo.com/html/?${params.toString()}`;

  const response = await proxyFetch(url, {
    headers: {
      Accept: "text/html",
      "Accept-Language": config.language || "zh-CN,zh;q=0.9,en;q=0.8",
      ...config.customHeaders,
    },
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo search error: ${response.status}`);
  }

  const html = await response.text();
  return parseDDGHtml(html, maxResults);
}

/** 解析 DuckDuckGo HTML 搜索结果 */
function parseDDGHtml(html: string, maxResults: number): SourceResult[] {
  const results: SourceResult[] = [];

  // 匹配搜索结果块
  // DuckDuckGo HTML lite 的结构: <a class="result__a" href="...">title</a>
  // <a class="result__snippet">snippet</a>
  const resultBlocks = html.split(/class="result\s/);

  for (let i = 1; i < resultBlocks.length && results.length < maxResults; i++) {
    const block = resultBlocks[i];

    // 提取 URL
    const urlMatch = block.match(/class="result__a"\s+href="([^"]+)"/);
    if (!urlMatch) continue;

    let url = urlMatch[1];
    // DuckDuckGo 的 URL 可能是重定向链接
    if (url.startsWith("//duckduckgo.com/l/?")) {
      const uddgMatch = url.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        url = decodeURIComponent(uddgMatch[1]);
      }
    }

    // 提取标题
    const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)</);
    const title = titleMatch ? decodeHtml(titleMatch[1].trim()) : "Untitled";

    // 提取摘要
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    const snippet = snippetMatch ? decodeHtml(stripHtml(snippetMatch[1].trim())) : "";

    // 提取来源域名
    const domainMatch = block.match(/class="result__url"[^>]*>([^<]+)</);
    const domain = domainMatch ? domainMatch[1].trim() : "";

    if (url && !url.startsWith("//duckduckgo.com")) {
      results.push({
        id: `ddg_${Date.now()}_${i}`,
        sourceId: "",
        sourceType: "duckduckgo" as const,
        sourceName: "DuckDuckGo",
        title,
        content: snippet || title,
        url: url.startsWith("http") ? url : `https://${url}`,
        metadata: {
          domain,
          position: i,
        },
        fetchedAt: Date.now(),
      });
    }
  }

  return results;
}

/** DuckDuckGo Instant Answer API */
async function fetchInstantAnswer(
  query: string,
  config: SourceConfig
): Promise<SourceResult | null> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    no_redirect: "1",
    skip_disambig: "1",
  });

  const url = `https://api.duckduckgo.com/?${params.toString()}`;

  try {
    const response = await proxyFetch(url, {
      headers: config.customHeaders,
    });

    if (!response.ok) return null;

    const data = await response.json();

    // 如果有 Abstract（来自维基百科等）
    if (data.Abstract && data.AbstractText) {
      return {
        id: `ddg_instant_${Date.now()}`,
        sourceId: "",
        sourceType: "duckduckgo" as const,
        sourceName: `DuckDuckGo Instant (${data.AbstractSource || "Unknown"})`,
        title: data.Heading || query,
        content: data.AbstractText,
        url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        metadata: {
          type: "instant_answer",
          source: data.AbstractSource,
          image: data.Image,
          infobox: data.Infobox,
        },
        fetchedAt: Date.now(),
      };
    }

    // 如果有 Answer（计算结果等）
    if (data.Answer) {
      return {
        id: `ddg_answer_${Date.now()}`,
        sourceId: "",
        sourceType: "duckduckgo" as const,
        sourceName: "DuckDuckGo Answer",
        title: `${query} — ${data.AnswerType || "Answer"}`,
        content: typeof data.Answer === "string" ? data.Answer : JSON.stringify(data.Answer),
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        metadata: {
          type: "answer",
          answerType: data.AnswerType,
        },
        fetchedAt: Date.now(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ─── 辅助函数 ───

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function decodeHtml(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}
