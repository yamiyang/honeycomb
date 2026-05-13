"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import BeeIcon from "./BeeIcon";
import type { BeeAgent, KnowledgeGraph, KnowledgeNode, Finding } from "@/types";

interface SwarmVisualizerProps {
  bees: BeeAgent[];
  graph: KnowledgeGraph;
}

const statusLabel: Record<string, string> = {
  idle: "待命",
  searching: "搜索",
  analyzing: "分析",
  returning: "归巢",
  resting: "休息",
  error: "出错",
  retired: "退休",
};

const statusDotColor: Record<string, string> = {
  idle: "bg-gray-400",
  searching: "bg-amber-400",
  analyzing: "bg-purple-400",
  returning: "bg-green-400",
  resting: "bg-blue-300",
  error: "bg-red-400",
  retired: "bg-gray-500",
};

const nodeEmoji: Record<string, string> = {
  concept: "💡",
  entity: "🏷️",
  fact: "📌",
  insight: "✨",
  source: "🔗",
  question: "❓",
  contradiction: "⚡",
};

const nodeColor: Record<string, { fill: string; stroke: string }> = {
  concept: { fill: "#fff9d6", stroke: "#ffcc45" },
  entity: { fill: "#fff1e5", stroke: "#fb923c" },
  fact: { fill: "#ecfdf5", stroke: "#34d399" },
  insight: { fill: "#fdf2f8", stroke: "#f472b6" },
  source: { fill: "#eff6ff", stroke: "#38bdf8" },
  question: { fill: "#f5f3ff", stroke: "#c084fc" },
  contradiction: { fill: "#fef2f2", stroke: "#fb7185" },
};

const nodeTypeNames: Record<string, string> = {
  concept: "概念",
  entity: "实体",
  fact: "事实",
  insight: "洞察",
  source: "来源",
  question: "问题",
  contradiction: "矛盾",
};

/* ── Flat-top hexagon math ── */
const HEX_SIZE = 32; // radius from center to vertex
const HEX_W = HEX_SIZE * 2;
const HEX_H = HEX_SIZE * Math.sqrt(3);

/** Generate flat-top hexagon points string for SVG polygon */
function hexPoints(cx: number, cy: number, r: number, cornerRadius = 4): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

/**
 * Build a dense honeycomb grid from center outward (axial spiral).
 * Returns array of {q, r} axial coords → pixel {x, y}.
 */
function hexRingPositions(count: number): { x: number; y: number }[] {
  if (count === 0) return [];
  const dirs = [
    [1, 0], [0, 1], [-1, 1],
    [-1, 0], [0, -1], [1, -1],
  ];
  const results: { q: number; r: number }[] = [{ q: 0, r: 0 }];
  let ring = 1;
  while (results.length < count) {
    let q = ring;
    let r = 0;
    for (let d = 0; d < 6 && results.length < count; d++) {
      for (let s = 0; s < ring && results.length < count; s++) {
        results.push({ q, r });
        q += dirs[d][0];
        r += dirs[d][1];
      }
    }
    ring++;
  }
  // flat-top hex: x = size * 3/2 * q, y = size * sqrt(3) * (r + q/2)
  return results.map(({ q, r }) => ({
    x: HEX_SIZE * 1.5 * q,
    y: HEX_SIZE * Math.sqrt(3) * (r + q / 2),
  }));
}

/* ── Cell type definitions ── */
type CellData =
  | { kind: "hive" }
  | { kind: "bee"; bee: BeeAgent }
  | { kind: "node"; node: KnowledgeNode }
  | { kind: "empty" };

export default function SwarmVisualizer({ bees, graph }: SwarmVisualizerProps) {
  const activeBees = bees.filter((b) => b.status !== "retired");
  const retiredCount = bees.length - activeBees.length;
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [hoverData, setHoverData] = useState<{ type: "bee" | "node", data: BeeAgent | KnowledgeNode, x: number, y: number } | null>(null);
  
  const [sidebarTab, setSidebarTab] = useState<"bees" | "sources">("bees");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  // Compute source stats
  const sourceStats = useMemo(() => {
    const stats = new Map<string, { count: number; findings: Finding[] }>();
    bees.forEach(b => {
      b.findings.forEach(f => {
        // Collect unique source names for this finding
        const sourceNames = Array.from(new Set(f.sourceResults.map(sr => sr.sourceName)));
        sourceNames.forEach(sn => {
          if (!stats.has(sn)) {
            stats.set(sn, { count: 0, findings: [] });
          }
          const stat = stats.get(sn)!;
          stat.count += 1;
          stat.findings.push(f);
        });
      });
    });
    // Sort by count descending
    return Array.from(stats.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [bees]);

  // Build cells: center hive → bees → knowledge nodes → empty fill
  const nodes = graph.nodes.slice(-60);
  const minCells = 1 + activeBees.length + nodes.length;
  // Fill extra empties to make a nice honeycomb
  const totalCells = Math.max(minCells, 37); // at least 3 rings
  const positions = hexRingPositions(totalCells);

  const cells: CellData[] = positions.map((_, idx) => {
    if (idx === 0) return { kind: "hive" };
    const beeIdx = idx - 1;
    if (beeIdx < activeBees.length) return { kind: "bee", bee: activeBees[beeIdx] };
    const nodeIdx = beeIdx - activeBees.length;
    if (nodeIdx < nodes.length) return { kind: "node", node: nodes[nodeIdx] };
    return { kind: "empty" };
  });

  // Calculate SVG viewBox
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const pad = HEX_SIZE + 20;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;
  const vw = maxX - minX;
  const vh = maxY - minY;

  return (
    <div className="h-full flex gap-0 font-sans">
      {/* Left: Dense Honeycomb SVG */}
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-honey-50 to-white relative rounded-l-[20px] overflow-hidden">
        {/* Stats HUD */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-3 text-xs font-bold text-honey-800/80 flex-wrap">
          <div className="bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-honey-100 shadow-sm flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="text-sm">🐝</span> {activeBees.length}</span>
            {retiredCount > 0 && <span className="flex items-center gap-1"><span className="text-sm">👻</span> {retiredCount}</span>}
            <div className="w-px h-3 bg-honey-200" />
            <span className="flex items-center gap-1"><span className="text-sm">⬡</span> {graph.nodes.length}</span>
            <div className="w-px h-3 bg-honey-200" />
            <span className="flex items-center gap-1"><span className="text-sm">🔗</span> {graph.edges.length}</span>
          </div>
          
          {/* Node type legend */}
          <div className="ml-auto flex gap-1.5 flex-wrap bg-white/80 backdrop-blur-md px-2 py-1 rounded-full border border-honey-100 shadow-sm">
            {Object.entries(nodeColor).map(([type, colors]) => {
              const count = graph.nodes.filter((n) => n.type === type).length;
              if (count === 0) return null;
              return (
                <span key={type} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full shadow-sm"
                  style={{ background: colors.fill, border: `1px solid ${colors.stroke}` }}>
                  {nodeEmoji[type]} {nodeTypeNames[type]}×{count}
                </span>
              );
            })}
          </div>
        </div>

        {/* Honeycomb SVG */}
        <div className="flex-1 overflow-auto flex items-center justify-center">
          <svg
            viewBox={`${minX} ${minY} ${vw} ${vh}`}
            className="w-full h-full max-h-[800px]"
            style={{ minHeight: 300 }}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Draw edges between connected knowledge nodes */}
            {graph.edges.map((edge) => {
              const srcNodeData = nodes.find((n) => n.id === edge.source || n.label === edge.source);
              const tgtNodeData = nodes.find((n) => n.id === edge.target || n.label === edge.target);
              if (!srcNodeData || !tgtNodeData) return null;
              const srcIdx = nodes.indexOf(srcNodeData) + 1 + activeBees.length;
              const tgtIdx = nodes.indexOf(tgtNodeData) + 1 + activeBees.length;
              if (srcIdx >= positions.length || tgtIdx >= positions.length) return null;
              const p1 = positions[srcIdx];
              const p2 = positions[tgtIdx];
              const edgeColor = edge.type === "contradicts" ? "#fca5a5" : edge.type === "causes" ? "#fdba74" : "#fde047";
              return (
                <path key={`edge-${edge.id}`}
                  d={`M ${p1.x} ${p1.y} Q ${(p1.x + p2.x)/2} ${(p1.y + p2.y)/2 - 10} ${p2.x} ${p2.y}`}
                  fill="none"
                  stroke={edgeColor} strokeWidth="2" opacity="0.6" strokeLinecap="round"
                  strokeDasharray={edge.type === "contradicts" ? "4,4" : "none"}
                />
              );
            })}

            {/* Render cells */}
            {cells.map((cell, idx) => {
              const { x, y } = positions[idx];
              const pts = hexPoints(x, y, HEX_SIZE - 2);

              if (cell.kind === "hive") {
                return (
                  <g key="hive">
                    <polygon points={pts} fill="#ffcc45" stroke="#fdb022" strokeWidth="3" strokeLinejoin="round" />
                    <text x={x} y={y + 2} textAnchor="middle" dominantBaseline="central" fontSize="20">🍯</text>
                  </g>
                );
              }

              if (cell.kind === "bee") {
                const bee = cell.bee;
                const isWorking = bee.status === "searching" || bee.status === "analyzing";
                const isError = bee.status === "error";
                const fill = isWorking ? "#fff9d6" : isError ? "#fef2f2" : bee.status === "resting" ? "#eff6ff" : "#fff";
                const stroke = isWorking ? "#ffcc45" : isError ? "#fca5a5" : bee.status === "resting" ? "#7dd3fc" : "#fef08a";
                return (
                  <g key={`bee-${bee.id}`} className="hex-cell" style={{ cursor: "default" }}
                    onMouseMove={(e) => setHoverData({ type: "bee", data: bee, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHoverData(null)}
                  >
                    <polygon points={pts} fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
                    <text x={x} y={y - 5} textAnchor="middle" dominantBaseline="central" fontSize="16">🐝</text>
                    <text x={x} y={y + 12} textAnchor="middle" fontSize="8" fill="#73400b" fontWeight="bold">
                      {bee.name.slice(0, 5)}
                    </text>
                    {isWorking && (
                      <polygon points={pts} fill="none" stroke={stroke} strokeWidth="2" opacity="0.5" strokeLinejoin="round" style={{ transformOrigin: `${x}px ${y}px` }}>
                        <animate attributeName="opacity" values="0.5;0;0.5" dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="transform" values="scale(1);scale(1.1);scale(1)" dur="1.5s" repeatCount="indefinite" fill="freeze" />
                      </polygon>
                    )}
                  </g>
                );
              }

              if (cell.kind === "node") {
                const node = cell.node;
                const colors = nodeColor[node.type] || nodeColor.concept;
                const isSelected = selectedNode?.id === node.id;
                return (
                    <g key={`node-${node.id}`}
                    className="hex-cell transition-all"
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setSelectedNode(isSelected ? null : node);
                      setSelectedSource(null);
                    }}
                    onMouseMove={(e) => setHoverData({ type: "node", data: node, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHoverData(null)}
                  >
                    {isSelected && (
                      <polygon points={hexPoints(x, y, HEX_SIZE + 4)} fill="none" stroke={colors.stroke} strokeWidth="3" opacity="0.4" strokeLinejoin="round">
                        <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
                      </polygon>
                    )}
                    <polygon points={pts} fill={colors.fill} stroke={colors.stroke} strokeWidth={isSelected ? 3 : 2} strokeLinejoin="round" />
                    <text x={x} y={y - 5} textAnchor="middle" dominantBaseline="central" fontSize="14">
                      {nodeEmoji[node.type] || "💡"}
                    </text>
                    <text x={x} y={y + 12} textAnchor="middle" fontSize="7.5" fill="#73400b" fontWeight={isSelected ? "900" : "bold"} opacity="0.9">
                      {node.label.length > 5 ? node.label.slice(0, 5) + "…" : node.label}
                    </text>
                  </g>
                );
              }

              // Empty cell
              return (
                <g key={`empty-${idx}`}>
                  <polygon points={pts} fill="#ffffff" stroke="#fef08a" strokeWidth="1" opacity="0.6" strokeLinejoin="round" />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hover Tooltip Bubble */}
        {hoverData && (
          <div
            className="fixed pointer-events-none z-50 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-honey-200 text-sm max-w-xs transition-opacity animate-pop-in"
            style={{ left: hoverData.x + 15, top: hoverData.y + 15 }}
          >
            {hoverData.type === "node" && (() => {
              const node = hoverData.data as KnowledgeNode;
              return (
                <>
                  <div className="font-extrabold text-honey-900 mb-1.5 flex items-center gap-1.5">
                    <span>{nodeEmoji[node.type] || "💡"}</span>
                    <span className="line-clamp-1">{node.label}</span>
                  </div>
                  <div className="text-xs text-bee-dark/80 line-clamp-5 leading-relaxed">
                    {node.content}
                  </div>
                  <div className="text-[10px] text-honey-600/60 mt-2 font-bold flex gap-2">
                    <span>权值: {node.weight.toFixed(1)}</span>
                    <span>轮次: {node.round}</span>
                  </div>
                </>
              );
            })()}
            {hoverData.type === "bee" && (() => {
              const bee = hoverData.data as BeeAgent;
              return (
                <>
                  <div className="font-extrabold text-honey-900 mb-1.5 flex items-center gap-1.5">
                    <span>🐝</span>
                    <span>{bee.name}</span>
                    <span className="text-[10px] bg-honey-100 text-honey-700 px-1.5 py-0.5 rounded-full ml-auto">{statusLabel[bee.status]}</span>
                  </div>
                  <div className="text-xs text-bee-dark/80 line-clamp-3 leading-relaxed">
                    任务: {bee.task.query}
                  </div>
                  {bee.findings.length > 0 && (
                    <div className="text-[10px] text-honey-600/60 mt-2 font-bold">
                      已发现 {bee.findings.length} 条情报
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Selected source detail */}
        <AnimatePresence>
          {selectedSource && (
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute bottom-0 left-0 right-0 p-4 z-20"
            >
              <div className="bg-white/90 backdrop-blur-xl p-5 rounded-2xl shadow-[0_-8px_30px_rgba(253,176,34,0.15)] border border-honey-200 max-h-[300px] flex flex-col">
                <div className="flex items-center gap-3 mb-2 flex-shrink-0">
                  <span className="text-2xl drop-shadow-sm">🌻</span>
                  <span className="font-extrabold text-honey-900 text-lg">{selectedSource}</span>
                  <span className="cute-tag shadow-sm ml-2 bg-[#eff6ff] border-[#38bdf8] text-[#38bdf8]">
                    花田情报
                  </span>
                  <span className="ml-auto bg-honey-50 text-honey-600 px-2 py-1 rounded-lg text-xs font-bold border border-honey-100">
                    共 {sourceStats.find(s => s[0] === selectedSource)?.[1].count || 0} 滴花蜜
                  </span>
                  <button onClick={() => setSelectedSource(null)} className="w-8 h-8 rounded-full bg-honey-100 text-honey-600 hover:bg-honey-200 flex items-center justify-center transition-colors">✕</button>
                </div>
                <div className="overflow-y-auto pr-2 space-y-2 flex-1 mt-2">
                  {sourceStats.find(s => s[0] === selectedSource)?.[1].findings.map(f => (
                    <div key={f.id} className="bg-honey-50/50 p-3 rounded-xl border border-honey-100">
                      <div className="text-sm font-bold text-honey-900 mb-1">{f.title}</div>
                      <div className="text-xs text-honey-800/70 mb-2">{f.summary}</div>
                      <div className="flex flex-wrap gap-1">
                        {f.tags.map(tag => (
                          <span key={tag} className="text-[10px] bg-white border border-honey-200 text-honey-600 px-1.5 py-0.5 rounded-md">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Bee / Source list */}
      <div className="w-[260px] flex-shrink-0 border-l border-honey-100 flex flex-col bg-white rounded-r-[20px] shadow-[-4px_0_24px_rgba(253,176,34,0.03)] z-10">
        <div className="flex border-b border-honey-100 flex-shrink-0 bg-honey-50/50">
          <button
            onClick={() => setSidebarTab("bees")}
            className={`flex-1 py-3 text-sm font-extrabold flex items-center justify-center gap-1 transition-colors ${
              sidebarTab === "bees" ? "text-honey-800 bg-white border-b-2 border-honey-400" : "text-honey-800/40 hover:bg-honey-50"
            }`}
          >
            <span>🐝</span> 蜜蜂 ({bees.length})
          </button>
          <button
            onClick={() => setSidebarTab("sources")}
            className={`flex-1 py-3 text-sm font-extrabold flex items-center justify-center gap-1 transition-colors ${
              sidebarTab === "sources" ? "text-honey-800 bg-white border-b-2 border-honey-400" : "text-honey-800/40 hover:bg-honey-50"
            }`}
          >
            <span>🌻</span> 花田 ({sourceStats.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-honey-50/20">
          {sidebarTab === "bees" && bees.map((bee) => (
            <div
              key={bee.id}
              className="flex items-center gap-3 p-2.5 rounded-xl border border-honey-100 bg-white hover:bg-honey-50 hover:border-honey-200 transition-colors shadow-sm group"
            >
              <div className="relative">
                <BeeIcon status={bee.status} size={20} animate={false} />
                <span className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${statusDotColor[bee.status]}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-bee-dark text-xs truncate group-hover:text-honey-600 transition-colors">{bee.name}</div>
                <div className="text-bee-dark/40 truncate text-[10px] font-medium">{bee.task.query.slice(0, 20)}</div>
              </div>
              <div className="flex flex-col items-end justify-center">
                <span className="text-[10px] text-honey-600/70 font-bold bg-honey-50 px-1.5 py-0.5 rounded-md">
                  {statusLabel[bee.status]}
                </span>
                {bee.findings.length > 0 && (
                  <span className="text-honey-500 font-bold text-[10px] mt-1 flex items-center gap-0.5">
                    🍯 {bee.findings.length}
                  </span>
                )}
              </div>
            </div>
          ))}
          {sidebarTab === "bees" && bees.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-honey-800/30 text-xs p-6 gap-2">
              <span className="text-4xl grayscale opacity-50">💤</span>
              <span className="font-bold">等待派遣...</span>
            </div>
          )}

          {sidebarTab === "sources" && sourceStats.map(([sourceName, stat]) => (
            <div
              key={sourceName}
              onClick={() => {
                setSelectedSource(selectedSource === sourceName ? null : sourceName);
                setSelectedNode(null);
              }}
              className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors shadow-sm cursor-pointer group ${
                selectedSource === sourceName 
                  ? "bg-honey-100 border-honey-400" 
                  : "bg-white border-honey-100 hover:bg-honey-50 hover:border-honey-200"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-honey-100 flex items-center justify-center text-sm flex-shrink-0 group-hover:scale-110 transition-transform">
                🌻
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-bee-dark text-xs truncate group-hover:text-honey-600 transition-colors">
                  {sourceName}
                </div>
                <div className="text-honey-600/70 text-[10px] font-bold mt-0.5 flex items-center gap-1">
                  <span>🍯 产出了 {stat.count} 滴花蜜</span>
                </div>
              </div>
            </div>
          ))}
          {sidebarTab === "sources" && sourceStats.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-honey-800/30 text-xs p-6 gap-2">
              <span className="text-4xl grayscale opacity-50">🌱</span>
              <span className="font-bold">还未从任何花田采到蜜...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
