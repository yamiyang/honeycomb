/* ============================================================
   🐝 HoneyComb 蜜探 — Core Type Definitions
   
   Real AI-powered research system built on Hermes Agent.
   "花田" (Flower Fields) = pluggable information source system
   ============================================================ */

// ─────────────────────────────────────────────
// 花田 (Flower Fields) — 信息源管理
// ─────────────────────────────────────────────

/** 信息源类型 */
export type SourceType =
  | "twitter"
  | "google"
  | "github"
  | "arxiv"
  | "scholar"
  | "reddit"
  | "hackernews"
  | "youtube"
  | "wikipedia"
  | "stackoverflow"
  | "duckduckgo"
  | "bilibili"
  | "web"        // 通用网页爬取
  | "rss"
  | "custom";

/** 信息源状态 */
export type SourceStatus = "active" | "inactive" | "error" | "rate_limited";

/** 信息源配置 — 每朵"花"的定义 */
export interface FlowerSource {
  id: string;
  type: SourceType;
  name: string;                    // 显示名称, e.g. "Twitter/X"
  icon: string;                    // emoji or icon name
  description: string;
  status: SourceStatus;
  config: SourceConfig;            // 认证与连接配置
  capabilities: SourceCapability[];
  rateLimit?: {
    maxPerMinute: number;
    currentUsage: number;
    resetAt: number;
  };
  lastUsed?: number;
  createdAt: number;
}

/** 信息源能力 */
export type SourceCapability =
  | "search"         // 搜索
  | "trending"       // 热门/趋势
  | "realtime"       // 实时数据
  | "historical"     // 历史数据
  | "user_profile"   // 用户/作者信息
  | "comments"       // 评论/讨论
  | "code"           // 代码
  | "papers"         // 学术论文
  | "media";         // 多媒体

/** 信息源配置（各源不同） */
export interface SourceConfig {
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  bearerToken?: string;
  cookie?: string;                          // Cookie 认证（如 Twitter/X）
  customHeaders?: Record<string, string>;
  searchParams?: Record<string, string>;    // 默认搜索参数
  maxResults?: number;
  language?: string;
  region?: string;
}

/** 从信息源获取到的原始结果 */
export interface SourceResult {
  id: string;
  sourceId: string;
  sourceType: SourceType;
  sourceName: string;
  title: string;
  content: string;                 // 原始内容
  url: string;
  author?: string;
  publishedAt?: string;
  metadata: Record<string, unknown>;  // 源特有的元数据
  fetchedAt: number;
}

// ─────────────────────────────────────────────
// Hermes Agent 层
// ─────────────────────────────────────────────

/** Hermes Agent 消息格式 */
export interface HermesMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: HermesToolCall[];
  tool_call_id?: string;
  name?: string;
}

/** Hermes 工具调用 */
export interface HermesToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/** Hermes Agent 配置 */
export interface HermesConfig {
  model: string;                   // e.g. "NousResearch/Hermes-3-Llama-3.1-8B"
  baseUrl: string;                 // Hermes API endpoint
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  tools?: HermesTool[];
}

/** Hermes 工具定义 */
export interface HermesTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ─────────────────────────────────────────────
// 蜜蜂 Agent 系统
// ─────────────────────────────────────────────

/** 研究状态 */
export type ResearchStatus =
  | "idle"
  | "planning"      // 蜂后通过 Hermes 规划搜索策略
  | "searching"     // 蜂群正在各信息源搜索
  | "analyzing"     // Hermes 分析汇总结果
  | "expanding"     // 基于已有知识扩展新方向
  | "reporting"     // 生成报告
  | "completed"
  | "paused"
  | "error";

/** 蜜蜂状态 */
export type BeeStatus =
  | "idle"
  | "searching"     // 正在信息源搜索
  | "analyzing"     // Hermes 在分析该蜜蜂的结果
  | "returning"     // 带回结果
  | "resting"
  | "error"
  | "retired";

/** 搜索任务 — 蜂后分配给蜜蜂的具体任务 */
export interface SearchTask {
  id: string;
  query: string;                   // 搜索查询
  sourceIds: string[];             // 要搜索哪些信息源
  rationale: string;               // 为什么搜索这个
  parentTaskId?: string;           // 深化自哪个任务
  round: number;
  status: "pending" | "active" | "completed" | "failed";
}

/** 蜜蜂 Agent */
export interface BeeAgent {
  id: string;
  name: string;
  task: SearchTask;                // 当前任务
  status: BeeStatus;
  results: SourceResult[];         // 从信息源拉回的原始结果
  analysis?: string;               // Hermes 对结果的分析摘要
  findings: Finding[];             // 提炼后的情报
  round: number;
  createdAt: number;
}

/** 提炼后的情报 */
export interface Finding {
  id: string;
  beeId: string;
  beeName: string;
  title: string;
  summary: string;
  keyInsights: string[];
  sourceResults: SourceResult[];   // 原始来源
  relevanceScore: number;          // 0-1 Hermes 评估的相关性
  noveltyScore: number;            // 0-1 相对已有知识的新颖度
  tags: string[];
  round: number;
  timestamp: number;
}

// ─────────────────────────────────────────────
// 知识图谱 (蜂巢)
// ─────────────────────────────────────────────

export interface KnowledgeNode {
  id: string;
  label: string;
  type: "concept" | "entity" | "fact" | "insight" | "source" | "question" | "contradiction";
  content: string;
  weight: number;
  fromFindings: string[];
  round: number;
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: "supports" | "contradicts" | "causes" | "relates" | "specializes" | "depends";
  weight: number;
  round: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

// ─────────────────────────────────────────────
// 聊天 & 研究项目
// ─────────────────────────────────────────────

/** 聊天消息 */
export interface ChatMessage {
  id: string;
  role: "user" | "queen" | "bee" | "system";
  content: string;
  beeName?: string;
  metadata?: {
    type?: "thinking" | "action" | "result" | "planning" | "error";
    round?: number;
    sources?: string[];            // 引用的信息源
    taskId?: string;
  };
  timestamp: number;
}

/** 轮次摘要 */
export interface RoundSummary {
  round: number;
  tasksCompleted: number;
  findingsCount: number;
  sourcesUsed: string[];
  keyDiscoveries: string[];
  gapsIdentified: string[];
  nextStrategy: string;
  timestamp: number;
}

/** 研究项目 */
export interface Research {
  id: string;
  title: string;
  objective: string;
  status: ResearchStatus;
  bees: BeeAgent[];
  graph: KnowledgeGraph;
  messages: ChatMessage[];
  roundSummaries: RoundSummary[];
  report?: string;
  currentRound: number;
  totalSearches: number;           // 已使用的搜索次数
  totalFindings: number;
  sourcesUsed: string[];           // 使用了哪些信息源 ID
  config: ResearchConfig;
  createdAt: number;
  updatedAt: number;
}

/** 研究配置 */
export interface ResearchConfig {
  maxBees: number;
  maxSearches: number;             // 最大搜索次数预算（AI 自主决定轮次，这是唯一硬约束）
  beeTimeout: number;              // 单只蜜蜂超时时间（秒），超时后放弃该蜜蜂继续下一轮
  selectedSources: string[];       // 选择哪些信息源
  language: string;
}

/** 全局事件 */
export interface SwarmEvent {
  type: string;
  beeId?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}
