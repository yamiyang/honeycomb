/* ============================================================
   🐝 Argus — Global Research Store (Zustand)
   
   管理：研究项目、蜜蜂状态、知识图谱、信息源配置
   ============================================================ */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type {
  Research,
  BeeAgent,
  Finding,
  KnowledgeNode,
  KnowledgeEdge,
  ChatMessage,
  SwarmEvent,
  BeeStatus,
  ResearchStatus,
  ResearchConfig,
  RoundSummary,
  FlowerSource,
  SourceConfig,
  SourceType,
} from "@/types";
import { flowerField, DEFAULT_SOURCES } from "@/engine/flowers";
import { registerAllAdapters } from "@/engine/flowers/adapters";

/* ---------- helpers ---------- */

const BEE_NAMES = [
  "花粉", "蜜糖", "嗡嗡", "金翅", "小蜜", "甜甜",
  "飞飞", "露露", "阳阳", "果果", "星星", "暖暖",
  "朵朵", "萌萌", "闪闪", "圆圆", "棉棉", "糖糖",
];

let beeNameIndex = 0;
function nextBeeName() {
  const n = BEE_NAMES[beeNameIndex % BEE_NAMES.length];
  beeNameIndex++;
  return n;
}

const DEFAULT_CONFIG: ResearchConfig = {
  maxBees: 8,
  maxSearches: 100,
  selectedSources: [],
  language: "zh-CN",
};

/* ---------- store interface ---------- */

interface ResearchStore {
  /* state */
  researches: Research[];
  activeResearchId: string | null;
  events: SwarmEvent[];
  
  /* 花田 — 信息源配置 */
  flowerSources: FlowerSource[];
  
  /* computed-like */
  activeResearch: () => Research | undefined;

  /* --- 花田 (信息源) 管理 --- */
  initFlowerField: () => void;
  addFlowerSource: (type: SourceType, name: string, config: SourceConfig) => string;
  updateFlowerSource: (id: string, updates: Partial<FlowerSource>) => void;
  removeFlowerSource: (id: string) => void;
  toggleFlowerSource: (id: string) => void;

  /* --- Research CRUD --- */
  createResearch: (title: string, objective: string, config?: Partial<ResearchConfig>) => string;
  deleteResearch: (id: string) => void;
  setActiveResearch: (id: string | null) => void;
  updateResearchStatus: (id: string, status: ResearchStatus) => void;

  /* --- Bees --- */
  dispatchBee: (researchId: string, topic: string) => string;
  reassignBee: (researchId: string, beeId: string, topic: string, round: number) => void;
  getRestingBee: (researchId: string) => BeeAgent | undefined;
  updateBeeStatus: (researchId: string, beeId: string, status: BeeStatus) => void;
  addFinding: (researchId: string, beeId: string, finding: Omit<Finding, "id" | "beeId" | "beeName" | "timestamp">) => void;

  /* --- Knowledge Graph --- */
  addGraphNode: (researchId: string, node: Omit<KnowledgeNode, "id">) => string;
  addGraphEdge: (researchId: string, edge: Omit<KnowledgeEdge, "id">) => void;

  /* --- Rounds --- */
  addRoundSummary: (researchId: string, summary: Omit<RoundSummary, "timestamp">) => void;
  incrementRound: (researchId: string) => void;

  /* --- Chat --- */
  addMessage: (researchId: string, msg: Omit<ChatMessage, "id" | "timestamp">) => void;

  /* --- Report --- */
  setReport: (researchId: string, content: string) => void;

  /* --- Events --- */
  pushEvent: (evt: Omit<SwarmEvent, "timestamp">) => void;
  clearEvents: () => void;
}

/* ---------- store implementation ---------- */

export const useResearchStore = create<ResearchStore>()(
  persist(
    (set, get) => ({
      researches: [],
      activeResearchId: null,
      events: [],
      flowerSources: [],

      activeResearch: () => {
        const { researches, activeResearchId } = get();
        return researches.find((r) => r.id === activeResearchId);
      },

      // ─── 花田管理 ───

      initFlowerField: () => {
        // 注册所有适配器
        registerAllAdapters();

        const sources = get().flowerSources;

        if (sources.length === 0) {
          // 首次初始化 — 使用 DEFAULT_SOURCES，注意 type 作为 id 的前缀保证稳定
          const defaultSources: FlowerSource[] = DEFAULT_SOURCES.map(s => ({
            ...s,
            id: s.type, // 用 type 作为稳定 id，方便 Hermes 引用
            createdAt: Date.now(),
          }));
          set({ flowerSources: defaultSources });
          for (const source of defaultSources) {
            flowerField.addSource(source);
          }
        } else {
          // 已有持久化数据 — 同步到 flowerField 运行时
          // 同时确保免费源至少被激活
          const FREE_TYPES: SourceType[] = ["arxiv", "hackernews", "reddit", "github"];
          const updatedSources = sources.map(source => {
            if (FREE_TYPES.includes(source.type) && source.status === "inactive") {
              return { ...source, status: "active" as const };
            }
            return source;
          });
          set({ flowerSources: updatedSources });
          for (const source of updatedSources) {
            flowerField.addSource(source);
          }
        }
      },

      addFlowerSource: (type, name, config) => {
        const adapter = flowerField.getAdapter(type);
        const id = nanoid(8);
        const source: FlowerSource = {
          id,
          type,
          name,
          icon: adapter?.icon || "🌸",
          description: adapter?.description || "",
          status: "active",
          config,
          capabilities: adapter?.capabilities || [],
          createdAt: Date.now(),
        };
        flowerField.addSource(source);
        set((s) => ({ flowerSources: [...s.flowerSources, source] }));
        return id;
      },

      updateFlowerSource: (id, updates) => {
        set((s) => ({
          flowerSources: s.flowerSources.map(f => {
            if (f.id !== id) return f;
            const updated = { ...f, ...updates };
            flowerField.addSource(updated); // 覆盖
            return updated;
          }),
        }));
      },

      removeFlowerSource: (id) => {
        flowerField.removeSource(id);
        set((s) => ({ flowerSources: s.flowerSources.filter(f => f.id !== id) }));
      },

      toggleFlowerSource: (id) => {
        const source = get().flowerSources.find(f => f.id === id);
        if (!source) return;
        const newStatus = source.status === "active" ? "inactive" : "active";
        get().updateFlowerSource(id, { status: newStatus });
        flowerField.updateSourceStatus(id, newStatus);
      },

      // ─── Research CRUD ───

      createResearch: (title, objective, config) => {
        const id = nanoid(10);
        const now = Date.now();
        const activeSources = get().flowerSources.filter(s => s.status === "active").map(s => s.id);
        const research: Research = {
          id,
          title,
          objective,
          status: "idle",
          bees: [],
          graph: { nodes: [], edges: [] },
          messages: [],
          roundSummaries: [],
          currentRound: 0,
          totalSearches: 0,
          totalFindings: 0,
          sourcesUsed: activeSources,
          config: { ...DEFAULT_CONFIG, selectedSources: activeSources, ...config },
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ researches: [research, ...s.researches] }));
        return id;
      },

      deleteResearch: (id) =>
        set((s) => ({
          researches: s.researches.filter((r) => r.id !== id),
          activeResearchId: s.activeResearchId === id ? null : s.activeResearchId,
        })),

      setActiveResearch: (id) => set({ activeResearchId: id }),

      updateResearchStatus: (id, status) =>
        set((s) => ({
          researches: s.researches.map((r) =>
            r.id === id ? { ...r, status, updatedAt: Date.now() } : r
          ),
        })),

      // ─── Bees ───

      getRestingBee: (researchId) => {
        const research = get().researches.find(r => r.id === researchId);
        if (!research) return undefined;
        return research.bees.find(b => b.status === "resting" || b.status === "idle");
      },

      reassignBee: (researchId, beeId, topic, round) => {
        set((s) => ({
          researches: s.researches.map((r) =>
            r.id === researchId
              ? {
                  ...r,
                  bees: r.bees.map((b) =>
                    b.id === beeId
                      ? {
                          ...b,
                          task: {
                            id: nanoid(6),
                            query: topic,
                            sourceIds: [],
                            rationale: "",
                            round,
                            status: "active" as const,
                          },
                          status: "searching" as BeeStatus,
                          round,
                          // 保留已有 results 和 findings
                        }
                      : b
                  ),
                  updatedAt: Date.now(),
                }
              : r
          ),
        }));
        get().pushEvent({ type: "bee-reassigned", beeId, data: { topic, round } });
      },

      dispatchBee: (researchId, topic) => {
        // 优先复用 resting/idle 的蜜蜂
        const restingBee = get().getRestingBee(researchId);
        if (restingBee) {
          const research = get().researches.find(r => r.id === researchId);
          const currentRound = research?.currentRound || 1;
          get().reassignBee(researchId, restingBee.id, topic, currentRound);
          return restingBee.id;
        }

        // 没有空闲蜜蜂才创建新的
        const research = get().researches.find(r => r.id === researchId);
        const maxBees = research?.config.maxBees || 8;
        const currentBeeCount = research?.bees.length || 0;

        // 检查是否达到蜜蜂上限
        if (currentBeeCount >= maxBees) {
          // 强制复用最久空闲的蜜蜂（即使它状态不是 resting）
          const sortedBees = [...(research?.bees || [])].sort((a, b) => {
            // 优先复用 resting > error > analyzing > returning，最后才是 searching
            const priority: Record<string, number> = { resting: 0, idle: 0, error: 1, returning: 2, analyzing: 3, searching: 4, retired: 5 };
            return (priority[a.status] ?? 3) - (priority[b.status] ?? 3);
          });
          const toReuse = sortedBees[0];
          if (toReuse) {
            const currentRound = research?.currentRound || 1;
            get().reassignBee(researchId, toReuse.id, topic, currentRound);
            return toReuse.id;
          }
        }

        const beeId = nanoid(8);
        const bee: BeeAgent = {
          id: beeId,
          name: nextBeeName(),
          task: {
            id: nanoid(6),
            query: topic,
            sourceIds: [],
            rationale: "",
            round: research?.currentRound || 1,
            status: "active",
          },
          status: "searching",
          results: [],
          findings: [],
          round: research?.currentRound || 1,
          createdAt: Date.now(),
        };
        set((s) => ({
          researches: s.researches.map((r) =>
            r.id === researchId ? { ...r, bees: [...r.bees, bee], updatedAt: Date.now() } : r
          ),
        }));
        get().pushEvent({ type: "bee-dispatched", beeId, data: { topic, name: bee.name } });
        return beeId;
      },

      updateBeeStatus: (researchId, beeId, status) =>
        set((s) => ({
          researches: s.researches.map((r) =>
            r.id === researchId
              ? {
                  ...r,
                  bees: r.bees.map((b) => b.id === beeId ? { ...b, status } : b),
                  updatedAt: Date.now(),
                }
              : r
          ),
        })),

      addFinding: (researchId, beeId, finding) => {
        const research = get().researches.find(r => r.id === researchId);
        const bee = research?.bees.find(b => b.id === beeId);
        const full: Finding = {
          ...finding,
          id: nanoid(8),
          beeId,
          beeName: bee?.name || "未知",
          timestamp: Date.now(),
        };
        set((s) => ({
          researches: s.researches.map((r) =>
            r.id === researchId
              ? {
                  ...r,
                  bees: r.bees.map((b) =>
                    b.id === beeId ? { ...b, findings: [...b.findings, full] } : b
                  ),
                  totalFindings: r.totalFindings + 1,
                  updatedAt: Date.now(),
                }
              : r
          ),
        }));
        get().pushEvent({ type: "bee-found", beeId, data: { title: finding.title } });
      },

      // ─── Knowledge Graph ───

      addGraphNode: (researchId, node) => {
        const research = get().researches.find(r => r.id === researchId);
        if (!research) return "";

        // 去重：如果已有相同 label 的节点，则合并更新（增加权重、追加来源）
        const existing = research.graph.nodes.find(
          n => n.label === node.label || n.label.toLowerCase() === node.label.toLowerCase()
        );

        if (existing) {
          // 合并：更新已有节点的权重和内容
          set((s) => ({
            researches: s.researches.map((r) =>
              r.id === researchId
                ? {
                    ...r,
                    graph: {
                      ...r.graph,
                      nodes: r.graph.nodes.map((n) =>
                        n.id === existing.id
                          ? {
                              ...n,
                              // 权重取较大值
                              weight: Math.min(1, Math.max(n.weight, node.weight)),
                              // 内容：如果新内容更长/更详细则替换
                              content: node.content.length > n.content.length ? node.content : n.content,
                              // 合并来源 findings
                              fromFindings: [...new Set([...n.fromFindings, ...node.fromFindings])],
                              // 更新轮次为最新
                              round: Math.max(n.round, node.round),
                            }
                          : n
                      ),
                    },
                    updatedAt: Date.now(),
                  }
                : r
            ),
          }));
          return existing.id;
        }

        // 新节点
        const id = nanoid(8);
        const full: KnowledgeNode = { ...node, id };
        set((s) => ({
          researches: s.researches.map((r) =>
            r.id === researchId
              ? { ...r, graph: { ...r.graph, nodes: [...r.graph.nodes, full] }, updatedAt: Date.now() }
              : r
          ),
        }));
        return id;
      },

      addGraphEdge: (researchId, edge) => {
        const research = get().researches.find(r => r.id === researchId);
        if (!research) return;

        // 去重：如果已有相同 source→target（或反向且类型相同）的边，则合并
        const existing = research.graph.edges.find(
          e => (e.source === edge.source && e.target === edge.target) ||
               (e.source === edge.target && e.target === edge.source && e.type === edge.type)
        );

        if (existing) {
          // 合并：增加权重
          set((s) => ({
            researches: s.researches.map((r) =>
              r.id === researchId
                ? {
                    ...r,
                    graph: {
                      ...r.graph,
                      edges: r.graph.edges.map((e) =>
                        e.id === existing.id
                          ? {
                              ...e,
                              weight: Math.min(1, e.weight + 0.1),
                              round: Math.max(e.round, edge.round),
                            }
                          : e
                      ),
                    },
                    updatedAt: Date.now(),
                  }
                : r
            ),
          }));
          return;
        }

        const id = nanoid(8);
        const full: KnowledgeEdge = { ...edge, id };
        set((s) => ({
          researches: s.researches.map((r) =>
            r.id === researchId
              ? { ...r, graph: { ...r.graph, edges: [...r.graph.edges, full] }, updatedAt: Date.now() }
              : r
          ),
        }));
      },

      // ─── Rounds ───

      addRoundSummary: (researchId, summary) =>
        set((s) => ({
          researches: s.researches.map((r) =>
            r.id === researchId
              ? { ...r, roundSummaries: [...r.roundSummaries, { ...summary, timestamp: Date.now() }] }
              : r
          ),
        })),

      incrementRound: (researchId) =>
        set((s) => ({
          researches: s.researches.map((r) =>
            r.id === researchId ? { ...r, currentRound: r.currentRound + 1, updatedAt: Date.now() } : r
          ),
        })),

      // ─── Chat ───

      addMessage: (researchId, msg) => {
        const full: ChatMessage = { ...msg, id: nanoid(8), timestamp: Date.now() };
        set((s) => ({
          researches: s.researches.map((r) =>
            r.id === researchId
              ? { ...r, messages: [...r.messages, full], updatedAt: Date.now() }
              : r
          ),
        }));
      },

      // ─── Report ───

      setReport: (researchId, content) => {
        set((s) => ({
          researches: s.researches.map((r) =>
            r.id === researchId
              ? { ...r, report: content, status: "completed" as ResearchStatus, updatedAt: Date.now() }
              : r
          ),
        }));
        get().pushEvent({ type: "report-ready" });
      },

      // ─── Events ───

      pushEvent: (evt) =>
        set((s) => ({
          events: [...s.events.slice(-50), { ...evt, timestamp: Date.now() }],
        })),

      clearEvents: () => set({ events: [] }),
    }),
    {
      name: "argus-research-store",
      version: 5, // v5: 知识图谱去重合并 + 蜜蜂复用机制
      partialize: (state) => ({
        researches: state.researches,
        flowerSources: state.flowerSources,
      }),
    }
  )
);
