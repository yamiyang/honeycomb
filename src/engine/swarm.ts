/* ============================================================
   🐝 HoneyComb 蜜探 — Swarm Research Engine
   
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
import { getHermes, getBeeHermes } from "./hermes";
import { deepRead } from "./deep-reader";
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
    msg("queen", `🐝 蜂后收到了采蜜愿望：「${objective}」\n\n正在闭目凝神，思考要去哪些花田找花蜜...`);

    // 确保花田信息源已从后端加载
    if (flowerField.getActiveSources().length === 0) {
      await store().initFlowerField();
    }
    // ─── 蜂后总结标题和描述（替代机械截取） ───
    try {
      const meta = await hermes.summarizeResearchMeta(objective);
      store().updateResearchMeta(researchId, meta.title, meta.objective);
      console.log(`[Swarm] Research meta: "${meta.title}" — ${meta.objective}`);
    } catch (err) {
      console.warn("[Swarm] Failed to summarize research meta:", err);
      // 不阻塞主流程
    }

    // 获取可用的活跃信息源
    const activeSources = flowerField.getActiveSources();
    if (activeSources.length === 0) {
      msg("system", "⚠️ 没有激活的信息源！请先在花田设置中配置并激活至少一个信息源。");
      store().updateResearchStatus(researchId, "error");
      return;
    }

    const sourceNames = activeSources.map(s => `${s.type}(${s.name})`);
    msg("system", `📡 蜂群锁定了这些花田: ${activeSources.map(s => `${s.icon} ${s.name}`).join(", ")}`);

    // ─── 蜂后规划初始搜索任务 ───
    msg("queen", "🧠 蜂后正在排兵布阵，规划采蜜小分队的路线...");

    let initialTasks: SearchTask[];
    try {
      initialTasks = await hermes.planResearch(objective, sourceNames);
    } catch (err) {
      msg("system", `⚠️ 蜂后有点晕 (${err instanceof Error ? err.message : "未知错误"})\n\n不过没关系，蜜蜂们直接出发！`);
      initialTasks = [{
        id: `task_fallback_${Date.now()}`,
        query: objective,
        sourceIds: activeSources.map(s => s.id),
        rationale: "直接去采这朵花",
        round: 1,
        status: "pending",
      }];
    }

    msg("queen", `🗺️ 路线画好啦！蜂后派出了 **${initialTasks.length} 只小蜜蜂** 去这几个方向：\n\n${initialTasks.map((t, i) => `${i + 1}. 🐝 「${t.query}」\n   🌺 目标花田: ${t.sourceIds.join(", ")}\n   💡 蜂后说: ${t.rationale}`).join("\n\n")}`);

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

      msg("queen", `🔄 **第 ${roundNumber} 趟起飞** — 派出 ${tasksThisRound.length} 只小蜜蜂（体力还剩 ${maxSearches - totalSearches} 次）`);

      // 执行搜索
      const roundFindings = await executeSearchRound(researchId, tasksThisRound, objective, roundNumber, signal);
      allFindings = [...allFindings, ...roundFindings];

      // ─── 检查是否被用户停止 ───
      checkAborted(signal);

      // ─── 更新知识图谱 ───
      if (roundFindings.length > 0) {
        store().updateResearchStatus(researchId, "analyzing");
        msg("queen", `🏠 筑巢蜂正在用刚采回来的 ${roundFindings.length} 滴花蜜搭建知识蜂巢...`);

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
          msg("queen", `🏠 蜂巢又变大啦: 建成 **${totalNodes}** 个蜂蜜罐, 打通 **${totalEdges}** 条通道`);
        } catch (err) {
          console.error("[Swarm] Knowledge graph update error:", err);
          msg("system", `⚠️ 蜂巢搭建时手滑了一下: ${err instanceof Error ? err.message : "未知错误"}`);
        }

        // ─── 蜂后动态更新标题和描述 ───
        // 随着研究深入，标题和描述会越来越精准
        if (roundNumber >= 2 && allFindings.length >= 3) {
          try {
            const updatedMeta = await hermes.summarizeResearchMeta(objective, allFindings);
            store().updateResearchMeta(researchId, updatedMeta.title, updatedMeta.objective);
            console.log(`[Swarm] Research meta updated (round ${roundNumber}): "${updatedMeta.title}"`);
          } catch {
            // 更新元信息失败不影响主流程
          }
        }
      }

      // ─── 检查预算 ───
      if (totalSearches >= maxSearches) {
        msg("queen", `⚠️ 蜜蜂们太累啦！体力耗尽 (${maxSearches} 次)，今天就先采到这里`);
        break;
      }

      // ─── 检查是否被用户停止 ───
      checkAborted(signal);

      // ─── AI 自主决策：下一步做什么 ───
      store().updateResearchStatus(researchId, "expanding");
      msg("queen", `🧠 蜂后正在品尝采回来的 **${allFindings.length}** 滴花蜜，思考接下来去哪...`);

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
          msg("queen", `✅ 蜂后拍了拍翅膀说：够甜啦，这些花蜜已经足够！${decision.reasoning}\n\n一共飞了 ${roundNumber} 趟、采了 ${totalSearches} 次蜜`);
          break;
        }

        // action === "continue"
        if (decision.tasks.length > 0) {
          msg("queen", `📡 蜂后说还没尝够呢 — ${decision.reasoning}\n\n新发现的花田方向 (${decision.tasks.length} 个):\n${decision.tasks.map((t, i) => `${i + 1}. 「${t.query}」— 蜂后说：${t.rationale}`).join("\n")}`);
          pendingTasks = decision.tasks;
        } else {
          // AI 说要继续但没给任务 — 不应该在此直接停止
          // hermes.decideNextAction 内部已做 planExpansion fallback
          // 如果到这里 tasks 仍然为空，说明真的无法生成新方向
          msg("queen", `📊 蜂后看了看四周，好像没有新花田了（${decision.reasoning}），今天就到这吧`);
          break;
        }
      } catch (err) {
        msg("system", `⚠️ 蜂后有点头晕: ${err instanceof Error ? err.message : "未知错误"}，今天就先到这吧`);
        break;
      }
    }

    // ─── 生成 HTML 报告 ───
    store().updateResearchStatus(researchId, "reporting");
    
    const finalResearch = store().researches.find(r => r.id === researchId);
    const allFinalFindings = finalResearch?.bees.flatMap(b => b.findings) || [];

    if (allFinalFindings.length > 0) {
      msg("queen", `📝 采蜜大成功！一共飞了 **${roundNumber}** 趟、**${totalSearches}** 次，带回了 **${allFinalFindings.length}** 滴花蜜，建了 **${finalResearch?.graph.nodes.length || 0}** 个蜂蜜罐\n\n正在把花蜜酿成香甜的采蜜报告...`);

      try {
        const report = await hermes.generateReport(
          objective,
          allFinalFindings,
          finalResearch?.graph || { nodes: [], edges: [] },
          finalResearch?.roundSummaries || []
        );
        store().setReport(researchId, report);
        msg("queen", "✅ **采蜜报告酿好啦！** 请点击右侧「采蜜报告」标签品尝 🍯");
      } catch (err) {
        msg("system", `⚠️ 酿蜜失败啦: ${err instanceof Error ? err.message : "未知错误"}`);
        store().updateResearchStatus(researchId, "completed");
      }
    } else {
      msg("system", "⚠️ 小蜜蜂两手空空，没有花蜜可以酿报告...");
      store().updateResearchStatus(researchId, "completed");
    }

  } catch (err) {
    if (err instanceof AbortError) {
      // 用户手动停止
      msg("system", `🛑 蜂后吹响了海螺，小蜜蜂们全都回巢了~（一共飞了 ${store().researches.find(r => r.id === researchId)?.currentRound || 0} 趟）`);
      
      // 如果已经有 findings，尝试标记为 completed 而非 error
      const researchSnap = store().researches.find(r => r.id === researchId);
      const hasFindings = (researchSnap?.bees.flatMap(b => b.findings).length || 0) > 0;
      store().updateResearchStatus(researchId, hasFindings ? "completed" : "idle");
    } else {
      msg("system", `❌ 啊哦，蜂群在采蜜时遇到了大麻烦: ${err instanceof Error ? err.message : "未知错误"}`);
      store().updateResearchStatus(researchId, "error");
    }
  } finally {
    // 清理 abort controller
    abortControllers.delete(researchId);
  }
}

// ─────────────────────────────────────────────
// 超时工具
// ─────────────────────────────────────────────

class BeeTimeoutError extends Error {
  constructor(beeName: string, timeoutSec: number) {
    super(`蜜蜂「${beeName}」超时 (${timeoutSec}s)`);
    this.name = "BeeTimeoutError";
  }
}

/**
 * 用 Promise.race 给 promise 加上超时：
 * 超时后 reject BeeTimeoutError，但不会取消原始 promise（JS 无法取消）
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, beeName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new BeeTimeoutError(beeName, timeoutMs / 1000)), timeoutMs)
    ),
  ]);
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

  const beeHermes = getBeeHermes();
  const allFindings: Finding[] = [];

  // 获取超时配置（秒 → 毫秒）
  const research = store().researches.find(r => r.id === researchId);
  const beeTimeoutMs = (research?.config.beeTimeout || 60) * 1000;

  // 为每个任务派出蜜蜂（并行执行）
  const beePromises = tasks.map(async (task, index) => {
    // 检查是否被用户停止
    if (signal.aborted) return;
    
    // dispatchBee 内部会优先复用 resting 的蜜蜂
    const beeId = store().dispatchBee(researchId, task.query);
    const currentResearch = store().researches.find(r => r.id === researchId);
    const bee = currentResearch?.bees.find(b => b.id === beeId);
    const beeName = bee?.name || `蜜蜂${index + 1}`;
    const isReassigned = (bee?.findings.length || 0) > 0; // 有旧 findings 说明是复用

    msg("bee", `🔍 ${isReassigned ? "再次出击" : "扇动翅膀"}！去采「${task.query}」的花蜜...`, beeName);
    store().updateBeeStatus(researchId, beeId, "searching");

    // 将搜索+分析全过程包装在超时限制内
    const beeWork = async () => {
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
        msg("bee", `😔 绕着花田飞了一圈，没找到关于「${task.query}」的花蜜`, beeName);
        store().updateBeeStatus(researchId, beeId, "resting");
        return;
      }

      msg("bee", `🍯 找到了 ${results.length} 滴花蜜，正在尝味道...`, beeName);
      store().updateBeeStatus(researchId, beeId, "analyzing");

      // ─── 深度阅读：AI 评估哪些结果值得深入阅读全文 ───
      try {
        const hermes = getHermes(); // 用蜂后模型做评估
        const deepReadIndices = await hermes.evaluateDeepRead(
          objective,
          results.map(r => ({ title: r.title, content: r.content, url: r.url, sourceName: r.sourceName }))
        );

        if (deepReadIndices.length > 0) {
          msg("bee", `📖 发现 ${deepReadIndices.length} 篇值得深读的内容，正在细读全文...`, beeName);

          // 并行深度阅读
          const deepReadPromises = deepReadIndices.map(async (idx) => {
            const result = results[idx];
            if (!result?.url) return;
            try {
              const fullContent = await deepRead(result.url);
              if (fullContent.success && fullContent.content.length > result.content.length) {
                console.log(`[Swarm] Deep read ${result.url}: ${result.content.length} → ${fullContent.charCount} chars${fullContent.truncated ? " (truncated)" : ""}`);
                // 替换原始摘要为全文内容
                results[idx] = {
                  ...result,
                  content: fullContent.content,
                  metadata: { ...result.metadata, deepRead: true, originalLength: fullContent.charCount },
                };
              }
            } catch (err) {
              console.warn(`[Swarm] Deep read failed for ${result.url}:`, err);
            }
          });

          await Promise.allSettled(deepReadPromises);

          const deepReadCount = results.filter(r => r.metadata?.deepRead).length;
          if (deepReadCount > 0) {
            msg("bee", `✅ 深度阅读了 ${deepReadCount} 篇全文`, beeName);
          }
        }
      } catch (err) {
        console.warn("[Swarm] Deep read evaluation failed:", err);
        // 深读失败不阻塞主流程
      }

      // 蜜蜂分析结果（使用快速模型）
      const analysis = await beeHermes.analyzeResults(
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

      msg("bee", `✅ 品尝完毕：「${finding.title}」\n💡 发现好东西: ${analysis.keyInsights.slice(0, 2).join("; ")}`, beeName);
      store().updateBeeStatus(researchId, beeId, "resting");
    };

    try {
      await withTimeout(beeWork(), beeTimeoutMs, beeName);
    } catch (err) {
      if (err instanceof BeeTimeoutError) {
        msg("bee", `⏰ 飞太久啦！小蜜蜂「${beeName}」在 ${beeTimeoutMs / 1000} 秒内没能飞回来，已先回巢`, beeName);
        store().updateBeeStatus(researchId, beeId, "error");
        console.warn(`[Swarm] Bee "${beeName}" timed out after ${beeTimeoutMs / 1000}s on task: ${task.query}`);
      } else {
        const errorMsg = err instanceof Error ? err.message : "未知错误";
        msg("bee", `❌ 采蜜路上遇到狂风: ${errorMsg}`, beeName);
        store().updateBeeStatus(researchId, beeId, "error");
      }
    }
  });

  // 使用 allSettled 等待所有蜜蜂（含超时的）完成
  // 超时的蜜蜂会很快 reject，不会阻塞其他蜜蜂
  await Promise.allSettled(beePromises);

  // 统计本轮成果
  const completedCount = allFindings.length;
  const timedOutBees = store().researches.find(r => r.id === researchId)
    ?.bees.filter(b => b.status === "error").length || 0;

  // 记录轮次摘要
  store().addRoundSummary(researchId, {
    round,
    tasksCompleted: tasks.length,
    findingsCount: allFindings.length,
    sourcesUsed: [...new Set(allFindings.flatMap(f => f.sourceResults.map(r => r.sourceName)))],
    keyDiscoveries: allFindings.flatMap(f => f.keyInsights).slice(0, 5),
    gapsIdentified: [],
    nextStrategy: "由蜂后决定",
  });

  const timedOutNote = timedOutBees > 0 ? ` | ⏰ ${timedOutBees} 只没跟上队伍` : "";
  msg("queen", `📊 第 ${round} 趟采蜜结束: 抱回了 ${completedCount} 滴花蜜 | 探索了 ${[...new Set(allFindings.flatMap(f => f.sourceResults.map(r => r.sourceName)))].length} 块花田${timedOutNote}`);

  return allFindings;
}
