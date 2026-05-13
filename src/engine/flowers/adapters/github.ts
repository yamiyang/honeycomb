/* ============================================================
   🐙 GitHub Adapter
   
   通过 GitHub REST API 搜索仓库、代码、Issues、Discussions。
   
   配置需要:
   - apiKey: GitHub Personal Access Token (可选, 提高 rate limit)
   ============================================================ */

import type { SourceResult, SourceConfig } from "@/types";
import type { FlowerAdapter, SearchOptions, TrendingOptions } from "../index";
import { proxyFetch } from "../proxy-fetch";

export const githubAdapter: FlowerAdapter = {
  type: "github",
  name: "GitHub",
  icon: "🐙",
  description: "GitHub 代码搜索与仓库发现",
  capabilities: ["search", "code", "trending", "user_profile", "comments"],

  async search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]> {
    const maxResults = Math.min(options?.maxResults || config.maxResults || 10, 30);
    const baseUrl = config.baseUrl || "https://api.github.com";

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2023-11-28",
      ...config.customHeaders,
    };
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    // 同时搜索仓库和代码
    const [repoResults, codeResults] = await Promise.all([
      searchRepos(baseUrl, query, headers, maxResults, options),
      searchCode(baseUrl, query, headers, Math.ceil(maxResults / 2), options),
    ]);

    return [...repoResults, ...codeResults].slice(0, maxResults);
  },

  async validateConfig(config: SourceConfig): Promise<boolean> {
    // GitHub API 无 token 也可用（有 rate limit）
    return true;
  },

  async trending(config: SourceConfig, options?: TrendingOptions): Promise<SourceResult[]> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2023-11-28",
    };
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    // 用 stars 排序获取近期热门
    const since = new Date(Date.now() - 604800000).toISOString().split("T")[0];
    const language = options?.category || "";
    const q = `created:>${since}${language ? ` language:${language}` : ""} stars:>10`;
    const limit = options?.limit || 10;

    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${limit}`;
    const response = await proxyFetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub trending error: ${response.status}`);
    }

    const data = await response.json();
    return (data.items || []).map((repo: GitHubRepo, i: number) => ({
      id: `github_trend_${repo.id}`,
      sourceId: "",
      sourceType: "github" as const,
      sourceName: "GitHub Trending",
      title: `${repo.full_name} ⭐${repo.stargazers_count}`,
      content: repo.description || "No description",
      url: repo.html_url,
      author: repo.owner?.login,
      publishedAt: repo.created_at,
      metadata: {
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        language: repo.language,
        topics: repo.topics,
      },
      fetchedAt: Date.now(),
    }));
  },
};

// ─────────────────────────────────────────────

interface GitHubRepo {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  owner: { login: string };
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  created_at: string;
  updated_at: string;
}

async function searchRepos(
  baseUrl: string,
  query: string,
  headers: Record<string, string>,
  maxResults: number,
  options?: SearchOptions
): Promise<SourceResult[]> {
  let q = query;
  if (options?.sortBy === "date") {
    // 最近更新
  }

  const params = new URLSearchParams({
    q,
    sort: options?.sortBy === "popularity" ? "stars" : options?.sortBy === "date" ? "updated" : "best-match",
    order: "desc",
    per_page: String(maxResults),
  });

  const url = `${baseUrl}/search/repositories?${params.toString()}`;
  const response = await proxyFetch(url, { headers });

  if (!response.ok) return [];

  const data = await response.json();
  return (data.items || []).map((repo: GitHubRepo) => ({
    id: `github_repo_${repo.id}`,
    sourceId: "",
    sourceType: "github" as const,
    sourceName: "GitHub",
    title: `📦 ${repo.full_name} (⭐${repo.stargazers_count})`,
    content: `${repo.description || ""}\n\nLanguage: ${repo.language || "N/A"} | Forks: ${repo.forks_count} | Topics: ${repo.topics?.join(", ") || "none"}`,
    url: repo.html_url,
    author: repo.owner?.login,
    publishedAt: repo.created_at,
    metadata: {
      type: "repository",
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      topics: repo.topics,
    },
    fetchedAt: Date.now(),
  }));
}

async function searchCode(
  baseUrl: string,
  query: string,
  headers: Record<string, string>,
  maxResults: number,
  options?: SearchOptions
): Promise<SourceResult[]> {
  const params = new URLSearchParams({
    q: query,
    per_page: String(maxResults),
  });

  const url = `${baseUrl}/search/code?${params.toString()}`;
  const response = await proxyFetch(url, { headers });

  if (!response.ok) return [];

  const data = await response.json();
  return (data.items || []).slice(0, maxResults).map((item: {
    name: string;
    path: string;
    html_url: string;
    repository: { full_name: string; html_url: string };
    sha: string;
  }) => ({
    id: `github_code_${item.sha?.slice(0, 8)}`,
    sourceId: "",
    sourceType: "github" as const,
    sourceName: "GitHub Code",
    title: `💻 ${item.repository.full_name}/${item.path}`,
    content: `File: ${item.name} in ${item.repository.full_name}`,
    url: item.html_url,
    author: item.repository.full_name.split("/")[0],
    metadata: {
      type: "code",
      repository: item.repository.full_name,
      path: item.path,
    },
    fetchedAt: Date.now(),
  }));
}
