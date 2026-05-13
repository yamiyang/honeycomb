"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useResearchStore } from "@/store/research-store";
import ChatPanel from "@/components/ChatPanel";
import ContentPanel from "@/components/ContentPanel";
import FlowerFieldPanel from "@/components/FlowerFieldPanel";
import { runSwarmResearch, stopResearch } from "@/engine/swarm";
import { getHermes } from "@/engine/hermes";

type RightPanel = "content" | "flowers";

export default function ResearchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const research = useResearchStore((s) => s.researches.find((r) => r.id === id));
  const addMessage = useResearchStore((s) => s.addMessage);
  const setActiveResearch = useResearchStore((s) => s.setActiveResearch);
  const updateResearchMeta = useResearchStore((s) => s.updateResearchMeta);
  const initFlowerField = useResearchStore((s) => s.initFlowerField);

  const setReport = useResearchStore((s) => s.setReport);

  const [isProcessing, setIsProcessing] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>("content");

  const handleStop = useCallback(() => {
    if (!research) return;
    const stopped = stopResearch(id);
    if (stopped) {
      addMessage(id, { role: "system", content: "🛑 正在召唤蜂群回巢..." });
    }
  }, [id, research, addMessage]);

  useEffect(() => {
    initFlowerField();
  }, [initFlowerField]);

  useEffect(() => {
    setActiveResearch(id);
    return () => setActiveResearch(null);
  }, [id, setActiveResearch]);

  // 刷新恢复：如果上次报告生成被中断（状态还是 reporting），自动重试
  useEffect(() => {
    if (!research) return;
    if (research.status === "reporting" && !isProcessing) {
      const allFindings = research.bees.flatMap(b => b.findings);
      if (allFindings.length > 0) {
        setIsProcessing(true);
        const hermes = getHermes();
        const currentResearch = useResearchStore.getState().researches.find(r => r.id === id);
        addMessage(id, { role: "system", content: "⏳ 检测到上次报告生成被中断，正在恢复..." });
        hermes.generateReport(
          research.objective,
          allFindings,
          currentResearch?.graph || research.graph,
          currentResearch?.roundSummaries || [],
        ).then(report => {
          setReport(id, report);
          addMessage(id, { role: "system", content: "✅ 报告已重新生成，请查看右侧「采蜜报告」标签。" });
        }).catch(err => {
          addMessage(id, { role: "system", content: `⚠️ 报告恢复失败: ${err instanceof Error ? err.message : "未知错误"}` });
          useResearchStore.getState().updateResearchStatus(id, "completed");
        }).finally(() => {
          setIsProcessing(false);
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

    const handleSend = useCallback(
    async (text: string) => {
      if (!research || isProcessing) return;
      addMessage(id, { role: "user", content: text });

      setIsProcessing(true);
      try {
        const hermes = getHermes();
        const allFindings = research.bees.flatMap(b => b.findings);

        // ─── 蜂后对话（Tool Calling Agent） ───
        // 蜂后自己决定：直接回答 or 调用 swarm_research skill
        const queenResult = await hermes.queenChat(text, {
          objective: research.objective,
          findings: allFindings,
          graph: research.graph,
          recentMessages: research.messages.slice(-8).map(m => ({
            role: m.role,
            content: m.content,
          })),
          hasReport: !!research.report,
          status: research.status,
          beesStatus: research.bees.map(b => ({
            name: b.name,
            status: b.status,
            task: b.task?.query || "无",
          })),
        });

        // ─── 处理蜂后的回复 ───

        console.log("[Page] Queen result:", {
          hasContent: !!queenResult.content,
          contentPreview: queenResult.content?.slice(0, 80),
          toolCallsCount: queenResult.toolCalls.length,
          toolNames: queenResult.toolCalls.map(tc => tc.function?.name),
        });
        
        // 1. 如果蜂后有文字回复，显示出来
        if (queenResult.content) {
          addMessage(id, { role: "queen", content: queenResult.content });
        }

        // 2. 如果蜂后调用了 swarm_research skill，启动蜂群搜索
        const researchCall = queenResult.toolCalls.find(
          tc => tc.function?.name === "swarm_research"
        );

        if (researchCall) {
          let query = text; // 默认用用户原文
          try {
            const args = JSON.parse(researchCall.function.arguments);
            query = args.query || text;
            if (args.reason && !queenResult.content) {
              // 如果蜂后没有文字回复但给了 reason，用 reason 作为过渡消息
              addMessage(id, { role: "queen", content: `🐝 ${args.reason}\n\n正在派出蜜蜂去搜索...` });
            }
          } catch {
            // JSON 解析失败，用原文搜索
          }

          // 首次搜索时更新标题
          if (research.messages.length === 0 || (!allFindings.length && !research.report)) {
            updateResearchMeta(id, "🐝 蜂后正在理解…", query);
          }

          await runSwarmResearch(id, query);
        }

        // 2b. 如果蜂后调用了 generate_report skill，生成/重新生成报告
        const reportCall = queenResult.toolCalls.find(
          tc => tc.function?.name === "generate_report"
        );

        if (reportCall && !researchCall) {
          console.log("[Page] ✅ generate_report TOOL CALL detected! Generating report...");
          let focus = "";
          try {
            const args = JSON.parse(reportCall.function.arguments);
            focus = args.focus || "";
          } catch {
            // ignore
          }

          if (allFindings.length === 0) {
            addMessage(id, { role: "queen", content: "🐝 蜂巢里还没有花蜜呢，我得先派蜜蜂去采集信息才能酿报告哦~" });
          } else {
            addMessage(id, { role: "system", content: `⏳ 正在调用报告引擎${focus ? `（聚焦：${focus}）` : ""}，预计需要 30-60 秒...` });
            useResearchStore.getState().updateResearchStatus(id, "reporting");
            try {
              const currentResearch = useResearchStore.getState().researches.find(r => r.id === id);
              const report = await hermes.generateReport(
                research.objective,
                allFindings,
                currentResearch?.graph || research.graph,
                currentResearch?.roundSummaries || [],
                focus || undefined
              );
              setReport(id, report);
              addMessage(id, { role: "system", content: "✅ 报告已重新生成，请查看右侧「采蜜报告」标签。" });
            } catch (err) {
              addMessage(id, { role: "system", content: `⚠️ 报告生成失败: ${err instanceof Error ? err.message : "未知错误"}` });
            }
          }
        }

        // 3. 如果蜂后既没回复也没调用 tool（异常情况），给个兜底
        if (!queenResult.content && !researchCall && !reportCall) {
          addMessage(id, { role: "queen", content: "🐝 嗯...让我想想。你能再说详细一点吗？" });
        }

      } catch (err) {
        console.error("Handle send error:", err);
        addMessage(id, { role: "system", content: `💥 出错: ${err instanceof Error ? err.message : "未知错误"}` });
      }
      setIsProcessing(false);
    },
    [research, isProcessing, id, addMessage, updateResearchMeta, setReport]
  );

  if (!research) {
    return (
      <div className="min-h-screen bg-honey-50 flex items-center justify-center font-sans relative overflow-hidden">
        <div className="cute-card p-10 text-center max-w-sm">
          <div className="text-6xl mb-6 animate-bee-float">🐝❓</div>
          <p className="text-bee-dark/60 mb-6 font-bold text-lg">找不到这罐蜂蜜</p>
          <button onClick={() => router.push("/")} className="cute-btn px-6 py-2.5 bg-honey-400 text-bee-dark shadow-sm w-full">
            🏠 返回花田
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-honey-50 font-sans relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-honey-200/30 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <header className="flex-shrink-0 cute-header z-20 shadow-sm">
        <div className="px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="cute-btn px-4 py-1.5 bg-honey-100 text-honey-800 text-sm border-2 border-honey-200 hover:bg-honey-200"
          >
            ◀ 返回
          </button>

          <div className="w-px h-6 bg-honey-200" />

          <span className="text-2xl drop-shadow-sm">🐝</span>
          <div className="flex-1 min-w-0">
            <h1 className="font-extrabold text-base text-honey-800 truncate">
              {research.title === "新采蜜计划" ? "🐝 新采蜜计划 — 告诉蜂后你想找什么花蜜" : research.title}
            </h1>
            {research.objective !== "等待蜂后指示" && (
              <p className="text-xs text-honey-600/70 truncate font-medium mt-0.5">
                {research.objective}
              </p>
            )}
          </div>

          {isProcessing && (
            <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-full border-2 border-honey-200 shadow-sm">
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-2.5 h-2.5 bg-honey-400 rounded-full"
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="text-xs font-bold text-honey-700">采蜜中</span>
              </div>
              <div className="w-px h-3 bg-honey-200" />
              <button
                onClick={handleStop}
                className="text-red-500 hover:text-red-600 font-bold text-xs flex items-center gap-1 transition-colors"
                title="召唤蜂群回巢"
              >
                ■ 召回
              </button>
            </div>
          )}

          <div className="flex gap-2 ml-4 bg-honey-100/50 p-1 rounded-full border-2 border-honey-100">
            <button
              onClick={() => setRightPanel("content")}
              className={`cute-btn px-4 py-1.5 text-xs ${
                rightPanel === "content"
                  ? "bg-white text-honey-800 shadow-sm border-honey-200"
                  : "text-honey-600/60 hover:text-honey-700"
              }`}
            >
              📊 蜂巢
            </button>
            <button
              onClick={() => setRightPanel("flowers")}
              className={`cute-btn px-4 py-1.5 text-xs ${
                rightPanel === "flowers"
                  ? "bg-white text-honey-800 shadow-sm border-honey-200"
                  : "text-honey-600/60 hover:text-honey-700"
              }`}
            >
              🌸 花田
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        <div className="w-[420px] flex-shrink-0 border-r-2 border-honey-100 bg-white shadow-[4px_0_24px_rgba(253,176,34,0.05)] z-10">
          <ChatPanel messages={research.messages} onSend={handleSend} onStop={handleStop} isProcessing={isProcessing} />
        </div>
        <div className="flex-1 bg-honey-50/50 relative">
          {rightPanel === "content" ? (
            <ContentPanel
              bees={research.bees}
              graph={research.graph}
              report={research.report}
              status={research.status}
            />
          ) : (
            <FlowerFieldPanel />
          )}
        </div>
      </div>
    </div>
  );
}
