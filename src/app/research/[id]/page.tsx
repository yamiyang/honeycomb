"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useResearchStore } from "@/store/research-store";
import ChatPanel from "@/components/ChatPanel";
import ContentPanel from "@/components/ContentPanel";
import FlowerFieldPanel from "@/components/FlowerFieldPanel";
import { runSwarmResearch, stopResearch } from "@/engine/swarm";

type RightPanel = "content" | "flowers";

export default function ResearchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const research = useResearchStore((s) => s.researches.find((r) => r.id === id));
  const addMessage = useResearchStore((s) => s.addMessage);
  const setActiveResearch = useResearchStore((s) => s.setActiveResearch);
  const initFlowerField = useResearchStore((s) => s.initFlowerField);

  const [isProcessing, setIsProcessing] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>("content");

  const handleStop = useCallback(() => {
    if (!research) return;
    const stopped = stopResearch(id);
    if (stopped) {
      addMessage(id, { role: "system", content: "🛑 正在停止研究..." });
    }
  }, [id, research, addMessage]);

  useEffect(() => {
    initFlowerField();
  }, [initFlowerField]);

  useEffect(() => {
    setActiveResearch(id);
    return () => setActiveResearch(null);
  }, [id, setActiveResearch]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!research || isProcessing) return;
      addMessage(id, { role: "user", content: text });

      if (research.status === "idle" || research.status === "completed" || research.status === "error") {
        setIsProcessing(true);
        try {
          await runSwarmResearch(id, text);
        } catch (err) {
          console.error("Swarm error:", err);
          addMessage(id, { role: "system", content: `💥 研究出错: ${err instanceof Error ? err.message : "未知错误"}` });
        }
        setIsProcessing(false);
      } else {
        addMessage(id, {
          role: "queen",
          content: `📩 收到指令：「${text}」\n当前研究正在进行中，请等待完成后再发起新的研究。`,
        });
      }
    },
    [research, isProcessing, id, addMessage]
  );

  if (!research) {
    return (
      <div className="min-h-screen bg-honey-50 flex items-center justify-center font-sans relative overflow-hidden">
        <div className="cute-card p-10 text-center max-w-sm">
          <div className="text-6xl mb-6 animate-bee-float">🐝❓</div>
          <p className="text-bee-dark/60 mb-6 font-bold text-lg">找不到这个研究任务</p>
          <button onClick={() => router.push("/")} className="cute-btn px-6 py-2.5 bg-honey-400 text-bee-dark shadow-sm w-full">
            🏠 返回首页
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
              {research.title}
            </h1>
            <p className="text-xs text-honey-600/70 truncate font-medium mt-0.5">
              {research.objective}
            </p>
          </div>

          {isProcessing && (
            <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-full border-2 border-honey-200 shadow-sm">
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-2.5 h-2.5 bg-honey-400 rounded-full"
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="text-xs font-bold text-honey-700">搜索中</span>
              </div>
              <div className="w-px h-3 bg-honey-200" />
              <button
                onClick={handleStop}
                className="text-red-500 hover:text-red-600 font-bold text-xs flex items-center gap-1 transition-colors"
                title="停止研究"
              >
                ■ 停止
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
              📊 研究
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
