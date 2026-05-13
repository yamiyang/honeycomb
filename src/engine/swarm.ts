/* ============================================================
   🐝 Argus — Swarm Research Engine
   
   蜂群智能研究引擎。
   
   核心理念：启发式搜索（Heuristic Search）
   - AI（蜂后）自主规划搜索方向
   - AI 自主决定每一步怎么搜索
   - AI 自主判断何时已经充分、何时需要深入
   - 唯一的硬约束：最大搜索次数预算（防止无限消耗）
   
   流程：
   1. 蜂后 (Hermes) 分析研究目标，规划初始搜索任务
   2. 蜜蜂 (Worker) 调用花田信息源执行搜索
   3. Hermes 分析搜索结果，提炼情报
   4. 知识图谱蜂更新蜂巢
   5. 蜂后基于已有知识图谱和情报，自主决定下一步行动：
      - 继续搜索新方向
      - 深入某个已有方向
      - 判断已充分覆盖，停止搜索
   6. 循环直到 AI 决定停止或达到预算上限
   7. 生成最终 HTML 报告
   ============================================================ */

import { useResearchStore } from "@/store/research-store";
import { getHermes } from "./hermes";
import { flowerField } from "./flowers";
import type { SearchTask, SourceResult, Finding } from "@/types";

// ─────────────────────────────────────────────
// Abort 控制 — 一键停止研究
// ─────────────────────────────────────────────

/** 当前研究的 abort controllers，key = researchId */
const abortControllers = new Map<string, AbortController>();

/**
 * 停止指定研究
 * @returns true 如果成功发出停止信号
 */
export function stopResearch(researchId: string): boolean {
  const controller = abortControllers.get(researchId);
  if (controller) {
    controller.abort();
    abortControllers.delete(researchId);
    return true;
  }
  return false;
}

/**
 * 检查研究是否正在运行
 */
export function isResearchRunning(researchId: string): boolean {
  return abortControllers.has(researchId);
}

/**
 * 检查 abort 信号，如果被 abort 则抛出特殊错误
 */
function checkAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new AbortError("用户手动停止了研究");
  }
}

class AbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AbortError";
  }
}

// ─────────────────────────────────────────────
// 主入口
// ─────────────────────────────────────────────

/**
 * 启动蜂群研究
 * AI 自主决定搜索方向、深度和终止时机
 */
export async function runSwarmResearch(researchId: string, objective: string) {
  // 创建 AbortController
  const controller = new AbortController();
  const { signal } = controller;
  
  // 如果之前有在运行的，先 abort
  stopResearch(researchId);
  abortControllers.set(researchId, controller);
  const store = () => useResearchStore.getState();
  const msg = (role: "queen" | "bee" | "system", content: string, beeName?: string) =>
    store().addMessage(researchId, { role, content, beeName });

  const hermes = getHermes();

  try {
    // ─── 初始化 ───
    checkAborted(signal);
    store().updateResearchStatus(researchId, "planning");
    msg("queen", `🐝 蜂后收到研究目标：「${objective}」\n\n正在通过 Hermes 分析目标，规划搜索策略...`);

    // 获取可用的活跃信息源
    const activeSources = flowerField.getActiveSources();
    if (activeSources.length === 0) {
      msg("system", "⚠️ 没有激活的信息源！请先在花田设置中配置并激活至少一个信息源。");
      store().updateResearchStatus(researchId, "error");
      return;
    }

    const sourceNames = activeSources.map(s => `${s.type}(${s.name})`);
    msg("system", `📡 可用信息源: ${activeSources.map(s => `${s.icon} ${s.name}`).join(", ")}`);

    // ─── 蜂后规划初始搜索任务 ───
    msg("queen", "🧠 正在通过 AI 分析目标并规划搜索方向...");

    let initialTasks: SearchTask[];
    try {
      initialTasks = await hermes.planResearch(objective, sourceNames);
    } catch (err) {
      msg("system", `⚠️ Hermes 规划失败: ${err instanceof Error ? err.message : "未知错误"}\n\n将使用目标直接搜索。`);
      initialTasks = [{
        id: `task_fallback_${Date.now()}`,
        query: objective,
        sourceIds: activeSources.map(s => s.id),
        rationale: "直接搜索研究目标",
        round: 1,
        status: "pending",
      }];
    }

    msg("queen", `🗺️ 规划完成！将派出 **${initialTasks.length} 只蜜蜂** 执行以下搜索任务：\n\n${initialTasks.map((t, i) => `${i + 1}. 🐝 「${t.query}」\n   📡 ${t.sourceIds.join(", ")}\n   💡 ${t.rationale}`).join("\n\n")}`);

    // ─── 启发式搜索主循环 ───
    // 唯一的硬约束：最大搜索次数预算
    const research = store().researches.find(r => r.id === researchId);
    const maxSearches = research?.config.maxSearches || 100;
    let totalSearches = 0;
    let roundNumber = 0;
    let allFindings: Finding[] = [];

    let pendingTasks = initialTasks;

    while (pendingTasks.length > 0 && totalSearches < maxSearches) {
      // ─── 检查是否被用户停止 ───
      checkAborted(signal);
      
      roundNumber++;
      store().incrementRound(researchId);
      store().updateResearchStatus(researchId, "searching");

      // 本轮要执行的任务数不能超过剩余预算
      const budgetLeft = maxSearches - totalSearches;
      const tasksThisRound = pendingTasks.slice(0, budgetLeft);
      totalSearches += tasksThisRound.length;

      msg("queen", `🔄 **第 ${roundNumber} 轮** — 派出 ${tasksThisRound.length} 只蜜蜂（已用 ${totalSearches}/${maxSearches} 次搜索预算）`);

      // 执行搜索
      const roundFindings = await executeSearchRound(researchId, tasksThisRound, objective, roundNumber, signal);
      allFindings = [...allFindings, ...roundFindings];

      // ─── 检查是否被用户停止 ───
      checkAborted(signal);

      // ─── 更新知识图谱 ───
      if (roundFindings.length > 0) {
        store().updateResearchStatus(researchId, "analyzing");
        msg("queen", `🏠 知识图谱蜂正在基于 ${roundFindings.length} 条新情报更新知识图谱...`);

        try {
          const researchSnap = store().researches.find(r => r.id === researchId);
          const graphUpdate = await hermes.buildKnowledgeGraph(
            objective,
            roundFindings,
            researchSnap?.graph.nodes || [],
            researchSnap?.graph.edges || []
          );

          console.log(`[Swarm] Graph update: ${graphUpdate.nodes.length} new nodes, ${graphUpdate.edges.length} new edges`);

          // 先添加所有节点，收集 label → id 映射
          const labelToId = new Map<string, string>();
          
          // 已有节点的映射
          const existingNodes = store().researches.find(r => r.id === researchId)?.graph.nodes || [];
          for (const n of existingNodes) {
            labelToId.set(n.label, n.id);
            labelToId.set(n.label.toLowerCase(), n.id);
          }

          // 添加新节点并更新映射
          for (const node of graphUpdate.nodes) {
            const nodeId = store().addGraphNode(researchId, node);
            if (nodeId) {
              labelToId.set(node.label, nodeId);
              labelToId.set(node.label.toLowerCase(), nodeId);
            }
          }

          // 添加边时，将 label 引用解析为 id
          for (const edge of graphUpdate.edges) {
            const resolvedSource = labelToId.get(edge.source) || labelToId.get(edge.source.toLowerCase()) || edge.source;
            const resolvedTarget = labelToId.get(edge.target) || labelToId.get(edge.target.toLowerCase()) || edge.target;
            store().addGraphEdge(researchId, {
              ...edge,
              source: resolvedSource,
              target: resolvedTarget,
            });
          }

          const updatedResearch = store().researches.find(r => r.id === researchId);
          const totalNodes = updatedResearch?.graph.nodes.length || 0;
          const totalEdges = updatedResearch?.graph.edges.length || 0;
          console.log(`[Swarm] Graph after update: ${totalNodes} total nodes, ${totalEdges} total edges`);
          msg("queen", `🏠 知识图谱更新: **${totalNodes}** 个节点, **${totalEdges}** 条关系`);
        } catch (err) {
          console.error("[Swarm] Knowledge graph update error:", err);
          msg("system", `⚠️ 知识图谱构建异常: ${err instanceof Error ? err.message : "未知错误"}`);
        }
      }

      // ─── 检查预算 ───
      if (totalSearches >= maxSearches) {
        msg("queen", `⚠️ 已达到搜索预算上限 (${maxSearches} 次)，结束搜索`);
        break;
      }

      // ─── 检查是否被用户停止 ───
      checkAborted(signal);

      // ─── AI 自主决策：下一步做什么 ───
      store().updateResearchStatus(researchId, "expanding");
      msg("queen", `🧠 蜂后正在分析已有 **${allFindings.length}** 条情报，自主决定下一步行动...`);

      try {
        const researchSnap = store().researches.find(r => r.id === researchId);
        const decision = await hermes.decideNextAction(
          objective,
          allFindings,
          researchSnap?.graph || { nodes: [], edges: [] },
          researchSnap?.roundSummaries || [],
          sourceNames,
          totalSearches,
          maxSearches
        );

        if (decision.action === "stop") {
          msg("queen", `✅ 蜂后判断研究已充分覆盖：${decision.reasoning}\n\n共完成 ${roundNumber} 轮、${totalSearches} 次搜索`);
          break;
        }

        // action === "continue"
        if (decision.tasks.length > 0) {
          msg("queen", `📡 蜂后决定继续深入 — ${decision.reasoning}\n\n新搜索方向 (${decision.tasks.length} 个):\n${decision.tasks.map((t, i) => `${i + 1}. 「${t.query}」— ${t.rationale}`).join("\n")}`);
          pendingTasks = decision.tasks;
        } else {
          // AI 说要继续但没给任务 — 不应该在此直接停止
          // hermes.decideNextAction 内部已做 planExpansion fallback
          // 如果到这里 tasks 仍然为空，说明真的无法生成新方向
          msg("queen", `📊 蜂后未能生成新的搜索方向（${decision.reasoning}），结束搜索`);
          break;
        }
      } catch (err) {
        msg("system", `⚠️ AI 决策异常: ${err instanceof Error ? err.message : "未知错误"}，结束搜索`);
        break;
      }
    }

    // ─── 生成 HTML 报告 ───
    store().updateResearchStatus(researchId, "reporting");
    
    const finalResearch = store().researches.find(r => r.id === researchId);
    const allFinalFindings = finalResearch?.bees.flatMap(b => b.findings) || [];

    if (allFinalFindings.length > 0) {
      msg("queen", `📝 搜索完成！共 **${roundNumber}** 轮、**${totalSearches}** 次搜索，收集 **${allFinalFindings.length}** 条情报，**${finalResearch?.graph.nodes.length || 0}** 个知识节点\n\n正在生成 HTML 研究报告...`);

      try {
        const report = await hermes.generateReport(
          objective,
          allFinalFindings,
          finalResearch?.graph || { nodes: [], edges: [] },
          finalResearch?.roundSummaries || []
        );
        store().setReport(researchId, report);
        msg("queen", "✅ **研究报告已生成！** 请点击右侧「报告」标签查看完整 HTML 报告 📄");
      } catch (err) {
        msg("system", `⚠️ 报告生成失败: ${err instanceof Error ? err.message : "未知错误"}`);
        store().updateResearchStatus(researchId, "completed");
      }
    } else {
      msg("system", "⚠️ 未收集到有效情报，无法生成报告。请检查信息源配置。");
      store().updateResearchStatus(researchId, "completed");
    }

  } catch (err) {
    if (err instanceof AbortError) {
      // 用户手动停止
      msg("system", `🛑 研究已被用户手动停止。已完成 ${store().researches.find(r => r.id === researchId)?.currentRound || 0} 轮搜索。`);
      
      // 如果已经有 findings，尝试标记为 completed 而非 error
      const researchSnap = store().researches.find(r => r.id === researchId);
      const hasFindings = (researchSnap?.bees.flatMap(b => b.findings).length || 0) > 0;
      store().updateResearchStatus(researchId, hasFindings ? "completed" : "idle");
    } else {
      msg("system", `❌ 研究过程遇到严重错误: ${err instanceof Error ? err.message : "未知错误"}`);
      store().updateResearchStatus(researchId, "error");
    }
  } finally {
    // 清理 abort controller
    abortControllers.delete(researchId);
  }
}

// ─────────────────────────────────────────────
// 执行一轮搜索
// ─────────────────────────────────────────────

async function executeSearchRound(
  researchId: string,
  tasks: SearchTask[],
  objective: string,
  round: number,
  signal: AbortSignal
): Promise<Finding[]> {
  const store = () => useResearchStore.getState();
  const msg = (role: "queen" | "bee" | "system", content: string, beeName?: string) =>
    store().addMessage(researchId, { role, content, beeName });

  const hermes = getHermes();
  const allFindings: Finding[] = [];

  // 为每个任务派出蜜蜂（并行执行）
  const beePromises = tasks.map(async (task, index) => {
    // 检查是否被用户停止
    if (signal.aborted) return;
    
    // dispatchBee 内部会优先复用 resting 的蜜蜂
    const beeId = store().dispatchBee(researchId, task.query);
    const research = store().researches.find(r => r.id === researchId);
    const bee = research?.bees.find(b => b.id === beeId);
    const beeName = bee?.name || `蜜蜂${index + 1}`;
    const isReassigned = (bee?.findings.length || 0) > 0; // 有旧 findings 说明是复用

    msg("bee", `🔍 ${isReassigned ? "再次出发" : "出发"}搜索「${task.query}」...`, beeName);
    store().updateBeeStatus(researchId, beeId, "searching");

    try {
      // 在花田信息源中搜索
      const allSources = flowerField.getActiveSources();
      
      const resolveSourceId = (rawId: string): string | null => {
        const cleanId = rawId.split("(")[0].trim();
        const byId = allSources.find(s => s.id === cleanId);
        if (byId) return byId.id;
        const byType = allSources.find(s => s.type === cleanId);
        if (byType) return byType.id;
        return null;
      };

      const resolvedSourceIds = task.sourceIds
        .map(resolveSourceId)
        .filter((id): id is string => id !== null);

      const sourceIdsToSearch = resolvedSourceIds.length > 0 
        ? resolvedSourceIds 
        : allSources.map(s => s.id);

      const results: SourceResult[] = await flowerField.searchMultiple(
        sourceIdsToSearch,
        task.query,
        { maxResults: 5, sortBy: "relevance" }
      );

      if (results.length === 0) {
        msg("bee", `😔 在信息源中未找到「${task.query}」的相关结果`, beeName);
        store().updateBeeStatus(researchId, beeId, "resting");
        return;
      }

      msg("bee", `🍯 找到 ${results.length} 条结果，正在分析...`, beeName);
      store().updateBeeStatus(researchId, beeId, "analyzing");

      // Hermes 分析结果
      const analysis = await hermes.analyzeResults(
        objective,
        task,
        results,
        allFindings
      );

      // 创建 Finding
      const finding: Omit<Finding, "id" | "beeId" | "beeName" | "timestamp"> = {
        title: `${task.query} — 分析摘要`,
        summary: analysis.summary,
        keyInsights: analysis.keyInsights,
        sourceResults: results,
        relevanceScore: analysis.relevanceScore,
        noveltyScore: analysis.noveltyScore,
        tags: analysis.tags,
        round,
      };

      store().addFinding(researchId, beeId, finding);
      allFindings.push({
        ...finding,
        id: `finding_${Date.now()}_${index}`,
        beeId,
        beeName,
        timestamp: Date.now(),
      });

      msg("bee", `✅ 分析完成：「${finding.title}」\n💡 关键洞察: ${analysis.keyInsights.slice(0, 2).join("; ")}`, beeName);
      store().updateBeeStatus(researchId, beeId, "resting");

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "未知错误";
      msg("bee", `❌ 搜索失败: ${errorMsg}`, beeName);
      store().updateBeeStatus(researchId, beeId, "error");
    }
  });

  await Promise.allSettled(beePromises);

  // 记录轮次摘要
  store().addRoundSummary(researchId, {
    round,
    tasksCompleted: tasks.length,
    findingsCount: allFindings.length,
    sourcesUsed: [...new Set(allFindings.flatMap(f => f.sourceResults.map(r => r.sourceName)))],
    keyDiscoveries: allFindings.flatMap(f => f.keyInsights).slice(0, 5),
    gapsIdentified: [],
    nextStrategy: "由 AI 自主决定",
  });

  msg("queen", `📊 第 ${round} 轮完成: ${allFindings.length} 条情报 | ${[...new Set(allFindings.flatMap(f => f.sourceResults.map(r => r.sourceName)))].length} 个信息源`);

  return allFindings;
}
