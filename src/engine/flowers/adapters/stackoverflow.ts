/* ============================================================
   💡 StackOverflow Adapter
   
   通过 StackExchange API 搜索编程问答。
   完全免费，无需 API Key（有 Key 可提高速率限制）。
   https://api.stackexchange.com/docs
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions, TrendingOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

export const stackoverflowAdapter: FlowerAdapter = {
  type: "stackoverflow",
  name: "StackOverflow",
  icon: "💡",
  description: "StackOverflow 编程问答搜索（免费）",
  capabilities: ["search", "trending", "comments", "code"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const maxResults = options?.maxResults || config.maxResults || 10;

    const params = new URLSearchParams({
      order: "desc",
      sort: options?.sortBy === "date" ? "creation" : options?.sortBy === "popularity" ? "votes" : "relevance",
      intitle: query,
      pagesize: String(maxResults),
      site: "stackoverflow",
      filter: "!nNPvSNdWme", // 包含 body_markdown 的 filter
    });

    // 如果有 API Key 可以提高速率限制
    if (config.apiKey) {
      params.set("key", config.apiKey);
    }

    // 标签过滤
    if (config.searchParams?.tags) {
      params.set("tagged", config.searchParams.tags);
    }

    const url = `https://api.stackexchange.com/2.3/search/advanced?${params.toString()}`;

    const response = await proxyFetch(url, {
      headers: {
        Accept: "application/json",
        ...config.customHeaders,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`StackOverflow API error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const items = data.items || [];

    return items.map((item: SOQuestion) => ({
      id: `so_${item.question_id}`,
      sourceId: "",
      sourceType: "stackoverflow" as const,
      sourceName: "StackOverflow",
      title: decodeHtml(item.title),
      content: `${decodeHtml(item.title)}\n\nTags: ${item.tags.join(", ")}\nScore: ${item.score} | Answers: ${item.answer_count} ${item.is_answered ? "✅" : ""}\nViews: ${item.view_count}\n\n${item.body_markdown ? item.body_markdown.slice(0, 2000) : ""}`,
      url: item.link,
      author: item.owner?.display_name || "Anonymous",
      publishedAt: new Date(item.creation_date * 1000).toISOString(),
      metadata: {
        questionId: item.question_id,
        score: item.score,
        answerCount: item.answer_count,
        isAnswered: item.is_answered,
        viewCount: item.view_count,
        tags: item.tags,
        acceptedAnswerId: item.accepted_answer_id,
      },
      fetchedAt: Date.now(),
    }));
  },

  async validateConfig(): Promise<boolean> {
    // StackExchange API 不需要认证（有 key 只是提高限制）
    return true;
  },

  async trending(_config: SourceConfig, options?: TrendingOptions): Promise<SourceResult[]> {
    const limit = options?.limit || 20;
    const tag = options?.category || "";

    const params = new URLSearchParams({
      order: "desc",
      sort: "hot",
      pagesize: String(limit),
      site: "stackoverflow",
    });

    if (tag) {
      params.set("tagged", tag);
    }

    const url = `https://api.stackexchange.com/2.3/questions?${params.toString()}`;

    const response = await proxyFetch(url);
    if (!response.ok) {
      throw new Error(`StackOverflow trending error: ${response.status}`);
    }

    const data = await response.json();
    const items = data.items || [];

    return items.map((item: SOQuestion, i: number) => ({
      id: `so_hot_${item.question_id}`,
      sourceId: "",
      sourceType: "stackoverflow" as const,
      sourceName: "StackOverflow Hot",
      title: `💡 ${decodeHtml(item.title)} (${item.score}↑)`,
      content: `Tags: ${item.tags.join(", ")}\nScore: ${item.score} | Answers: ${item.answer_count}\nViews: ${item.view_count}`,
      url: item.link,
      author: item.owner?.display_name || "Anonymous",
      publishedAt: new Date(item.creation_date * 1000).toISOString(),
      metadata: {
        rank: i + 1,
        questionId: item.question_id,
        score: item.score,
        answerCount: item.answer_count,
        tags: item.tags,
      },
      fetchedAt: Date.now(),
    }));
  },
};

// ─── 辅助函数 ───

/** 解码 HTML 实体 */
function decodeHtml(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

interface SOQuestion {
  question_id: number;
  title: string;
  link: string;
  tags: string[];
  score: number;
  answer_count: number;
  is_answered: boolean;
  view_count: number;
  creation_date: number;
  accepted_answer_id?: number;
  body_markdown?: string;
  owner?: {
    display_name: string;
    reputation: number;
  };
}
