"use client";

import { motion, AnimatePresence } from "framer-motion";
import BeeIcon from "./BeeIcon";
import type { BeeAgent, KnowledgeGraph } from "@/types";

interface SwarmVisualizerProps {
  bees: BeeAgent[];
  graph: KnowledgeGraph;
}

/* ---------- Layout helpers ---------- */

function beePositionStyle(bee: BeeAgent, idx: number, total: number) {
  // Bees orbit around the hive in a circle
  const angle = (idx / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
  const radius = bee.status === "resting" || bee.status === "idle" ? 28 : 42;
  const cx = 50 + Math.cos(angle) * radius;
  const cy = 50 + Math.sin(angle) * radius;
  return { left: `${cx}%`, top: `${cy}%` };
}

function nodePositionStyle(idx: number, total: number) {
  if (total <= 1) return { left: "50%", top: "50%" };
  // Spiral-ish layout within the hive
  const ring = Math.floor(idx / 6);
  const posInRing = idx % 6;
  const angle = (posInRing / 6) * Math.PI * 2 + ring * 0.5;
  const radius = 8 + ring * 12;
  const cx = 50 + Math.cos(angle) * radius;
  const cy = 50 + Math.sin(angle) * radius;
  return { left: `${Math.min(90, Math.max(10, cx))}%`, top: `${Math.min(90, Math.max(10, cy))}%` };
}

const statusLabel: Record<string, string> = {
  idle: "待命",
  searching: "🔍 搜索中",
  analyzing: "🧠 分析中",
  returning: "🍯 带蜜归巢",
  resting: "😴 休息",
  error: "❌ 出错",
  retired: "👋 退休",
};

const statusDotColor: Record<string, string> = {
  idle: "bg-gray-300",
  searching: "bg-amber-500 animate-pulse",
  analyzing: "bg-purple-400 animate-pulse",
  returning: "bg-green-400",
  resting: "bg-blue-300",
  error: "bg-red-400",
  retired: "bg-gray-400",
};

export default function SwarmVisualizer({ bees, graph }: SwarmVisualizerProps) {
  const activeBees = bees.filter((b) => b.status !== "retired");
  const retiredCount = bees.length - activeBees.length;

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Bee swarm animation area */}
      <div className="relative flex-1 min-h-[260px] rounded-2xl bg-gradient-to-b from-sky-blue/10 to-honey-100/50 border-2 border-honey-200 overflow-hidden">
        {/* Hive center */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
          <motion.div
            className="w-20 h-20 clip-hexagon bg-honey-300/60 flex items-center justify-center"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <span className="text-2xl">🏠</span>
          </motion.div>
          <div className="text-center text-xs text-bee-dark/60 mt-1 font-medium">蜂巢</div>
        </div>

        {/* Knowledge graph nodes overlaid on hive */}
        <AnimatePresence>
          {graph.nodes.slice(-12).map((node, idx) => {
            const pos = nodePositionStyle(idx, Math.min(graph.nodes.length, 12));
            return (
              <motion.div
                key={node.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={pos}
              >
                <div
                  className="clip-hexagon flex items-center justify-center text-[9px] font-medium text-bee-dark px-1 leading-tight"
                  style={{
                    width: 44,
                    height: 48,
                    background: node.type === "concept" ? "#ffe485" : node.type === "entity" ? "#ffd54f" : node.type === "fact" ? "#a8d85e" : node.type === "source" ? "#87ceeb" : "#ffb6c1",
                  }}
                  title={node.label}
                >
                  {node.label.slice(0, 6)}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Bees */}
        <AnimatePresence>
          {activeBees.map((bee, idx) => {
            const pos = beePositionStyle(bee, idx, activeBees.length);
            return (
              <motion.div
                key={bee.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  left: pos.left,
                  top: pos.top,
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", damping: 12 }}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              >
                <BeeIcon status={bee.status} size={30} />
                <span className="text-[10px] font-bold text-bee-dark mt-0.5 bg-white/80 px-1 rounded">
                  {bee.name}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Stats overlay */}
        <div className="absolute top-2 left-2 flex gap-2 text-[10px] text-bee-dark/70">
          <span>🐝 {activeBees.length} 只出动</span>
          {retiredCount > 0 && <span>| 👋 {retiredCount} 已退休</span>}
          <span>| 🏠 {graph.nodes.length} 节点</span>
        </div>
      </div>

      {/* Bee status list */}
      <div className="space-y-1 max-h-[160px] overflow-y-auto">
        {bees.map((bee) => (
          <motion.div
            key={bee.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/80 border border-honey-200 text-xs"
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotColor[bee.status]}`} />
            <span className="font-bold text-bee-dark w-8">🐝 {bee.name}</span>
            <span className="text-bee-dark/60 flex-1 truncate">{bee.task.query}</span>
            <span className="text-bee-dark/50 text-[10px]">{statusLabel[bee.status]}</span>
            {bee.findings.length > 0 && (
              <span className="text-honey-600 font-medium">🍯×{bee.findings.length}</span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
