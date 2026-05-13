"use client";

import { motion } from "framer-motion";
import type { Research } from "@/types";

interface ResearchCardProps {
  research: Research;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

const statusConfig: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  idle: { label: "待命", emoji: "💤", color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" },
  planning: { label: "规划中", emoji: "🧠", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
  searching: { label: "搜索中", emoji: "🔍", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  analyzing: { label: "分析中", emoji: "📊", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  expanding: { label: "深化中", emoji: "🔄", color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200" },
  reporting: { label: "出报告", emoji: "📝", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
  completed: { label: "已完成", emoji: "✨", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  paused: { label: "已暂停", emoji: "⏸️", color: "text-gray-500", bg: "bg-gray-100", border: "border-gray-200" },
  error: { label: "出错", emoji: "💥", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
};

export default function ResearchCard({ research, onClick, onDelete }: ResearchCardProps) {
  const status = statusConfig[research.status] || statusConfig.idle;
  const findingsCount = research.bees.reduce((acc, b) => acc + b.findings.length, 0);
  const level = Math.min(99, research.bees.length + research.graph.nodes.length + findingsCount);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={onClick}
      className="relative cute-card p-5 cursor-pointer group flex flex-col justify-between h-full"
    >
      {/* Delete */}
      <button
        onClick={onDelete}
        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-100 text-red-500 
          opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center
          hover:bg-red-500 hover:text-white hover:scale-110 shadow-sm z-10"
      >
        ✕
      </button>

      {/* Level */}
      <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-gradient-to-br from-honey-300 to-honey-400 text-bee-dark 
        flex items-center justify-center text-sm font-bold shadow-sm border-2 border-white z-10 transform rotate-[-10deg] group-hover:rotate-0 transition-transform">
        {level}
      </div>

      <div>
        {/* Title */}
        <div className="flex items-start gap-3 mt-1">
          <span className="text-2xl flex-shrink-0 animate-bee-float drop-shadow-sm">🍯</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-bee-dark pr-2 line-clamp-1">{research.title}</h3>
            <p className="text-xs text-bee-dark/60 line-clamp-2 mt-1 leading-relaxed">{research.objective}</p>
          </div>
        </div>

        {/* Status */}
        <div className="mt-4 flex items-center gap-2">
          <span className={`cute-tag ${status.bg} ${status.border} ${status.color} flex items-center gap-1.5 shadow-sm`}>
            <span>{status.emoji}</span> <span>{status.label}</span>
          </span>
        </div>
      </div>

      <div>
        {/* Stats */}
        <div className="mt-4 flex items-center gap-3 text-xs text-bee-dark/60 font-medium">
          {research.bees.length > 0 && <span className="flex items-center gap-1">🐝 <span className="bg-honey-100 px-1.5 rounded-md">{research.bees.length}</span></span>}
          {findingsCount > 0 && <span className="flex items-center gap-1">✨ <span className="bg-honey-100 px-1.5 rounded-md">{findingsCount}</span></span>}
          {research.graph.nodes.length > 0 && <span className="flex items-center gap-1">⬡ <span className="bg-honey-100 px-1.5 rounded-md">{research.graph.nodes.length}</span></span>}
          <span className="ml-auto text-[10px] text-bee-dark/40 bg-gray-50 px-2 py-0.5 rounded-full">
            {new Date(research.updatedAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
          </span>
        </div>

        {/* XP bar */}
        <div className="mt-3 h-2 rounded-full bg-honey-50 overflow-hidden border border-honey-100 shadow-inner">
          <motion.div
            className="h-full bg-gradient-to-r from-honey-300 to-honey-500 rounded-full relative"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, level)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
