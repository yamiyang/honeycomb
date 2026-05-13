/* ============================================================
   🐝 HoneyComb — Hermes Agent Core
   
   底层 AI 引擎，基于 Hermes (NousResearch) 模型。
   
   核心理念：Tool Calling Agent
   - 蜂后 = 一个带 skills（tools）的对话 Agent
   - 对话是默认行为
   - 搜索研究是蜂后的一个 skill，她自行决定何时调用
   - 小蜜蜂的花田信息源也是 tools
   
   蜂后的 Skills:
   1. swarm_research — 发起蜂群搜索（派蜜蜂去花田采集信息）
   2. 对话/思考 — 默认行为，基于已有知识和用户交流
   
   分析/图谱/报告等仍是内部能力，供 swarm 流程使用
   ============================================================ */

import type { HermesConfig, HermesMessage, HermesTool, HermesToolCall, SearchTask, SourceResult, Finding, KnowledgeNode, KnowledgeEdge } from "@/types";

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
// 蜂后的 Skills 定义（Tool Definitions）
// ─────────────────────────────────────────────

/** 蜂后可调用的搜索研究 skill */
const QUEEN_SKILL_RESEARCH: HermesTool = {
  type: "function",
  function: {
    name: "swarm_research",
    description: "派出蜜蜂蜂群去花田搜索新信息。当用户提出新问题需要搜索互联网/数据库获取信息，或需要深入研究某个方向时调用此技能。注意：如果用户只是想聊聊已有的发现、总结、分析、对比，则不需要调用。",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索研究的核心问题/方向。必须是能在搜索引擎中有效执行的查询。重要：如果用户提到的是'蜂巢'、'HoneyComb'、'蜜探'、'我们的APP'等自我指代，必须将其翻译为实际的产品定位描述（如'AI研究助手'、'启发式搜索工具'），不要用'蜂巢'或'HoneyComb'作为搜索词。",
        },
        reason: {
          type: "string",
          description: "为什么需要发起搜索（一句话）",
        },
      },
      required: ["query"],
    },
  },
};

// ─────────────────────────────────────────────
// Tool Call 结果类型
// ─────────────────────────────────────────────

/** 蜂后对话的返回结果 */
export interface QueenResponse {
  /** 蜂后的文字回复（可能为空字符串，如果纯 tool call） */
  content: string;
  /** 蜂后决定调用的 skills */
  toolCalls: HermesToolCall[];
}

// ─────────────────────────────────────────────
// Hermes API 调用
// ─────────────────────────────────────────────

export class HermesAgent {
  private config: HermesConfig;

  constructor(config?: Partial<HermesConfig>) {
    this.config = { ...DEFAULT_HERMES_CONFIG, ...config };
  }

  /**
   * 基础 chat completion 调用（返回纯文本）
   * 浏览器端走 /api/hermes 代理，服务端直接调用 LLM
   */
  async chat(messages: HermesMessage[], tools?: HermesTool[]): Promise<string> {
    const result = await this.chatRaw(messages, tools);
    return result.content;
  }

  /**
   * 原始 chat completion 调用 — 返回完整的 message（含 tool_calls）
   */
  async chatRaw(messages: HermesMessage[], tools?: HermesTool[]): Promise<QueenResponse> {
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
        body.tool_choice = "auto";
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
      const msg = data.choices?.[0]?.message;
      return {
        content: msg?.content || "",
        toolCalls: msg?.tool_calls || [],
      };
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
    const msg = data.choices?.[0]?.message;
    return {
      content: msg?.content || "",
      toolCalls: msg?.tool_calls || [],
    };
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
  // 蜂后对话入口（Tool Calling Agent）
  // ─────────────────────────────────────────────

  /**
   * 蜂后对话 — 核心入口
   * 
   * 蜂后是一个带 tools 的 Agent：
   * - 默认行为 = 基于已有知识和用户聊天
   * - 如果她判断需要搜索新信息，会调用 swarm_research tool
   * 
   * 返回：{ content, toolCalls }
   * - content: 蜂后的文字回复
   * - toolCalls: 蜂后决定调用的 skills（前端根据此决定是否启动蜂群）
   */
  async queenChat(
    userMessage: string,
    context: {
      objective: string;
      findings: Finding[];
      graph: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] };
      recentMessages: { role: string; content: string }[];
      hasReport: boolean;
    }
  ): Promise<QueenResponse> {
    const hasKnowledge = context.findings.length > 0 || context.graph.nodes.length > 0 || context.hasReport;

    // 构建知识上下文摘要
    const findingsDigest = context.findings
      .slice(-15)
      .map(f => `- [${f.tags.join(",")}] ${f.title}: ${f.summary}`)
      .join("\n");

    const graphDigest = context.graph.nodes
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 20)
      .map(n => `- [${n.type}] ${n.label} (权重:${n.weight.toFixed(2)}): ${n.content.slice(0, 100)}`)
      .join("\n");

    const edgesDigest = context.graph.edges
      .slice(0, 15)
      .map(e => {
        const src = context.graph.nodes.find(n => n.id === e.source)?.label || e.source;
        const tgt = context.graph.nodes.find(n => n.id === e.target)?.label || e.target;
        return `- ${src} --[${e.label}]--> ${tgt}`;
      })
      .join("\n");

    const knowledgeSection = hasKnowledge ? `
## 🍯 已有研究知识库

### 情报摘要（${context.findings.length} 条）
${findingsDigest || "暂无情报"}

### 知识图谱核心节点（${context.graph.nodes.length} 个）
${graphDigest || "暂无"}

### 知识关系网络
${edgesDigest || "暂无"}

### 报告状态
${context.hasReport ? "✅ 已生成研究报告" : "未生成报告"}
` : `
## 🍯 当前知识库
暂无已有知识。这是一个新的研究方向。
`;

    const systemPrompt = `你是 HoneyComb 蜜探的蜂后（Queen Agent）🐝。

## 🪪 关于你自己（自我认知）
你就是 **HoneyComb 蜜探**（又名「蜂巢」）这款 APP 的核心 AI。HoneyComb 是一款：
- **启发式 AI 搜索研究工具**
- 特点：蜂群架构（Queen + Worker Bees）、花田信息源、知识图谱、多轮深度搜索
- 类别：AI-powered research assistant / 智能研究助手
- 如果用户提到"蜂巢"、"HoneyComb"、"蜜探"、"这个APP"、"你的竞品"，他说的就是你自己

⚠️ **重要**：当用户说"帮我研究蜂巢的竞品"，他的意思是"帮我找和你类似的 AI 搜索/研究类产品"。
你要把"蜂巢"或"蜜探"替换为对应的产品定位关键词去搜索，而不是去搜索字面意义的"蜂巢APP"或"蜜探APP"。

## 你的身份
你是一只智慧的蜂后，带领蜂群进行信息研究。你的研究目标是：「${context.objective}」

## 你的能力
1. **对话** — 你可以基于已有知识和用户自然交流、讨论、分析、总结
2. **搜索研究** — 你有一个 \`swarm_research\` 技能，可以派蜜蜂去搜索新信息

## 行为准则
- **对话是默认行为** — 大多数情况下，直接和用户聊天
- **只在必要时搜索** — 当用户明确想要搜索新信息、或者你判断已有知识不足以回答时，调用 swarm_research
- **诚实透明** — 如果你不确定已有知识能否回答，可以先试着回答，然后建议"如需更多信息，我可以派蜜蜂去搜索"
- **有深度有洞察** — 不简单复述情报，要分析、对比、归纳
- **蜂后人格** — 友善、专业、有主见
- **理解指代** — 用户说的"蜂巢"、"蜜探"、"我们"、"这个APP"、"你"指的都是 HoneyComb 本身，需要把指代翻译成实际的产品定位再去搜索

## 什么时候应该调用 swarm_research
- 用户说"帮我查/搜/找/研究 XXX"
- 用户提出一个你的知识库没有覆盖的新问题
- 用户说"深入了解"、"搜索最新"等明确搜索意图

## 什么时候不应该调用 swarm_research
- 用户说"总结一下"、"帮我分析"、"你怎么看"
- 用户在讨论已有的发现
- 用户在闲聊
- 已有知识足以回答用户的问题

## 调用 swarm_research 时的 query 规则
- **绝不能把 query 中包含"蜂巢"、"蜜探"或"HoneyComb"当作搜索词** — 因为那是你自己，搜索引擎搜不到
- 应该把自我指代翻译为产品定位关键词，例如：
  - "蜂巢的竞品" → query: "AI research assistant app competitors 2024" 或 "AI搜索研究工具 竞品分析"
  - "和我类似的产品" → query: "AI-powered deep research tools Perplexity alternatives"
${knowledgeSection}
## 对话格式
- 使用中文
- 适度 markdown（加粗、列表）增强可读性
- 简洁有力，通常 100-400 字`;

    // 构建对话历史
    const messages: HermesMessage[] = [
      { role: "system", content: systemPrompt },
    ];

    // 加入最近对话上下文
    for (const msg of context.recentMessages.slice(-8)) {
      if (msg.role === "user") {
        messages.push({ role: "user", content: msg.content });
      } else if (msg.role === "queen") {
        messages.push({ role: "assistant", content: msg.content });
      }
      // system/bee 消息跳过（不影响蜂后的对话上下文）
    }

    // 当前用户消息
    messages.push({ role: "user", content: userMessage });

    // 调用 LLM，带上蜂后的 skills
    const skills: HermesTool[] = [QUEEN_SKILL_RESEARCH];
    const result = await this.chatRaw(messages, skills);

    console.log("[Queen] response:", {
      hasContent: !!result.content,
      contentPreview: result.content.slice(0, 100),
      toolCallsCount: result.toolCalls.length,
      toolCalls: result.toolCalls.map(tc => tc.function?.name),
    });

    return result;
  }

  // ─────────────────────────────────────────────
  // 高层功能：研究标题生成
  // ─────────────────────────────────────────────

  /**
   * 让蜂后基于用户输入总结出简洁的标题和精炼的描述
   */
  async summarizeResearchMeta(
    userInput: string,
    existingFindings?: Finding[],
  ): Promise<{ title: string; objective: string }> {
    const hasFindings = existingFindings && existingFindings.length > 0;

    const findingsContext = hasFindings
      ? `\n\n已有研究成果（${existingFindings.length} 条情报）：\n${existingFindings.slice(0, 10).map(f => `- ${f.title}: ${f.summary.slice(0, 80)}`).join("\n")}`
      : "";

    const systemPrompt = `你是 HoneyComb 蜜探研究系统的蜂后。请为一项研究任务生成简洁的标题和精炼的目标描述。

规则：
1. **标题 (title)**：用 8-20 个字概括研究核心主题，像论文标题一样简洁有力，不要包含标点符号
2. **目标 (objective)**：用 1-2 句话（50字以内）精炼概括研究要解答的核心问题和方向
3. 不要机械截取用户的原文，要理解用户意图后重新概括
4. 如果有已有研究成果，标题和描述应该反映研究的最新理解${hasFindings ? "（可能与最初用户输入有偏差，以实际研究方向为准）" : ""}

输出严格 JSON（不要代码块包裹）:
{
  "title": "研究标题",
  "objective": "研究目标描述"
}

直接输出 JSON，不要其他文字。`;

    const messages: HermesMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `用户输入：${userInput}${findingsContext}` },
    ];

    try {
      const response = await this.chat(messages);
      const parsed = JSON.parse(this.extractJSON(response));
      return {
        title: String(parsed.title || "").slice(0, 30) || userInput.slice(0, 20),
        objective: String(parsed.objective || "").slice(0, 100) || userInput.slice(0, 50),
      };
    } catch {
      // Fallback: 简单截取
      const rawTitle = userInput.split("\n")[0].trim();
      return {
        title: rawTitle.length > 20 ? rawTitle.slice(0, 20) + "…" : rawTitle,
        objective: userInput.slice(0, 100),
      };
    }
  }

  // ─────────────────────────────────────────────
  // 高层功能：研究规划
  // ─────────────────────────────────────────────

  /**
   * 根据研究目标，规划初始搜索任务
   */
  async planResearch(objective: string, availableSources: string[]): Promise<SearchTask[]> {
    const systemPrompt = `你是 HoneyComb 蜜探研究系统的"蜂后"智能体。你的角色是将用户的研究目标分解为具体的搜索任务。

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

    const systemPrompt = `你是 HoneyComb 蜜探研究系统的分析蜂。分析以下搜索结果，提炼关键情报。

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
    const systemPrompt = `你是 HoneyComb 蜜探研究系统的蜂后。基于已有情报，规划下一轮搜索方向。

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

    const systemPrompt = `你是 HoneyComb 蜜探研究系统的蜂后（Queen Agent）。你要做一个重要决策：**继续搜索还是停止？**

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
    const systemPrompt = `你是 HoneyComb 蜜探知识图谱构建蜂。你的任务是从新情报中提取概念节点和关系，构建知识图谱。

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
    const systemPrompt = `你是 HoneyComb 蜜探研究报告生成蜂。基于所有收集的情报和知识图谱，生成一份**完整的 HTML 网页研究报告**。

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
- 报告末尾标注 "由 HoneyComb 蜜探蜂群智能系统生成"

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
    
    // 从 AI 输出中提取 HTML 报告 —— 处理多种格式：
    // 1. 直接输出完整 HTML
    // 2. ```html ... ``` 代码块包裹
    // 3. 代码块前后带有说明文字
    const { html, preamble } = this.extractHtmlReport(rawReport, objective);
    
    // 如果有代码块外的说明文字，嵌入到 HTML 的 data 属性中供前端展示
    if (preamble) {
      // 把 preamble 用 base64 编码后注入到 HTML 标签上
      // 使用兼容浏览器和 Node 的方式编码 UTF-8 → base64
      let encodedPreamble: string;
      if (typeof TextEncoder !== "undefined" && typeof btoa === "function") {
        // 浏览器端：TextEncoder + btoa
        const bytes = new TextEncoder().encode(preamble);
        const binStr = Array.from(bytes, b => String.fromCharCode(b)).join("");
        encodedPreamble = btoa(binStr);
      } else {
        // Node 端
        encodedPreamble = Buffer.from(preamble, "utf-8").toString("base64");
      }
      if (html.includes("<html")) {
        return html.replace(/<html([^>]*)>/, `<html$1 data-preamble="${encodedPreamble}">`);
      }
      // 如果没有 <html> 标签，在最外层 div 上加
      return html.replace(/<body([^>]*)>/, `<body$1 data-preamble="${encodedPreamble}">`);
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

  /**
   * 从 AI 输出中提取 HTML 报告
   * 
   * 处理多种格式：
   * 1. 直接输出完整 HTML（以 <!DOCTYPE 或 <html 开头）
   * 2. ```html ... ``` 代码块包裹
   * 3. 代码块前后带有说明文字（preamble / postamble）
   * 4. 多个 ```html 代码块（合并）
   * 
   * 返回 { html, preamble }:
   * - html: 清理后的完整 HTML 文档
   * - preamble: 代码块外的文本（如果有），可供前端展示
   */
  private extractHtmlReport(raw: string, objective: string): { html: string; preamble: string } {
    const trimmed = raw.trim();

    // ─── 情况 1: 直接就是完整 HTML（最理想） ───
    if (/^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
      return { html: trimmed, preamble: "" };
    }

    // ─── 情况 2/3: 包含 ```html ... ``` 代码块 ───
    // 支持多个代码块（取最大的那个，通常就是完整 HTML）
    const codeBlockRegex = /```(?:html)?\s*\n([\s\S]*?)```/g;
    const blocks: { content: string; start: number; end: number }[] = [];
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(trimmed)) !== null) {
      blocks.push({
        content: match[1].trim(),
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    if (blocks.length > 0) {
      // 找到包含 HTML 结构的最大代码块
      const htmlBlock = blocks
        .filter(b => b.content.includes("<") && b.content.includes(">"))
        .sort((a, b) => b.content.length - a.content.length)[0];

      if (htmlBlock) {
        // 提取代码块前后的文本作为 preamble
        const beforeText = trimmed.slice(0, htmlBlock.start).trim();
        const afterText = trimmed.slice(htmlBlock.end).trim();

        // 清理 preamble 中的无用标记
        const preambleParts: string[] = [];
        if (beforeText) preambleParts.push(beforeText);
        if (afterText) preambleParts.push(afterText);
        const preamble = preambleParts
          .join("\n\n")
          .replace(/```\w*\s*/g, "")  // 清理残留的代码块标记
          .trim();

        let html = htmlBlock.content;

        // 如果代码块内容不是完整 HTML 文档，包装它
        if (!html.toLowerCase().includes("<!doctype") && !html.toLowerCase().includes("<html")) {
          html = this.wrapPartialHtml(html, objective);
        }

        return { html, preamble };
      }
    }

    // ─── 情况 4: 简单的首尾 ``` 包裹（无 html 标记） ───
    let content = trimmed;
    if (content.startsWith("```html")) {
      content = content.slice(7);
    } else if (content.startsWith("```")) {
      content = content.slice(3);
    }
    if (content.endsWith("```")) {
      content = content.slice(0, -3);
    }
    content = content.trim();

    // ─── 情况 5: 不是标准格式，整段当内容 ───
    if (!content.toLowerCase().includes("<!doctype") && !content.toLowerCase().includes("<html")) {
      content = this.wrapPartialHtml(content, objective);
    }

    return { html: content, preamble: "" };
  }

  /**
   * 将部分 HTML 内容包装为完整文档
   */
  private wrapPartialHtml(body: string, objective: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HoneyComb 蜜探采蜜报告 — ${objective}</title>
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
${body}
<div class="footer">🐝 由 HoneyComb 蜜探蜂群智能系统生成</div>
</div>
</body>
</html>`;
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
