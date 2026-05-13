"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useResearchStore } from "@/store/research-store";
import ResearchCard from "@/components/ResearchCard";
import NewResearchModal from "@/components/NewResearchModal";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const { researches, createResearch, deleteResearch, setActiveResearch, initFlowerField } = useResearchStore();
  const [showNewModal, setShowNewModal] = useState(false);

  // 初始化花田信息源系统
  useEffect(() => {
    initFlowerField();
  }, [initFlowerField]);

  function handleCreate(title: string, objective: string) {
    const id = createResearch(title, objective);
    setShowNewModal(false);
    setActiveResearch(id);
    router.push(`/research/${id}`);
  }

  function handleOpen(id: string) {
    setActiveResearch(id);
    router.push(`/research/${id}`);
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (confirm("确定删除这个研究吗？")) {
      deleteResearch(id);
    }
  }

  return (
    <div className="min-h-screen bg-honey-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b-2 border-honey-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="text-3xl"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              🐝
            </motion.div>
            <div>
              <h1 className="font-bold text-xl text-bee-dark tracking-tight">Argus</h1>
              <p className="text-[11px] text-bee-dark/40 -mt-0.5">AI 蜂群搜索引擎 · Powered by Hermes</p>
            </div>
          </div>

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-honey-500 text-white text-sm font-medium
              hover:bg-honey-600 transition-all shadow-md shadow-honey-500/20 active:scale-95"
          >
            <span className="text-base">+</span>
            新建研究
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {researches.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-4"
          >
            <motion.div
              className="text-7xl"
              animate={{
                y: [0, -10, 0],
                rotate: [0, 5, -5, 0],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              🐝
            </motion.div>
            <h2 className="text-xl font-bold text-bee-dark">欢迎来到 Argus</h2>
            <p className="text-sm text-bee-dark/50 text-center max-w-md leading-relaxed">
              派出你的 AI 蜂群，通过真实信息源（Google、Twitter、GitHub、arXiv...）<br />
              采集情报、构建知识图谱、生成深度研究报告。
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-4 flex items-center gap-2 px-6 py-3 rounded-2xl bg-honey-500 text-white font-medium
                hover:bg-honey-600 transition-all shadow-lg shadow-honey-500/20 active:scale-95"
            >
              🍯 开始第一个研究
            </button>

            {/* Decorative hexagons */}
            <div className="flex gap-2 mt-8 opacity-20">
              {[40, 55, 40, 55, 40].map((size, i) => (
                <motion.div
                  key={i}
                  className="clip-hexagon bg-honey-300"
                  style={{ width: size, height: size * 1.15 }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                />
              ))}
            </div>
          </motion.div>
        ) : (
          /* Research list */
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-bee-dark">
                我的研究 <span className="text-honey-500 font-normal text-sm ml-1">({researches.length})</span>
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {researches.map((r) => (
                  <ResearchCard
                    key={r.id}
                    research={r}
                    onClick={() => handleOpen(r.id)}
                    onDelete={(e) => handleDelete(e, r.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>

      <NewResearchModal open={showNewModal} onClose={() => setShowNewModal(false)} onCreate={handleCreate} />
    </div>
  );
}
