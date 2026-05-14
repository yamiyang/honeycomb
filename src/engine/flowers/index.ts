/* ============================================================
   🌸 花田 (Flower Fields) — 信息源管理系统
   
   插件化架构：每个信息源是一朵"花"。
   支持接入 Twitter/X, Google, GitHub, arXiv, 
   Google Scholar, Reddit, Hacker News, YouTube, RSS 等。
   ============================================================ */

import type { FlowerSource, SourceResult, SourceType, SourceConfig, SourceCapability } from "@/types";

// ─────────────────────────────────────────────
// 花朵接口 — 每个信息源适配器实现此接口
// ─────────────────────────────────────────────

export interface FlowerAdapter {
  readonly type: SourceType;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly capabilities: SourceCapability[];

  /** 搜索 */
  search(query: string, config: SourceConfig, options?: SearchOptions): Promise<SourceResult[]>;

  /** 验证配置是否有效 */
  validateConfig(config: SourceConfig): Promise<boolean>;

  /** 获取热门/趋势（如果支持） */
  trending?(config: SourceConfig, options?: TrendingOptions): Promise<SourceResult[]>;

  /** 深度阅读：根据 URL 获取完整内容（如果支持） */
  getDetail?(url: string, config: SourceConfig): Promise<string | null>;
}

export interface SearchOptions {
  maxResults?: number;
  language?: string;
  timeRange?: "hour" | "day" | "week" | "month" | "year" | "all";
  sortBy?: "relevance" | "date" | "popularity";
}

export interface TrendingOptions {
  category?: string;
  region?: string;
  limit?: number;
}

// ─────────────────────────────────────────────
// 花田注册器 — 管理所有信息源
// ─────────────────────────────────────────────

class FlowerFieldRegistry {
  private adapters: Map<SourceType, FlowerAdapter> = new Map();
  private sources: Map<string, FlowerSource> = new Map();

  /** 注册一个信息源适配器 */
  registerAdapter(adapter: FlowerAdapter) {
    this.adapters.set(adapter.type, adapter);
  }

  /** 获取适配器 */
  getAdapter(type: SourceType): FlowerAdapter | undefined {
    return this.adapters.get(type);
  }

  /** 获取所有已注册的适配器 */
  getAllAdapters(): FlowerAdapter[] {
    return Array.from(this.adapters.values());
  }

  /** 添加一个配置好的信息源实例 */
  addSource(source: FlowerSource) {
    this.sources.set(source.id, source);
  }

  /** 获取信息源实例 */
  getSource(id: string): FlowerSource | undefined {
    return this.sources.get(id);
  }

  /** 获取所有信息源 */
  getAllSources(): FlowerSource[] {
    return Array.from(this.sources.values());
  }

  /** 获取活跃信息源 */
  getActiveSources(): FlowerSource[] {
    return this.getAllSources().filter(s => s.status === "active");
  }

  /** 删除信息源 */
  removeSource(id: string) {
    this.sources.delete(id);
  }

  /** 更新信息源状态 */
  updateSourceStatus(id: string, status: FlowerSource["status"]) {
    const source = this.sources.get(id);
    if (source) {
      source.status = status;
      this.sources.set(id, source);
    }
  }

  /**
   * 搜索 — 在指定信息源中执行搜索
   */
  async search(sourceId: string, query: string, options?: SearchOptions): Promise<SourceResult[]> {
    const source = this.sources.get(sourceId);
    if (!source) throw new Error(`Source not found: ${sourceId}`);
    if (source.status !== "active") throw new Error(`Source is not active: ${sourceId} (${source.status})`);

    const adapter = this.adapters.get(source.type);
    if (!adapter) throw new Error(`No adapter for source type: ${source.type}`);

    // Rate limit check
    if (source.rateLimit) {
      const now = Date.now();
      if (now < source.rateLimit.resetAt && source.rateLimit.currentUsage >= source.rateLimit.maxPerMinute) {
        this.updateSourceStatus(sourceId, "rate_limited");
        throw new Error(`Rate limited: ${source.name}`);
      }
      if (now >= source.rateLimit.resetAt) {
        source.rateLimit.currentUsage = 0;
        source.rateLimit.resetAt = now + 60000;
      }
      source.rateLimit.currentUsage++;
    }

    try {
      const results = await adapter.search(query, source.config, options);
      source.lastUsed = Date.now();
      return results.map(r => ({
        ...r,
        sourceId: source.id,
        sourceType: source.type,
        sourceName: source.name,
      }));
    } catch (error) {
      this.updateSourceStatus(sourceId, "error");
      throw error;
    }
  }

  /**
   * 在多个信息源中并行搜索
   */
  async searchMultiple(sourceIds: string[], query: string, options?: SearchOptions): Promise<SourceResult[]> {
    const promises = sourceIds.map(id =>
      this.search(id, query, options).catch(err => {
        console.warn(`[🌸 searchMultiple] Source "${id}" failed for "${query}": ${err.message}`);
        return [] as SourceResult[];
      })
    );

    const results = await Promise.all(promises);
    const flat = results.flat();
    if (flat.length === 0 && sourceIds.length > 0) {
      console.warn(`[🌸 searchMultiple] All ${sourceIds.length} sources returned empty for "${query}"`);
    }
    return flat;
  }
  /**
   * 深度阅读 — 获取 URL 的完整内容
   * 优先使用适配器原生的 getDetail，降级到通用 deep-reader
   */
  async getDetail(sourceId: string, url: string): Promise<string | null> {
    const source = this.sources.get(sourceId);
    if (!source) return null;

    const adapter = this.adapters.get(source.type);
    if (adapter?.getDetail) {
      try {
        const detail = await adapter.getDetail(url, source.config);
        if (detail && detail.length > 200) return detail;
      } catch (err) {
        console.warn(`[🌸 getDetail] Adapter "${source.name}" failed for ${url}:`, err);
      }
    }

    // 降级：通用 deep-reader（Jina）
    return null;
  }

  /**
   * 浏览 — 无关键词，获取信息源的最新/热门内容
   * 调用适配器的 trending() 方法
   */
  async browse(sourceId: string, options?: TrendingOptions): Promise<SourceResult[]> {
    const source = this.sources.get(sourceId);
    if (!source) throw new Error(`Source not found: ${sourceId}`);
    if (source.status !== "active") throw new Error(`Source is not active: ${sourceId}`);

    const adapter = this.adapters.get(source.type);
    if (!adapter) throw new Error(`No adapter for source type: ${source.type}`);

    if (!adapter.trending) {
      // 该适配器不支持浏览，降级为用空泛 query 搜索
      console.log(`[🌸 browse] "${source.name}" has no trending, falling back to search`);
      return this.search(sourceId, "latest news today", options ? { maxResults: options.limit } : undefined);
    }

    try {
      const results = await adapter.trending(source.config, options);
      source.lastUsed = Date.now();
      return results.map(r => ({
        ...r,
        sourceId: source.id,
        sourceType: source.type,
        sourceName: source.name,
      }));
    } catch (error) {
      this.updateSourceStatus(sourceId, "error");
      throw error;
    }
  }

  /**
   * 在多个信息源中并行浏览（获取热门/最新内容）
   */
  async browseMultiple(sourceIds: string[], options?: TrendingOptions): Promise<SourceResult[]> {
    const promises = sourceIds.map(id =>
      this.browse(id, options).catch(err => {
        console.warn(`[🌸 browseMultiple] Source "${id}" failed: ${err.message}`);
        return [] as SourceResult[];
      })
    );

    const results = await Promise.all(promises);
    return results.flat();
  }

  /**
   * 获取支持浏览（trending）的活跃信息源
   */
  getBrowsableSources(): FlowerSource[] {
    return this.getActiveSources().filter(s => {
      const adapter = this.adapters.get(s.type);
      return adapter?.trending || s.capabilities.includes("trending") || s.capabilities.includes("realtime");
    });
  }
}

// 单例
export const flowerField = new FlowerFieldRegistry();

// ─────────────────────────────────────────────
// 默认信息源预设（用户可修改配置）
// ─────────────────────────────────────────────

export const DEFAULT_SOURCES: Omit<FlowerSource, "id" | "createdAt">[] = [
  {
    type: "google",
    name: "Google Search",
    icon: "🔍",
    description: "谷歌网页搜索 — 全球最大搜索引擎",
    status: "inactive",
    config: {},
    capabilities: ["search", "realtime"],
  },
  {
    type: "twitter",
    name: "Twitter/X",
    icon: "🐦",
    description: "Twitter/X 社交媒体 — 实时信息、观点、趋势",
    status: "inactive",
    config: {},
    capabilities: ["search", "trending", "realtime", "user_profile", "comments"],
  },
  {
    type: "github",
    name: "GitHub",
    icon: "🐙",
    description: "GitHub 代码托管 — 开源项目、代码、技术讨论",
    status: "active",
    config: {},
    capabilities: ["search", "code", "trending", "user_profile", "comments"],
  },
  {
    type: "arxiv",
    name: "arXiv",
    icon: "📄",
    description: "arXiv 预印本 — 物理、数学、计算机科学等前沿论文",
    status: "active",
    config: {},
    capabilities: ["search", "papers"],
  },
  {
    type: "scholar",
    name: "Google Scholar",
    icon: "🎓",
    description: "Google Scholar — 学术论文、引用、专利",
    status: "inactive",
    config: {},
    capabilities: ["search", "papers", "historical"],
  },
  {
    type: "reddit",
    name: "Reddit",
    icon: "🤖",
    description: "Reddit — 社区讨论、深度分析、用户观点（需 OAuth 认证）",
    status: "inactive",
    config: {},
    capabilities: ["search", "trending", "comments"],
  },
  {
    type: "hackernews",
    name: "Hacker News",
    icon: "🧡",
    description: "Hacker News — 技术社区新闻与讨论",
    status: "active",
    config: {},
    capabilities: ["search", "trending", "comments"],
  },
  {
    type: "youtube",
    name: "YouTube",
    icon: "📺",
    description: "YouTube — 视频内容搜索、字幕提取",
    status: "inactive",
    config: {},
    capabilities: ["search", "media", "trending"],
  },
  {
    type: "web",
    name: "Web Search",
    icon: "🕸️",
    description: "通用网页搜索 — DuckDuckGo（免费）/ Jina（需配 Key）",
    status: "active",
    config: {},
    capabilities: ["search"],
  },
  {
    type: "wikipedia",
    name: "Wikipedia",
    icon: "📚",
    description: "维基百科 — 多语言百科全书知识库（免费）",
    status: "active",
    config: {},
    capabilities: ["search", "historical"],
  },
  {
    type: "stackoverflow",
    name: "StackOverflow",
    icon: "💡",
    description: "StackOverflow — 编程问答社区（免费）",
    status: "active",
    config: {},
    capabilities: ["search", "trending", "comments", "code"],
  },
  {
    type: "duckduckgo",
    name: "DuckDuckGo",
    icon: "🦆",
    description: "DuckDuckGo — 隐私搜索引擎（免费，无需 Key）",
    status: "active",
    config: {},
    capabilities: ["search"],
  },
  {
    type: "bilibili",
    name: "Bilibili",
    icon: "📺",
    description: "B站 — 中文视频内容搜索（免费）",
    status: "inactive",
    config: {},
    capabilities: ["search", "trending", "media", "comments"],
  },
  {
    type: "rss",
    name: "RSS Feeds",
    icon: "📡",
    description: "RSS/Atom 订阅源 — 博客、新闻站点聚合（免费）",
    status: "active",
    config: {},
    capabilities: ["search", "realtime"],
  },
  {
    type: "custom",
    name: "Searx (元搜索)",
    icon: "🔎",
    description: "Searx 元搜索引擎 — 聚合 Google/Bing/DDG 结果（免费，无需 Key）",
    status: "active",
    config: {},
    capabilities: ["search"],
  },
  {
    type: "custom",
    name: "Brave Search",
    icon: "🦁",
    description: "Brave 搜索引擎 — 独立索引，注重隐私（免费 2000次/月）",
    status: "inactive",
    config: {},
    capabilities: ["search"],
  },
];
