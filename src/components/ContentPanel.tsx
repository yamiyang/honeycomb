"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SwarmVisualizer from "./SwarmVisualizer";
import type { BeeAgent, KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from "@/types";

interface ContentPanelProps {
  bees: BeeAgent[];
  graph: KnowledgeGraph;
  report?: string;
  status: string;
}

type Tab = "swarm" | "graph" | "report";

/* ─── 知识图谱交互式可视化（纯 canvas 实现） ─── */
function KnowledgeGraphView({ graph }: { graph: KnowledgeGraph }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  
  // 节点颜色映射
  const nodeColors: Record<string, string> = {
    concept: "#FFC107",
    entity: "#FF9800",
    fact: "#A8D85E",
    insight: "#E91E63",
    source: "#87CEEB",
    question: "#9C27B0",
    contradiction: "#F44336",
  };

  // 节点类型中文名
  const nodeTypeNames: Record<string, string> = {
    concept: "概念",
    entity: "实体",
    fact: "事实",
    insight: "洞察",
    source: "来源",
    question: "问题",
    contradiction: "矛盾",
  };

  // 关系类型中文名
  const edgeTypeNames: Record<string, string> = {
    supports: "支持",
    contradicts: "矛盾",
    causes: "导致",
    relates: "相关",
    specializes: "细化",
    depends: "依赖",
  };

  // 力导向布局计算
  const layout = useMemo(() => {
    if (graph.nodes.length === 0) return { positions: new Map<string, { x: number; y: number }>() };
    
    const positions = new Map<string, { x: number; y: number }>();
    const width = 600;
    const height = 400;
    
    // 初始化位置 — 按轮次环形分布
    const rounds = [...new Set(graph.nodes.map(n => n.round))].sort();
    graph.nodes.forEach((node, i) => {
      const roundIndex = rounds.indexOf(node.round);
      const nodesInRound = graph.nodes.filter(n => n.round === node.round);
      const indexInRound = nodesInRound.indexOf(node);
      const angleStep = (2 * Math.PI) / Math.max(nodesInRound.length, 1);
      const radius = 80 + roundIndex * 80;
      const angle = indexInRound * angleStep - Math.PI / 2;
      
      positions.set(node.id, {
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
      });
    });

    // 简单力导向迭代
    for (let iter = 0; iter < 50; iter++) {
      // 斥力
      graph.nodes.forEach((a) => {
        const posA = positions.get(a.id)!;
        graph.nodes.forEach((b) => {
          if (a.id === b.id) return;
          const posB = positions.get(b.id)!;
          const dx = posA.x - posB.x;
          const dy = posA.y - posB.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 800 / (dist * dist);
          posA.x += (dx / dist) * force;
          posA.y += (dy / dist) * force;
        });
      });

      // 引力（通过边连接的节点）
      graph.edges.forEach((edge) => {
        const srcNode = graph.nodes.find(n => n.id === edge.source || n.label === edge.source);
        const tgtNode = graph.nodes.find(n => n.id === edge.target || n.label === edge.target);
        if (!srcNode || !tgtNode) return;
        const posA = positions.get(srcNode.id);
        const posB = positions.get(tgtNode.id);
        if (!posA || !posB) return;
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = dist * 0.01;
        posA.x += (dx / dist) * force;
        posA.y += (dy / dist) * force;
        posB.x -= (dx / dist) * force;
        posB.y -= (dy / dist) * force;
      });

      // 中心引力
      graph.nodes.forEach((node) => {
        const pos = positions.get(node.id)!;
        pos.x += (width / 2 - pos.x) * 0.01;
        pos.y += (height / 2 - pos.y) * 0.01;
      });
    }

    // 边界约束
    graph.nodes.forEach((node) => {
      const pos = positions.get(node.id)!;
      pos.x = Math.max(40, Math.min(width - 40, pos.x));
      pos.y = Math.max(40, Math.min(height - 40, pos.y));
    });

    return { positions };
  }, [graph.nodes, graph.edges]);

  // Canvas 绘制
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const scaleX = rect.width / 600;
    const scaleY = rect.height / 400;

    // 绘制边
    graph.edges.forEach((edge) => {
      const srcNode = graph.nodes.find(n => n.id === edge.source || n.label === edge.source);
      const tgtNode = graph.nodes.find(n => n.id === edge.target || n.label === edge.target);
      if (!srcNode || !tgtNode) return;
      const posA = layout.positions.get(srcNode.id);
      const posB = layout.positions.get(tgtNode.id);
      if (!posA || !posB) return;

      ctx.beginPath();
      ctx.moveTo(posA.x * scaleX, posA.y * scaleY);
      ctx.lineTo(posB.x * scaleX, posB.y * scaleY);
      ctx.strokeStyle = edge.type === "contradicts" ? "#F44336" : edge.type === "causes" ? "#FF9800" : "#FFE49A";
      ctx.lineWidth = Math.max(1, edge.weight * 3);
      ctx.stroke();

      // 绘制关系标签
      const midX = (posA.x + posB.x) / 2 * scaleX;
      const midY = (posA.y + posB.y) / 2 * scaleY;
      ctx.fillStyle = "#9A7100";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(edge.label.slice(0, 6), midX, midY - 4);
    });

    // 绘制节点
    graph.nodes.forEach((node) => {
      const pos = layout.positions.get(node.id);
      if (!pos) return;
      const x = pos.x * scaleX;
      const y = pos.y * scaleY;
      const r = 12 + node.weight * 16;
      const isHovered = hoveredNode === node.id;
      const isSelected = selectedNode?.id === node.id;

      // 节点光晕
      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = `${nodeColors[node.type] || "#FFC107"}40`;
        ctx.fill();
      }

      // 节点圆
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = nodeColors[node.type] || "#FFC107";
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#3D2C00" : "#FFFFFF";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // 标签
      ctx.fillStyle = "#3D2C00";
      ctx.font = `${isHovered ? "bold " : ""}10px sans-serif`;
      ctx.textAlign = "center";
      const label = node.label.length > 8 ? node.label.slice(0, 8) + "…" : node.label;
      ctx.fillText(label, x, y + r + 14);
    });
  }, [graph, layout, hoveredNode, selectedNode]);

  // 鼠标事件处理
  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const scaleX = rect.width / 600;
    const scaleY = rect.height / 400;

    let found: KnowledgeNode | null = null;
    graph.nodes.forEach((node) => {
      const pos = layout.positions.get(node.id);
      if (!pos) return;
      const x = pos.x * scaleX;
      const y = pos.y * scaleY;
      const r = 12 + node.weight * 16;
      if (Math.sqrt((mx - x) ** 2 + (my - y) ** 2) < r + 4) {
        found = node;
      }
    });
    setSelectedNode(found);
  };

  const handleCanvasMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const scaleX = rect.width / 600;
    const scaleY = rect.height / 400;

    let found: string | null = null;
    graph.nodes.forEach((node) => {
      const pos = layout.positions.get(node.id);
      if (!pos) return;
      const x = pos.x * scaleX;
      const y = pos.y * scaleY;
      const r = 12 + node.weight * 16;
      if (Math.sqrt((mx - x) ** 2 + (my - y) ** 2) < r + 4) {
        found = node.id;
      }
    });
    setHoveredNode(found);
  };

  return (
    <div className="h-full flex flex-col gap-3">
      {/* 统计栏 */}
      <div className="flex gap-3 text-sm flex-shrink-0">
        <div className="px-3 py-2 rounded-xl bg-honey-100 border border-honey-200">
          <span className="font-bold text-honey-700">{graph.nodes.length}</span>{" "}
          <span className="text-bee-dark/60">节点</span>
        </div>
        <div className="px-3 py-2 rounded-xl bg-honey-100 border border-honey-200">
          <span className="font-bold text-honey-700">{graph.edges.length}</span>{" "}
          <span className="text-bee-dark/60">关系</span>
        </div>
        <div className="ml-auto flex gap-1 flex-wrap">
          {Object.entries(nodeColors).map(([type, color]) => {
            const count = graph.nodes.filter(n => n.type === type).length;
            if (count === 0) return null;
            return (
              <div key={type} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]" style={{ background: color + "30" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                {nodeTypeNames[type]} ({count})
              </div>
            );
          })}
        </div>
      </div>

      {/* Canvas 图谱 */}
      <div ref={containerRef} className="flex-1 relative bg-white rounded-xl border border-honey-200 overflow-hidden min-h-[300px]">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMove}
          className="w-full h-full cursor-pointer"
        />
      </div>

      {/* 选中节点详情 */}
      {selectedNode && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex-shrink-0 p-3 bg-white rounded-xl border border-honey-200 text-xs"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-full" style={{ background: nodeColors[selectedNode.type] }} />
            <span className="font-bold text-bee-dark">{selectedNode.label}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: nodeColors[selectedNode.type] + "30" }}>
              {nodeTypeNames[selectedNode.type]}
            </span>
            <span className="ml-auto text-bee-dark/40">第{selectedNode.round}轮 | 权重 {selectedNode.weight.toFixed(2)}</span>
            <button onClick={() => setSelectedNode(null)} className="text-bee-dark/30 hover:text-bee-dark">✕</button>
          </div>
          <p className="text-bee-dark/70 leading-relaxed">{selectedNode.content}</p>
          {/* 相关的边 */}
          <div className="mt-2 flex flex-wrap gap-1">
            {graph.edges
              .filter(e => e.source === selectedNode.id || e.target === selectedNode.id || 
                           e.source === selectedNode.label || e.target === selectedNode.label)
              .slice(0, 6)
              .map((edge) => {
                const other = (edge.source === selectedNode.id || edge.source === selectedNode.label)
                  ? graph.nodes.find(n => n.id === edge.target || n.label === edge.target)?.label || edge.target
                  : graph.nodes.find(n => n.id === edge.source || n.label === edge.source)?.label || edge.source;
                return (
                  <span key={edge.id} className="px-2 py-0.5 bg-honey-50 rounded text-[10px] text-bee-dark/60">
                    {edgeTypeNames[edge.type] || edge.type} → {other}
                  </span>
                );
              })}
          </div>
        </motion.div>
      )}

      {/* 关系列表 */}
      {graph.edges.length > 0 && !selectedNode && (
        <div className="flex-shrink-0 max-h-32 overflow-auto space-y-1">
          <h4 className="text-xs font-medium text-bee-dark/50 mb-1">核心关系链 (最新 {Math.min(graph.edges.length, 12)} 条)</h4>
          {graph.edges.slice(-12).map((edge) => {
            const srcNode = graph.nodes.find(n => n.id === edge.source || n.label === edge.source);
            const tgtNode = graph.nodes.find(n => n.id === edge.target || n.label === edge.target);
            return (
              <div key={edge.id} className="flex items-center gap-1 text-[10px] text-bee-dark/60">
                <span className="px-1.5 py-0.5 bg-honey-100 rounded">{srcNode?.label.slice(0, 10) || "?"}</span>
                <span className="text-honey-500">→ {edgeTypeNames[edge.type] || edge.label} →</span>
                <span className="px-1.5 py-0.5 bg-honey-100 rounded">{tgtNode?.label.slice(0, 10) || "?"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── HTML 报告渲染器 ─── */
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
    // 延迟更新以确保内容渲染完毕
    const timer = setTimeout(updateHeight, 500);

    return () => {
      iframe.removeEventListener("load", updateHeight);
      clearTimeout(timer);
    };
  }, [html]);

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-bee-dark/50">📄 HTML 研究报告</span>
        <button
          onClick={() => {
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "argus-research-report.html";
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="ml-auto px-3 py-1 rounded-lg bg-honey-100 text-xs text-bee-dark/60 hover:bg-honey-200 transition-colors border border-honey-200"
        >
          ⬇️ 下载报告
        </button>
        <button
          onClick={() => {
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
          }}
          className="px-3 py-1 rounded-lg bg-honey-100 text-xs text-bee-dark/60 hover:bg-honey-200 transition-colors border border-honey-200"
        >
          🔗 新窗口打开
        </button>
      </div>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        sandbox="allow-same-origin allow-popups"
        className="flex-1 w-full border-2 border-honey-200 rounded-xl bg-white"
        style={{ minHeight: `${iframeHeight}px` }}
        title="研究报告"
      />
    </div>
  );
}

export default function ContentPanel({ bees, graph, report, status }: ContentPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("swarm");

  const tabs: { id: Tab; label: string; emoji: string; enabled: boolean }[] = [
    { id: "swarm", label: "蜂群", emoji: "🐝", enabled: true },
    { id: "graph", label: "蜂巢", emoji: "🏠", enabled: graph.nodes.length > 0 },
    { id: "report", label: "报告", emoji: "📄", enabled: !!report },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => tab.enabled && setActiveTab(tab.id)}
            className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-honey-400 text-bee-dark shadow-md shadow-honey-400/20"
                : tab.enabled
                ? "text-bee-dark/60 hover:bg-honey-100"
                : "text-bee-dark/20 cursor-not-allowed"
            }`}
          >
            <span className="mr-1">{tab.emoji}</span>
            {tab.label}
            {tab.id === "graph" && graph.nodes.length > 0 && (
              <span className="ml-1 text-[10px] opacity-60">({graph.nodes.length})</span>
            )}
            {/* Notification dot for report ready */}
            {tab.id === "report" && report && activeTab !== "report" && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full border-2 border-white"
              />
            )}
          </button>
        ))}

        {/* Status badge */}
        <div className="ml-auto text-xs text-bee-dark/50 flex items-center gap-1.5">
          {(status === "searching" || status === "planning" || status === "expanding") && (
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
              🟡
            </motion.span>
          )}
          {status === "completed" && <span>✅</span>}
          {status === "reporting" && <span>📝</span>}
          {status === "error" && <span>❌</span>}
          <span>
            {status === "idle" && "等待指令"}
            {status === "planning" && "AI 规划中"}
            {status === "searching" && "蜂群搜索中"}
            {status === "analyzing" && "AI 分析中"}
            {status === "expanding" && "深化扩展中"}
            {status === "reporting" && "生成报告"}
            {status === "completed" && "已完成"}
            {status === "paused" && "已暂停"}
            {status === "error" && "出错"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "swarm" && (
            <motion.div
              key="swarm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full"
            >
              {bees.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-bee-dark/30 gap-3">
                  <div className="text-6xl">🌻</div>
                  <p className="text-sm">蜜蜂们正在蜂巢里等待任务</p>
                  <p className="text-xs">输入研究目标即可派出蜂群</p>
                </div>
              ) : (
                <SwarmVisualizer bees={bees} graph={graph} />
              )}
            </motion.div>
          )}

          {activeTab === "graph" && (
            <motion.div
              key="graph"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full overflow-auto"
            >
              <KnowledgeGraphView graph={graph} />
            </motion.div>
          )}

          {activeTab === "report" && (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full overflow-auto"
            >
              {report ? (
                <HtmlReportViewer html={report} />
              ) : (
                <div className="h-full flex items-center justify-center text-bee-dark/30 text-sm">
                  <div className="text-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="text-4xl mb-3"
                    >
                      📝
                    </motion.div>
                    <p>HTML 报告生成中...</p>
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
