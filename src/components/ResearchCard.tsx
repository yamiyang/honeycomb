"use client";

import { motion } from "framer-motion";
import type { Research } from "@/types";

interface ResearchCardProps {
  research: Research;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  idle: { label: "未开始", color: "text-bee-dark/40", bg: "bg-gray-100" },
  planning: { label: "🧠 规划中", color: "text-indigo-700", bg: "bg-indigo-50" },
  searching: { label: "🐝 搜索中", color: "text-amber-700", bg: "bg-amber-100" },
  analyzing: { label: "🔍 分析中", color: "text-blue-700", bg: "bg-blue-50" },
  expanding: { label: "🔄 深化中", color: "text-cyan-700", bg: "bg-cyan-50" },
  reporting: { label: "📝 出报告", color: "text-purple-700", bg: "bg-purple-50" },
  completed: { label: "✅ 已完成", color: "text-green-700", bg: "bg-green-50" },
  paused: { label: "⏸️ 已暂停", color: "text-gray-600", bg: "bg-gray-100" },
  error: { label: "❌ 出错", color: "text-red-700", bg: "bg-red-50" },
};

export default function ResearchCard({ research, onClick, onDelete }: ResearchCardProps) {
  const status = statusConfig[research.status] || statusConfig.idle;
  const findingsCount = research.bees.reduce((acc, b) => acc + b.findings.length, 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(255,193,7,0.15)" }}
      onClick={onClick}
      className="relative p-5 rounded-2xl bg-white border-2 border-honey-200 cursor-pointer
        transition-colors hover:border-honey-400 group"
    >
      {/* Delete button */}
      <button
        onClick={onDelete}
        className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-red-50 text-red-400 
          opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center
          hover:bg-red-100 text-sm"
      >
        ×
      </button>

      {/* Title */}
      <h3 className="font-bold text-base text-bee-dark pr-8 mb-1 line-clamp-1">{research.title}</h3>
      <p className="text-xs text-bee-dark/50 line-clamp-2 mb-3">{research.objective}</p>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs text-bee-dark/50">
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${status.color} ${status.bg}`}>
          {status.label}
        </span>
        {research.bees.length > 0 && <span>🐝 {research.bees.length}</span>}
        {findingsCount > 0 && <span>🍯 {findingsCount}</span>}
        {research.graph.nodes.length > 0 && <span>🏠 {research.graph.nodes.length}</span>}
        <span className="ml-auto">
          {new Date(research.updatedAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
        </span>
      </div>
    </motion.div>
  );
}
