/* ============================================================
   📄 arXiv Adapter
   
   通过 arXiv API (export.arxiv.org) 搜索学术预印本论文。
   无需 API key，完全免费开放。
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

export const arxivAdapter: FlowerAdapter = {
  type: "arxiv",
  name: "arXiv",
  icon: "📄",
  description: "arXiv 学术预印本搜索",
  capabilities: ["search", "papers"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const maxResults = options?.maxResults || config.maxResults || 10;
    const sortBy = options?.sortBy === "date" ? "submittedDate" : "relevance";
    const sortOrder = "descending";

    // arXiv API uses URL query params
    const searchQuery = encodeURIComponent(
      `all:${query}`
    );

    const url = `https://export.arxiv.org/api/query?search_query=${searchQuery}&start=0&max_results=${maxResults}&sortBy=${sortBy}&sortOrder=${sortOrder}`;

    const response = await proxyFetch(url, {
      headers: config.customHeaders,
    });

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status}`);
    }

    const xml = await response.text();
    return parseArxivXML(xml);
  },

  async validateConfig(): Promise<boolean> {
    // arXiv 不需要 API key
    return true;
  },

  async getDetail(url: string): Promise<string | null> {
    // arXiv → ar5iv HTML 版全文
    const match = url.match(/arxiv\.org\/abs\/(.+)/);
    if (!match) return null;
    const arxivId = match[1];
    try {
      const response = await proxyFetch(`https://ar5iv.labs.arxiv.org/html/${arxivId}`, {
        headers: { Accept: "text/html" },
      });
      if (!response.ok) return null;
      const html = await response.text();
      // 提取纯文本（去 HTML 标签）
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return text.slice(0, 8000);
    } catch {
      return null;
    }
  },
};

/**
 * 解析 arXiv Atom XML 响应
 */
function parseArxivXML(xml: string): SourceResult[] {
  const results: SourceResult[] = [];
  
  // 简单 XML 解析（避免引入 xml 解析库）
  const entries = xml.split("<entry>").slice(1);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    const title = extractXMLTag(entry, "title")?.replace(/\s+/g, " ").trim() || "";
    const summary = extractXMLTag(entry, "summary")?.replace(/\s+/g, " ").trim() || "";
    const published = extractXMLTag(entry, "published") || "";
    const id = extractXMLTag(entry, "id") || "";
    
    // 提取作者
    const authors: string[] = [];
    const authorMatches = entry.matchAll(/<author>\s*<name>([^<]+)<\/name>/g);
    for (const match of authorMatches) {
      authors.push(match[1]);
    }

    // 提取分类
    const categories: string[] = [];
    const catMatches = entry.matchAll(/category[^>]*term="([^"]+)"/g);
    for (const match of catMatches) {
      categories.push(match[1]);
    }

    // 提取 PDF link
    const pdfMatch = entry.match(/href="([^"]*)"[^>]*title="pdf"/);
    const pdfUrl = pdfMatch?.[1] || id.replace("abs", "pdf");

    // arXiv ID
    const arxivId = id.match(/abs\/(.+)$/)?.[1] || id;

    results.push({
      id: `arxiv_${arxivId.replace(/[/.]/g, "_")}`,
      sourceId: "",
      sourceType: "arxiv",
      sourceName: "arXiv",
      title: `📄 ${title}`,
      content: `${summary}\n\nAuthors: ${authors.join(", ")}\nCategories: ${categories.join(", ")}`,
      url: id,
      author: authors.join(", "),
      publishedAt: published,
      metadata: {
        arxivId,
        authors,
        categories,
        pdfUrl,
      },
      fetchedAt: Date.now(),
    });
  }

  return results;
}

function extractXMLTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1] : null;
}
