"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface NewResearchModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, objective: string) => void;
}

const PRESETS = [
  { title: "AI Agent 行业调研", objective: "深入研究 AI Agent 行业的市场规模、技术趋势、竞争格局和投资机会", emoji: "🤖" },
  { title: "新能源汽车供应链", objective: "分析新能源汽车供应链的关键环节、核心企业和技术瓶颈", emoji: "🚗" },
  { title: "AIGC 商业化路径", objective: "调研 AIGC 在各行业的商业化落地案例、盈利模式和市场前景", emoji: "🎨" },
];

export default function NewResearchModal({ open, onClose, onCreate }: NewResearchModalProps) {
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");

  function handleCreate() {
    if (!title.trim() || !objective.trim()) return;
    onCreate(title.trim(), objective.trim());
    setTitle("");
    setObjective("");
  }

  function handlePreset(preset: (typeof PRESETS)[0]) {
    setTitle(preset.title);
    setObjective(preset.objective);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-bee-dark/40" />

          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg cute-card p-0 overflow-hidden"
          >
            {/* Header */}
            <div className="cute-header px-6 py-4 flex items-center gap-4">
              <span className="text-3xl animate-bee-float">📋</span>
              <div>
                <h2 className="font-extrabold text-lg text-honey-600">
                  新建研究任务
                </h2>
                <p className="text-xs text-honey-700/60 font-medium">
                  派出蜂群为你采集情报
                </p>
              </div>
              <button
                onClick={onClose}
                className="ml-auto w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center font-bold hover:bg-red-500 hover:text-white transition-all shadow-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-6 bg-gradient-to-b from-honey-50 to-white">
              {/* Presets */}
              <div className="mb-5">
                <label className="text-xs text-bee-dark/60 mb-2 block font-bold">
                  ⚡ 快速任务
                </label>
                <div className="flex gap-2 flex-wrap">
                  {PRESETS.map((p) => (
                    <button
                      key={p.title}
                      onClick={() => handlePreset(p)}
                      className="cute-btn px-3 py-1.5 bg-white text-xs text-bee-dark border-2 border-honey-100 hover:border-honey-300 hover:bg-honey-50 flex items-center gap-1.5 shadow-sm"
                    >
                      <span>{p.emoji}</span> {p.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div className="mb-4">
                <label className="text-xs text-bee-dark/60 mb-1.5 block font-bold">
                  📜 研究标题
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="如：AI Agent 行业调研"
                  className="w-full px-4 py-3 rounded-2xl border-2 border-honey-100 bg-white text-sm focus:outline-none focus:border-honey-400 focus:bg-honey-50/30 transition-colors shadow-sm"
                />
              </div>

              {/* Objective */}
              <div className="mb-6">
                <label className="text-xs text-bee-dark/60 mb-1.5 block font-bold">
                  🎯 研究目标
                </label>
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="详细描述你想研究的方向和关注点..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-honey-100 bg-white text-sm focus:outline-none focus:border-honey-400 focus:bg-honey-50/30 resize-none transition-colors shadow-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={onClose}
                  className="cute-btn px-6 py-2.5 bg-gray-100 text-sm text-bee-dark/60 hover:bg-gray-200 font-bold"
                >
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!title.trim() || !objective.trim()}
                  className="cute-btn px-6 py-2.5 bg-gradient-to-r from-honey-400 to-honey-500 text-white text-sm font-bold shadow-md
                    disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                >
                  🐝 开始研究！
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
