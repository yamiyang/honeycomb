"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SwarmVisualizer from "./SwarmVisualizer";
import type { BeeAgent, KnowledgeGraph } from "@/types";

interface ContentPanelProps {
  bees: BeeAgent[];
  graph: KnowledgeGraph;
  report?: string;
  status: string;
}

type Tab = "hive" | "report";

/* ═══════════════════════════════════════════
   HTML 报告渲染器
   ═══════════════════════════════════════════ */
function HtmlReportViewer({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(600);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const updateHeight = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc?.body) {
          const h = doc.body.scrollHeight;
          if (h > 0) setIframeHeight(Math.max(600, h + 40));
        }
      } catch {
        // cross-origin guard
      }
    };

    iframe.addEventListener("load", updateHeight);
    const timer = setTimeout(updateHeight, 500);
    return () => {
      iframe.removeEventListener("load", updateHeight);
      clearTimeout(timer);
    };
  }, [html]);

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-shrink-0 bg-white px-4 py-2.5 rounded-2xl border border-honey-100 shadow-sm">
        <span className="text-sm font-bold text-honey-700 flex items-center gap-2"><span>📄</span> 研究报告</span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => {
              const blob = new Blob([html], { type: "text/html;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "beesearch-research-report.html";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="cute-btn px-4 py-1.5 bg-honey-50 hover:bg-honey-100 text-honey-800 text-xs border border-honey-200"
          >
            ⬇️ 下载
          </button>
          <button
            onClick={() => {
              const blob = new Blob([html], { type: "text/html;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              window.open(url, "_blank");
            }}
            className="cute-btn px-4 py-1.5 bg-honey-50 hover:bg-honey-100 text-honey-800 text-xs border border-honey-200"
          >
            🔗 新窗口
          </button>
        </div>
      </div>
      <div className="flex-1 report-frame overflow-hidden">
        <iframe
          ref={iframeRef}
          srcDoc={html}
          sandbox="allow-same-origin allow-popups"
          className="w-full h-full bg-white rounded-[22px]"
          title="研究报告"
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   主面板 — 合并蜂群+知识图谱为「蜂巢」
   ═══════════════════════════════════════════ */
export default function ContentPanel({ bees, graph, report, status }: ContentPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("hive");

  const tabs: { id: Tab; label: string; emoji: string; enabled: boolean }[] = [
    { id: "hive", label: "蜂巢", emoji: "⬡", enabled: true },
    { id: "report", label: "报告", emoji: "📜", enabled: !!report },
  ];

  return (
    <div className="h-full flex flex-col font-sans">
      {/* Tab bar */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2 border-b-2 border-honey-100/50 bg-white/30 backdrop-blur-sm z-10">
        <div className="flex bg-honey-100/50 p-1 rounded-full border-2 border-white shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => tab.enabled && setActiveTab(tab.id)}
              className={`px-5 py-1.5 text-xs font-bold transition-all rounded-full flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "bg-white text-honey-700 shadow-sm border border-honey-200"
                  : tab.enabled
                  ? "text-honey-600/70 hover:text-honey-800 border border-transparent"
                  : "text-honey-800/30 cursor-not-allowed border border-transparent"
              }`}
            >
              <span className="text-base">{tab.emoji}</span> <span>{tab.label}</span>
              {tab.id === "hive" && (bees.length > 0 || graph.nodes.length > 0) && (
                <span className="ml-1 text-[10px] bg-honey-100 px-1.5 rounded-full text-honey-700">
                  {bees.filter((b) => b.status !== "retired").length}🐝 {graph.nodes.length}⬡
                </span>
              )}
              {tab.id === "report" && report && activeTab !== "report" && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="inline-block ml-1 w-2 h-2 rounded-full bg-red-400"
                />
              )}
            </button>
          ))}
        </div>

        {/* Status badge */}
        <div className="ml-auto bg-white px-3 py-1.5 rounded-full border border-honey-100 shadow-sm text-[11px] font-bold flex items-center gap-2 text-honey-700">
          {(status === "searching" || status === "planning" || status === "expanding") && (
            <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
              🟡
            </motion.span>
          )}
          {status === "completed" && <span>⭐</span>}
          {status === "reporting" && <span>📝</span>}
          {status === "error" && <span>💥</span>}
          <span>
            {status === "idle" && "待命"}
            {status === "planning" && "规划中"}
            {status === "searching" && "搜索中"}
            {status === "analyzing" && "分析中"}
            {status === "expanding" && "深化中"}
            {status === "reporting" && "出报告"}
            {status === "completed" && "完成!"}
            {status === "paused" && "暂停"}
            {status === "error" && "出错"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === "hive" && (
            <motion.div
              key="hive"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="h-full cute-card overflow-hidden"
            >
              {bees.length === 0 && graph.nodes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-honey-800/40 gap-4">
                  <span className="text-6xl animate-bee-float opacity-50 grayscale">🐝</span>
                  <div className="text-center bg-honey-50/50 p-6 rounded-3xl border border-honey-100">
                    <p className="text-base font-extrabold mb-2 text-honey-800/60">蜜蜂们正在蜂巢里等待</p>
                    <p className="text-xs text-honey-800/40">
                      输入研究目标即可派出蜂群
                    </p>
                  </div>
                </div>
              ) : (
                <SwarmVisualizer bees={bees} graph={graph} />
              )}
            </motion.div>
          )}

          {activeTab === "report" && (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="h-full overflow-hidden"
            >
              {report ? (
                <HtmlReportViewer html={report} />
              ) : (
                <div className="h-full cute-card flex flex-col items-center justify-center text-honey-800/40">
                  <div className="text-center">
                    <span className="text-5xl mb-4 block animate-bounce opacity-50 grayscale">📝</span>
                    <p className="font-extrabold text-honey-800/60">报告生成中...</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
