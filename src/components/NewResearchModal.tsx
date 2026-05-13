"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface NewResearchModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, objective: string) => void;
}

const PRESETS = [
  { title: "AI Agent 行业调研", objective: "深入研究 AI Agent 行业的市场规模、技术趋势、竞争格局和投资机会" },
  { title: "新能源汽车供应链", objective: "分析新能源汽车供应链的关键环节、核心企业和技术瓶颈" },
  { title: "AIGC 商业化路径", objective: "调研 AIGC 在各行业的商业化落地案例、盈利模式和市场前景" },
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-bee-dark/20 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl shadow-honey-500/10 border-2 border-honey-200"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-honey-100 flex items-center justify-center text-xl">🐝</div>
              <div>
                <h2 className="font-bold text-lg text-bee-dark">新建研究</h2>
                <p className="text-xs text-bee-dark/50">派出蜂群为你采集情报</p>
              </div>
              <button onClick={onClose} className="ml-auto text-bee-dark/30 hover:text-bee-dark/60 text-xl">
                ✕
              </button>
            </div>

            {/* Quick presets */}
            <div className="mb-4">
              <label className="text-xs text-bee-dark/50 mb-1.5 block">💡 快速开始</label>
              <div className="flex gap-2 flex-wrap">
                {PRESETS.map((p) => (
                  <button
                    key={p.title}
                    onClick={() => handlePreset(p)}
                    className="px-3 py-1.5 rounded-full bg-honey-100 text-xs text-bee-dark/70 hover:bg-honey-200 transition-colors border border-honey-200"
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Title input */}
            <div className="mb-3">
              <label className="text-xs text-bee-dark/50 mb-1 block">研究标题</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="如：AI Agent 行业调研"
                className="w-full px-4 py-2.5 rounded-xl border-2 border-honey-200 bg-honey-50/50
                  text-sm focus:outline-none focus:border-honey-400 transition-colors"
              />
            </div>

            {/* Objective input */}
            <div className="mb-5">
              <label className="text-xs text-bee-dark/50 mb-1 block">研究目标</label>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="详细描述你想研究的方向和关注点..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-honey-200 bg-honey-50/50
                  text-sm focus:outline-none focus:border-honey-400 resize-none transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm text-bee-dark/60 hover:bg-honey-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!title.trim() || !objective.trim()}
                className="px-5 py-2.5 rounded-xl bg-honey-500 text-white text-sm font-medium
                  hover:bg-honey-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed
                  shadow-md shadow-honey-500/20 active:scale-95"
              >
                🐝 开始研究
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
