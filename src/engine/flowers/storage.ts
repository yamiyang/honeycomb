/* ============================================================
   🌸 花田存储 — 服务端持久化
   
   在服务端以 JSON 文件存储信息源列表和状态。
   首次启动时从 DEFAULT_SOURCES 初始化。
   ============================================================ */
import { promises as fs } from "fs";
import path from "path";
import type { FlowerSource } from "@/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const SOURCES_FILE = path.join(DATA_DIR, "flower-sources.json");

/** 默认信息源定义 — 与之前 DEFAULT_SOURCES 一致 */
const DEFAULT_SOURCES: FlowerSource[] = [
  {
    id: "google",
    type: "google",
    name: "Google Search",
    icon: "🔍",
    description: "谷歌网页搜索 — 全球最大搜索引擎",
    status: "inactive",
    config: {},
    capabilities: ["search", "realtime"],
    createdAt: Date.now(),
  },
  {
    id: "twitter",
    type: "twitter",
    name: "Twitter/X",
    icon: "🐦",
    description: "Twitter/X 社交媒体 — 实时信息、观点、趋势",
    status: "inactive",
    config: {},
    capabilities: ["search", "trending", "realtime", "user_profile", "comments"],
    createdAt: Date.now(),
  },
  {
    id: "github",
    type: "github",
    name: "GitHub",
    icon: "🐙",
    description: "GitHub 代码托管 — 开源项目、代码、技术讨论",
    status: "active",
    config: {},
    capabilities: ["search", "code", "trending", "user_profile", "comments"],
    createdAt: Date.now(),
  },
  {
    id: "arxiv",
    type: "arxiv",
    name: "arXiv",
    icon: "📄",
    description: "arXiv 预印本 — 物理、数学、计算机科学等前沿论文",
    status: "active",
    config: {},
    capabilities: ["search", "papers"],
    createdAt: Date.now(),
  },
  {
    id: "scholar",
    type: "scholar",
    name: "Google Scholar",
    icon: "🎓",
    description: "Google Scholar — 学术论文、引用、专利",
    status: "inactive",
    config: {},
    capabilities: ["search", "papers", "historical"],
    createdAt: Date.now(),
  },
  {
    id: "reddit",
    type: "reddit",
    name: "Reddit",
    icon: "🤖",
    description: "Reddit — 社区讨论、深度分析、用户观点（需 OAuth 认证）",
    status: "inactive",
    config: {},
    capabilities: ["search", "trending", "comments"],
    createdAt: Date.now(),
  },
  {
    id: "hackernews",
    type: "hackernews",
    name: "Hacker News",
    icon: "🧡",
    description: "Hacker News — 技术社区新闻与讨论",
    status: "active",
    config: {},
    capabilities: ["search", "trending", "comments"],
    createdAt: Date.now(),
  },
  {
    id: "youtube",
    type: "youtube",
    name: "YouTube",
    icon: "📺",
    description: "YouTube — 视频内容搜索、字幕提取",
    status: "inactive",
    config: {},
    capabilities: ["search", "media", "trending"],
    createdAt: Date.now(),
  },
  {
    id: "web",
    type: "web",
    name: "Web Search",
    icon: "🕸️",
    description: "通用网页搜索 — DuckDuckGo（免费）/ Jina（需配 Key）",
    status: "active",
    config: {},
    capabilities: ["search"],
    createdAt: Date.now(),
  },
  {
    id: "wikipedia",
    type: "wikipedia",
    name: "Wikipedia",
    icon: "📚",
    description: "维基百科 — 多语言百科全书知识库（免费）",
    status: "active",
    config: {},
    capabilities: ["search", "historical"],
    createdAt: Date.now(),
  },
  {
    id: "stackoverflow",
    type: "stackoverflow",
    name: "StackOverflow",
    icon: "💡",
    description: "StackOverflow — 编程问答社区（免费）",
    status: "active",
    config: {},
    capabilities: ["search", "trending", "comments", "code"],
    createdAt: Date.now(),
  },
  {
    id: "duckduckgo",
    type: "duckduckgo",
    name: "DuckDuckGo",
    icon: "🦆",
    description: "DuckDuckGo — 隐私搜索引擎（免费，无需 Key）",
    status: "active",
    config: {},
    capabilities: ["search"],
    createdAt: Date.now(),
  },
  {
    id: "bilibili",
    type: "bilibili",
    name: "Bilibili",
    icon: "📺",
    description: "B站 — 中文视频内容搜索（免费）",
    status: "inactive",
    config: {},
    capabilities: ["search", "trending", "media", "comments"],
    createdAt: Date.now(),
  },
  {
    id: "rss",
    type: "rss",
    name: "RSS Feeds",
    icon: "📡",
    description: "RSS/Atom 订阅源 — 博客、新闻站点聚合（免费）",
    status: "active",
    config: {},
    capabilities: ["search", "realtime"],
    createdAt: Date.now(),
  },
  {
    id: "searx",
    type: "custom",
    name: "Searx (元搜索)",
    icon: "🔎",
    description: "Searx 元搜索引擎 — 聚合 Google/Bing/DDG 结果（免费，无需 Key）",
    status: "active",
    config: {},
    capabilities: ["search"],
    createdAt: Date.now(),
  },
  {
    id: "brave",
    type: "custom",
    name: "Brave Search",
    icon: "🦁",
    description: "Brave 搜索引擎 — 独立索引，注重隐私（免费 2000次/月）",
    status: "inactive",
    config: {},
    capabilities: ["search"],
    createdAt: Date.now(),
  },
];

/** 确保 .data 目录存在 */
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // 已存在，忽略
  }
}

/** 读取信息源列表，不存在则用默认值初始化 */
export async function readFlowerSources(): Promise<FlowerSource[]> {
  await ensureDataDir();

  try {
    const raw = await fs.readFile(SOURCES_FILE, "utf-8");
    const sources: FlowerSource[] = JSON.parse(raw);
    return sources;
  } catch {
    // 文件不存在或损坏，用默认值初始化
    await writeFlowerSources(DEFAULT_SOURCES);
    return DEFAULT_SOURCES;
  }
}

/** 写入信息源列表 */
export async function writeFlowerSources(sources: FlowerSource[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(SOURCES_FILE, JSON.stringify(sources, null, 2), "utf-8");
}
