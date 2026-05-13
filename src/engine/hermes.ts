/* ============================================================
   🐝 BeeSearch — Hermes Agent Core
   
   底层 AI 引擎，基于 Hermes (NousResearch) 模型。
   负责：
   1. 研究规划 — 根据目标拆解搜索任务
   2. 结果分析 — 对信息源返回的结果进行摘要和提炼
   3. 知识综合 — 构建知识图谱
   4. 方向扩展 — 基于已有知识规划新的搜索方向
   5. 报告生成 — 最终研究报告
   ============================================================ */

import type { HermesConfig, HermesMessage, HermesTool, SearchTask, SourceResult, Finding, KnowledgeNode, KnowledgeEdge } from "@/types";

// ─────────────────────────────────────────────
// 默认配置
// ─────────────────────────────────────────────

const DEFAULT_HERMES_CONFIG: HermesConfig = {
  model: "NousResearch/Hermes-3-Llama-3.1-8B",
  baseUrl: process.env.NEXT_PUBLIC_HERMES_BASE_URL || "http://localhost:11434/v1",
  apiKey: process.env.NEXT_PUBLIC_HERMES_API_KEY || "ollama",
  temperature: 0.7,
  maxTokens: 8192,
};

// ─────────────────────────────────────────────
// Hermes API 调用
// ─────────────────────────────────────────────

export class HermesAgent {
  private config: HermesConfig;

  constructor(config?: Partial<HermesConfig>) {
    this.config = { ...DEFAULT_HERMES_CONFIG, ...config };
  }

  /**
   * 基础 chat completion 调用
   * 浏览器端走 /api/hermes 代理，服务端直接调用 LLM
   */
  async chat(messages: HermesMessage[], tools?: HermesTool[]): Promise<string> {
    const IS_BROWSER = typeof window !== "undefined";

    if (IS_BROWSER) {
      // 浏览器端：走 API Route 代理
      const body: Record<string, unknown> = {
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      };
      if (tools && tools.length > 0) {
        body.tools = tools;
      }

      const response = await fetch("/api/hermes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Hermes API error: ${response.status} — ${err}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data.choices?.[0]?.message?.content || "";
    }

    // 服务端：直接调用
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: false,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Hermes API error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  /**
   * 流式 chat completion
   */
  async *chatStream(messages: HermesMessage[]): AsyncGenerator<string> {
    const body = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: true,
    };

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Hermes stream error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader available");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // skip invalid JSON
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────
  // 高层功能：研究规划
  // ─────────────────────────────────────────────

  /**
   * 根据研究目标，规划初始搜索任务
   */
  async planResearch(objective: string, availableSources: string[]): Promise<SearchTask[]> {
    const systemPrompt = `你是 BeeSearch 研究系统的"蜂后"智能体。你的角色是将用户的研究目标分解为具体的搜索任务。

规则：
1. 将目标分解为 3-6 个互补的搜索方向
2. 每个搜索方向应该有明确的搜索查询 (query)
3. 为每个任务指定最适合的信息源
4. 解释为什么这个方向值得探索 (rationale)

可用信息源: ${availableSources.join(", ")}

输出严格 JSON 格式:
[
  {
    "query": "搜索查询词",
    "sourceIds": ["source_id_1", "source_id_2"],
    "rationale": "为什么探索这个方向"
  }
]

只输出 JSON 数组，不要其他文字。`;

    const messages: HermesMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `研究目标：${objective}` },
    ];

    const response = await this.chat(messages);
    
    try {
      const tasks = JSON.parse(this.extractJSON(response));
      return tasks.map((t: { query: string; sourceIds: string[]; rationale: string }, i: number) => ({
        id: `task_${Date.now()}_${i}`,
        query: t.query,
        sourceIds: t.sourceIds,
        rationale: t.rationale,
        round: 1,
        status: "pending" as const,
      }));
    } catch {
      // Fallback: 用目标本身作为查询
      return [{
        id: `task_${Date.now()}_0`,
        query: objective,
        sourceIds: availableSources,
        rationale: "直接搜索研究目标",
        round: 1,
        status: "pending" as const,
      }];
    }
  }

  /**
   * 分析搜索结果，提炼情报
   */
  async analyzeResults(
    objective: string,
    task: SearchTask,
    results: SourceResult[],
    existingFindings: Finding[]
  ): Promise<{
    summary: string;
    keyInsights: string[];
    relevanceScore: number;
    noveltyScore: number;
    tags: string[];
  }> {
    const existingContext = existingFindings.length > 0
      ? `\n已有情报摘要：\n${existingFindings.map(f => `- ${f.title}: ${f.summary}`).join("\n")}`
      : "";

    const systemPrompt = `你是 BeeSearch 研究系统的分析蜂。分析以下搜索结果，提炼关键情报。

研究目标: ${objective}
搜索查询: ${task.query}
${existingContext}

对搜索结果进行分析，输出 JSON:
{
  "summary": "200字内的综合摘要",
  "keyInsights": ["关键洞察1", "关键洞察2", ...],
  "relevanceScore": 0.0-1.0,
  "noveltyScore": 0.0-1.0,
  "tags": ["标签1", "标签2", ...]
}

relevanceScore: 与研究目标的相关性
noveltyScore: 相对于已有情报的新颖程度 (如果没有已有情报则为1.0)

只输出 JSON，不要其他文字。`;

    const resultContent = results.map(r => 
      `[${r.sourceName}] ${r.title}\n${r.content.slice(0, 500)}\nURL: ${r.url}`
    ).join("\n\n---\n\n");

    const messages: HermesMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `搜索结果:\n\n${resultContent}` },
    ];

    const response = await this.chat(messages);

    try {
      return JSON.parse(this.extractJSON(response));
    } catch {
      return {
        summary: results.map(r => r.title).join("; "),
        keyInsights: results.map(r => r.title),
        relevanceScore: 0.5,
        noveltyScore: 0.5,
        tags: [],
      };
    }
  }

  /**
   * 基于已有知识，规划下一轮扩展方向
   */
  async planExpansion(
    objective: string,
    currentFindings: Finding[],
    roundSummaries: { round: number; keyDiscoveries: string[]; gapsIdentified: string[] }[],
    availableSources: string[]
  ): Promise<SearchTask[]> {
    const systemPrompt = `你是 BeeSearch 研究系统的蜂后。基于已有情报，规划下一轮搜索方向。

研究目标: ${objective}
可用信息源: ${availableSources.join(", ")}

已有情报:
${currentFindings.map(f => `- [${f.tags.join(",")}] ${f.title}: ${f.summary}`).join("\n")}

${roundSummaries.length > 0 ? `历轮总结:\n${roundSummaries.map(r => `第${r.round}轮: 发现=${r.keyDiscoveries.join(";")} 空白=${r.gapsIdentified.join(";")}`).join("\n")}` : ""}

规划原则：
1. 填补已识别的知识空白
2. 深化高相关性但浅度覆盖的方向
3. 探索可能被忽略的交叉领域
4. 验证可能存在矛盾的信息

输出 JSON 数组:
[
  {
    "query": "搜索查询",
    "sourceIds": ["source_id"],
    "rationale": "为什么探索这个",
    "parentTaskId": "可选，延续哪个已有任务"
  }
]

只输出 JSON。`;

    const messages: HermesMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "请规划下一轮搜索方向。" },
    ];

    const response = await this.chat(messages);

    try {
      const tasks = JSON.parse(this.extractJSON(response));
      return tasks.map((t: { query: string; sourceIds: string[]; rationale: string; parentTaskId?: string }, i: number) => ({
        id: `task_${Date.now()}_${i}`,
        query: t.query,
        sourceIds: t.sourceIds,
        rationale: t.rationale,
        parentTaskId: t.parentTaskId,
        round: (roundSummaries.length || 0) + 2,
        status: "pending" as const,
      }));
    } catch {
      return [];
    }
  }

  /**
   * AI 自主决策：下一步做什么
   * 这是启发式搜索的核心 — AI 自己判断：
   * - 是否已经充分覆盖了研究目标
   * - 是否需要继续搜索，如果是，搜什么
   * - 是否有信息空白或矛盾需要验证
   */
  async decideNextAction(
    objective: string,
    currentFindings: Finding[],
    graph: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] },
    roundSummaries: { round: number; keyDiscoveries: string[]; gapsIdentified: string[] }[],
    availableSources: string[],
    usedSearches: number,
    maxSearches: number
  ): Promise<{
    action: "continue" | "stop";
    reasoning: string;
    tasks: SearchTask[];
  }> {
    const completedRounds = roundSummaries.length;
    const budgetUsedPct = Math.round((usedSearches / maxSearches) * 100);
    const findingsDigest = currentFindings.map(f =>
      `- [R${f.round}][${f.tags.join(",")}] ${f.title}: ${f.summary.slice(0, 120)}`
    ).join("\n");

    const graphNodesDigest = graph.nodes.length > 0
      ? graph.nodes.map(n => `- [${n.type}] ${n.label} (权重:${n.weight.toFixed(2)}): ${n.content.slice(0, 80)}`).join("\n")
      : "（知识图谱尚未建立，说明还需要更多情报来构建全貌）";

    const contradictions = graph.nodes.filter(n => n.type === "contradiction" || n.type === "question");
    const contradictionsDigest = contradictions.length > 0
      ? contradictions.map(n => `- [${n.type}] ${n.label}: ${n.content}`).join("\n")
      : "尚未发现矛盾（可能需要更多交叉验证）";

    const systemPrompt = `你是 BeeSearch 研究系统的蜂后（Queen Agent）。你要做一个重要决策：**继续搜索还是停止？**

## 核心原则
你是一个**深度研究者**。除非有充分理由停止，否则应该继续搜索。
- 前 3 轮应该**始终继续**（除非搜索完全没结果）——因为刚开始不可能充分覆盖
- 只有在"情报已从多角度交叉验证、无明显空白"时才应该停止
- 宁可多搜几轮、收集更多证据，也不要过早停止

## 当前状态
- 研究目标: ${objective}
- 已完成轮次: ${completedRounds} 轮
- 已用搜索预算: ${usedSearches}/${maxSearches} 次 (${budgetUsedPct}%)
- 已收集情报: ${currentFindings.length} 条
- 知识图谱: ${graph.nodes.length} 个节点, ${graph.edges.length} 条关系
- 可用信息源: ${availableSources.join(", ")}

## 已有情报
${findingsDigest || "暂无情报"}

## 知识图谱节点
${graphNodesDigest}

## 矛盾与待解答问题
${contradictionsDigest}

## 各轮回顾
${roundSummaries.map(r => `第${r.round}轮: 发现=[${r.keyDiscoveries.join("; ")}] 空白=[${r.gapsIdentified.join("; ") || "未识别"}]`).join("\n") || "暂无"}

## 停止条件（必须同时满足以下大部分条件才能停止）
1. 已经完成至少 3 轮搜索
2. 核心问题有多个来源交叉验证
3. 最近 2 轮的新情报与已有情报大量重复（边际收益递减）
4. 没有明显的知识空白或未验证矛盾
5. 研究目标的各主要方面都有覆盖

## 输出格式
输出严格 JSON（不要包裹在代码块中）:
{
  "action": "continue",
  "reasoning": "用中文解释决策原因（50字内）",
  "tasks": [
    {
      "query": "搜索关键词",
      "sourceIds": ["信息源ID"],
      "rationale": "为什么搜这个方向"
    }
  ]
}

action 只能是 "continue" 或 "stop"。
- "continue" 时 tasks 必须包含 1-6 个任务
- "stop" 时 tasks 为空数组 []

直接输出 JSON，不要其他文字。`;

    const messages: HermesMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "请分析当前研究状态，做出下一步决策。" },
    ];

    const response = await this.chat(messages);
    console.log("[Hermes] decideNextAction raw response:", response.slice(0, 500));

    try {
      const jsonStr = this.extractJSON(response);
      const decision = JSON.parse(jsonStr);
      
      // 健壮地解析 action — 只有明确说 stop 才停
      const actionRaw = String(decision.action || "").toLowerCase().trim();
      const shouldStop = actionRaw === "stop";

      if (shouldStop) {
        // 额外安全检查：前 3 轮强制不停（除非情报为 0）
        if (completedRounds < 3 && currentFindings.length > 0) {
          console.log("[Hermes] AI wanted to stop at round", completedRounds, "but forcing continue (< 3 rounds)");
          // 使用 planExpansion 作为备选来生成任务
          const fallbackTasks = await this.planExpansion(objective, currentFindings, roundSummaries, availableSources);
          if (fallbackTasks.length > 0) {
            return {
              action: "continue",
              reasoning: `研究仅 ${completedRounds} 轮，信息量不足，继续深入`,
              tasks: fallbackTasks,
            };
          }
        }
        return {
          action: "stop",
          reasoning: decision.reasoning || "AI 判断研究已充分",
          tasks: [],
        };
      }

      // action = continue
      const tasks: SearchTask[] = (decision.tasks || [])
        .filter((t: { query?: string }) => t && t.query)
        .map((t: { query: string; sourceIds?: string[]; rationale?: string }, i: number) => ({
          id: `task_${Date.now()}_${i}`,
          query: t.query,
          sourceIds: t.sourceIds || [],
          rationale: t.rationale || "",
          round: completedRounds + 2,
          status: "pending" as const,
        }));

      // 如果 AI 说 continue 但没给任务，用 planExpansion 兜底
      if (tasks.length === 0) {
        console.log("[Hermes] AI said continue but gave no tasks, falling back to planExpansion");
        const fallbackTasks = await this.planExpansion(objective, currentFindings, roundSummaries, availableSources);
        return {
          action: fallbackTasks.length > 0 ? "continue" : "stop",
          reasoning: fallbackTasks.length > 0 ? (decision.reasoning || "继续深入研究") : "无法生成新搜索方向",
          tasks: fallbackTasks,
        };
      }

      return {
        action: "continue",
        reasoning: decision.reasoning || "继续深入研究",
        tasks,
      };
    } catch (err) {
      console.error("[Hermes] decideNextAction JSON parse failed:", err, "\nRaw:", response.slice(0, 300));
      // 解析失败时：前 3 轮不放弃，用 planExpansion 兜底
      if (completedRounds < 3 && currentFindings.length > 0) {
        const fallbackTasks = await this.planExpansion(objective, currentFindings, roundSummaries, availableSources);
        if (fallbackTasks.length > 0) {
          return {
            action: "continue",
            reasoning: "决策解析异常，使用备选方案继续搜索",
            tasks: fallbackTasks,
          };
        }
      }
      return {
        action: "stop",
        reasoning: "AI 决策响应解析失败，安全停止",
        tasks: [],
      };
    }
  }

  /**
   * 构建/更新知识图谱
   */
  async buildKnowledgeGraph(
    objective: string,
    findings: Finding[],
    existingNodes: KnowledgeNode[],
    existingEdges: KnowledgeEdge[]
  ): Promise<{ nodes: Omit<KnowledgeNode, "id">[]; edges: Omit<KnowledgeEdge, "id">[] }> {
    const round = findings[0]?.round || 1;
    const systemPrompt = `你是 BeeSearch 知识图谱构建蜂。你的任务是从新情报中提取概念节点和关系，构建知识图谱。

**你必须提取至少 3 个节点和 2 条关系。** 仔细阅读每条情报，识别其中的关键概念、实体、事实、洞察。

研究目标: ${objective}

现有图谱节点（${existingNodes.length} 个）:
${existingNodes.map(n => `- "${n.label}" (${n.type}, 权重:${n.weight.toFixed(2)})`).join("\n") || "（空，这是第一次构建）"}

现有图谱边（${existingEdges.length} 条）:
${existingEdges.map(e => {
  const srcLabel = existingNodes.find(n => n.id === e.source)?.label || e.source;
  const tgtLabel = existingNodes.find(n => n.id === e.target)?.label || e.target;
  return `- "${srcLabel}" --[${e.label}]--> "${tgtLabel}"`;
}).join("\n") || "（空）"}

新情报（${findings.length} 条）:
${findings.map((f, i) => `[情报${i + 1}] ${f.title}
摘要: ${f.summary}
洞察: ${f.keyInsights.join("; ")}
标签: ${f.tags.join(", ")}`).join("\n\n")}

## 提取规则
1. **节点**：每条情报至少提取 1 个节点（概念/实体/事实/洞察）
2. **关系**：识别节点之间的逻辑关系（支持/矛盾/因果/关联/细化/依赖）
3. **⚠️ 去重关键规则**：如果新概念与现有节点含义相同，请使用**完全相同的 label 字符串**来引用它，不要创建新节点！系统会自动合并同名节点。
4. **权重**：核心概念权重 0.7-1.0，次要概念 0.3-0.7
5. **关系的 source/target 必须使用节点的 label 字符串**（不管是新节点还是已有节点）

输出严格 JSON（不要代码块包裹）:
{
  "nodes": [
    {"label": "节点名称", "type": "concept", "content": "简要描述这个概念", "weight": 0.8, "fromFindings": [], "round": ${round}}
  ],
  "edges": [
    {"source": "节点label", "target": "节点label", "label": "关系描述", "type": "relates", "weight": 0.7, "round": ${round}}
  ]
}

type 可选值:
- 节点: concept | entity | fact | insight | question | contradiction
- 关系: supports | contradicts | causes | relates | specializes | depends

直接输出 JSON。`;

    const messages: HermesMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "请基于上述新情报提取知识图谱节点和关系。" },
    ];

    console.log("[Hermes] buildKnowledgeGraph: calling LLM...");
    
    const response = await this.chat(messages);
    console.log("[Hermes] buildKnowledgeGraph raw response length:", response.length);

    try {
      const jsonStr = this.extractJSON(response);
      const parsed = JSON.parse(jsonStr);
      const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
      const edges = Array.isArray(parsed.edges) ? parsed.edges : [];
      console.log(`[Hermes] buildKnowledgeGraph: extracted ${nodes.length} nodes, ${edges.length} edges`);
      return { nodes, edges };
    } catch (err) {
      console.error("[Hermes] buildKnowledgeGraph JSON parse failed:", err);
      console.error("[Hermes] Raw response:", response.slice(0, 500));
      return { nodes: [], edges: [] };
    }
  }

  /**
   * 生成最终 HTML 网页研究报告
   */
  async generateReport(
    objective: string,
    findings: Finding[],
    graph: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] },
    roundSummaries: { round: number; keyDiscoveries: string[] }[]
  ): Promise<string> {
    const systemPrompt = `你是 BeeSearch 研究报告生成蜂。基于所有收集的情报和知识图谱，生成一份**完整的 HTML 网页研究报告**。

重要：你必须输出一个完整的 HTML 文档（不要 markdown！），包含内嵌 CSS 样式。

HTML 报告必须包含以下部分：
1. **报告封面** — 标题、研究目标、日期、统计摘要（总情报数、信息源数、知识节点数、研究轮次数）
2. **执行摘要** — 300字以内的核心发现概要
3. **主要发现** — 按主题分组的关键发现，每个发现标注来源和可信度
4. **深度分析** — 交叉分析、趋势判断、因果推断、竞争格局等
5. **知识图谱洞察** — 从知识图谱中发现的核心概念网络、关键路径和矛盾点
6. **信息源分析** — 各信息源贡献对比（表格形式）
7. **研究轮次回顾** — 每轮的发现、策略调整和知识增长
8. **结论与建议** — 核心结论（带置信度评分）和下一步行动建议
9. **附录：参考来源** — 所有引用的信息源（标题+URL 可点击链接）

HTML 样式要求：
- 使用现代扁平设计，配色以 #FFC107（蜂蜜金）和 #3D2C00（蜂褐）为主
- 字体使用系统默认 sans-serif
- 报告宽度 max-width: 900px，居中显示
- 各章节有清晰的分隔线和锚点导航
- 表格使用交替行背景色
- 知识图谱部分用 HTML/CSS 绘制简化的节点关系图（用 flexbox + 圆角 div 模拟节点和连线）
- 页面顶部要有一个固定的导航栏，可以快速跳转到各个章节
- 报告末尾标注 "由 BeeSearch 蜂群智能系统生成"

用中文撰写，内容要专业、深入、有数据支撑。直接输出完整 HTML，不要用 markdown 代码块包裹。`;

    const context = `研究目标: ${objective}

情报汇总 (${findings.length}条):
${findings.map((f, i) => `### [情报${i + 1}] ${f.title}
- 来源: ${f.sourceResults.map(r => `${r.sourceName}(${r.url})`).join(", ")}
- 摘要: ${f.summary}
- 关键洞察: ${f.keyInsights.join("; ")}
- 相关性: ${f.relevanceScore.toFixed(2)} | 新颖度: ${f.noveltyScore.toFixed(2)}
- 标签: ${f.tags.join(", ")}
- 轮次: 第${f.round}轮
`).join("\n")}

知识图谱: ${graph.nodes.length} 个节点, ${graph.edges.length} 条关系

核心概念节点:
${graph.nodes.map(n => `- [${n.type}] ${n.label}: ${n.content} (权重: ${n.weight})`).join("\n")}

关系网络:
${graph.edges.map(e => {
  const src = graph.nodes.find(n => n.id === e.source)?.label || e.source;
  const tgt = graph.nodes.find(n => n.id === e.target)?.label || e.target;
  return `- ${src} --[${e.label}(${e.type})]--> ${tgt}`;
}).join("\n")}

各轮发现:
${roundSummaries.map(r => `第${r.round}轮: ${r.keyDiscoveries.join("; ")}`).join("\n")}

统计信息:
- 总研究轮次: ${roundSummaries.length}
- 总情报数: ${findings.length}
- 知识节点数: ${graph.nodes.length}
- 知识关系数: ${graph.edges.length}
- 使用信息源: ${[...new Set(findings.flatMap(f => f.sourceResults.map(r => r.sourceName)))].join(", ")}`;

    const messages: HermesMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: context },
    ];

    const rawReport = await this.chat(messages);
    
    // 确保返回的是 HTML — 如果 AI 意外输出了代码块包裹，去掉
    let html = rawReport.trim();
    if (html.startsWith("```html")) {
      html = html.slice(7);
    } else if (html.startsWith("```")) {
      html = html.slice(3);
    }
    if (html.endsWith("```")) {
      html = html.slice(0, -3);
    }
    html = html.trim();
    
    // 如果 AI 没有返回完整 HTML，包装一下
    if (!html.toLowerCase().includes("<!doctype") && !html.toLowerCase().includes("<html")) {
      html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BeeSearch 研究报告 — ${objective}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #FFFDF5; color: #3D2C00; line-height: 1.7; }
  .container { max-width: 900px; margin: 0 auto; padding: 2rem; }
  h1 { color: #3D2C00; border-bottom: 3px solid #FFC107; padding-bottom: 0.5rem; margin-bottom: 1rem; }
  h2 { color: #3D2C00; border-left: 4px solid #FFC107; padding-left: 1rem; margin: 2rem 0 1rem; }
  h3 { color: #6D5000; margin: 1.5rem 0 0.5rem; }
  p { margin-bottom: 1rem; }
  a { color: #E6A800; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; background: #FFF0B8; color: #6D5000; font-size: 12px; margin: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  th, td { padding: 8px 12px; border: 1px solid #FFE49A; text-align: left; }
  th { background: #FFC107; color: #3D2C00; }
  tr:nth-child(even) { background: #FFFDF5; }
  .footer { text-align: center; padding: 2rem; color: #9A7100; font-size: 12px; border-top: 2px solid #FFE49A; margin-top: 3rem; }
</style>
</head>
<body>
<div class="container">
${html}
<div class="footer">🐝 由 BeeSearch 蜂群智能系统生成</div>
</div>
</body>
</html>`;
    }
    
    return html;
  }

  /**
   * 从字符串中提取 JSON（处理可能的 markdown 代码块包裹）
   */
  private extractJSON(text: string): string {
    const trimmed = text.trim();
    
    // 1. 先尝试直接解析（最常见情况：LLM 直接输出了纯 JSON）
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // 继续尝试提取
    }

    // 2. 尝试从 markdown 代码块中提取
    const jsonBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      console.log("[Hermes][extractJSON] Matched code block");
      return jsonBlockMatch[1].trim();
    }

    // 3. 尝试匹配 JSON 对象（先于数组，因为对象内部包含数组时数组正则会错误匹配）
    const objMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        JSON.parse(objMatch[0]);
        console.log("[Hermes][extractJSON] Matched object");
        return objMatch[0];
      } catch {
        // 对象匹配到了但不是合法 JSON，继续
      }
    }

    // 4. 尝试匹配 JSON 数组
    const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        JSON.parse(arrayMatch[0]);
        console.log("[Hermes][extractJSON] Matched array");
        return arrayMatch[0];
      } catch {
        // 数组匹配到了但不是合法 JSON，继续
      }
    }

    // 5. 回退：返回对象匹配或数组匹配的原始结果（即使不是合法 JSON）
    if (objMatch) return objMatch[0];
    if (arrayMatch) return arrayMatch[0];

    console.warn("[Hermes][extractJSON] No JSON found in text, returning raw");
    return trimmed;
  }
}

// 单例
let hermesInstance: HermesAgent | null = null;

export function getHermes(config?: Partial<HermesConfig>): HermesAgent {
  if (!hermesInstance || config) {
    hermesInstance = new HermesAgent(config);
  }
  return hermesInstance;
}
