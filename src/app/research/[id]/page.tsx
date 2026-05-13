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

  // 一键停止研究
  const handleStop = useCallback(() => {
    if (!research) return;
    const stopped = stopResearch(id);
    if (stopped) {
      addMessage(id, { role: "system", content: "🛑 正在停止研究..." });
    }
  }, [id, research, addMessage]);

  // 初始化花田系统
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

      // Add user message
      addMessage(id, { role: "user", content: text });

      // If research is idle, start the swarm
      if (research.status === "idle" || research.status === "completed" || research.status === "error") {
        setIsProcessing(true);
        try {
          await runSwarmResearch(id, text);
        } catch (err) {
          console.error("Swarm error:", err);
          addMessage(id, { role: "system", content: `⚠️ 研究出错: ${err instanceof Error ? err.message : "未知错误"}` });
        }
        setIsProcessing(false);
      } else {
        // Research already running, acknowledge
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
      <div className="min-h-screen bg-honey-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🐝❓</div>
          <p className="text-bee-dark/60 mb-4">找不到这个研究</p>
          <button onClick={() => router.push("/")} className="text-honey-600 hover:underline text-sm">
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-honey-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-white/80 backdrop-blur-md border-b-2 border-honey-200 z-20">
        <div className="px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1 text-sm text-bee-dark/50 hover:text-bee-dark transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            返回
          </button>

          <div className="w-px h-5 bg-honey-200" />

          <motion.span
            className="text-xl"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🐝
          </motion.span>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm text-bee-dark truncate">{research.title}</h1>
            <p className="text-[10px] text-bee-dark/40 truncate">{research.objective}</p>
          </div>

          {/* Status Badge + Stop Button */}
          {isProcessing && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-honey-100 border border-honey-200">
                <motion.div
                  className="w-2 h-2 rounded-full bg-honey-500"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="text-xs text-bee-dark/60">蜂群搜索中</span>
              </div>
              <button
                onClick={handleStop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200
                  text-red-600 text-xs font-medium hover:bg-red-100 hover:border-red-300
                  transition-all active:scale-95 shadow-sm"
                title="停止研究"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                停止
              </button>
            </div>
          )}

          {/* Right panel toggles */}
          <div className="flex gap-1 ml-2">
            <button
              onClick={() => setRightPanel("content")}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                rightPanel === "content"
                  ? "bg-honey-200 text-bee-dark font-medium"
                  : "text-bee-dark/40 hover:text-bee-dark/70"
              }`}
            >
              📊 研究
            </button>
            <button
              onClick={() => setRightPanel("flowers")}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                rightPanel === "flowers"
                  ? "bg-honey-200 text-bee-dark font-medium"
                  : "text-bee-dark/40 hover:text-bee-dark/70"
              }`}
            >
              🌸 花田
            </button>
          </div>
        </div>
      </header>

      {/* Main content: Chat (left) + Content/Flowers (right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat Panel */}
        <div className="w-[420px] flex-shrink-0 border-r-2 border-honey-200 bg-white/40 backdrop-blur-sm">
          <ChatPanel messages={research.messages} onSend={handleSend} onStop={handleStop} isProcessing={isProcessing} />
        </div>

        {/* Right: Content/Flowers Panel */}
        <div className="flex-1 bg-honey-50/80">
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
