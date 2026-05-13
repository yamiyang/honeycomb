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
    <div className="min-h-screen bg-honey-50 relative overflow-hidden font-sans">
      {/* Background decoration */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-honey-200/40 rounded-full blur-3xl pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-honey-300/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header Bar */}
      <header className="sticky top-0 z-30 cute-header">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-bee-float">🐝</span>
            <div>
              <h1 className="font-extrabold text-xl text-honey-600 tracking-tight">
                BEESEARCH
              </h1>
              <p className="text-[11px] text-honey-600/60 font-medium">
                AI Swarm Search Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 text-sm font-bold text-honey-700 bg-honey-100/50 px-4 py-1.5 rounded-full border border-honey-200">
            <span className="flex items-center gap-1.5"><span className="text-lg">🍯</span> {researches.length}</span>
            <div className="w-px h-4 bg-honey-300"></div>
            <span className="flex items-center gap-1.5"><span className="text-lg">🐝</span> {researches.reduce((a, r) => a + r.bees.length, 0)}</span>
          </div>

          <button
            onClick={() => setShowNewModal(true)}
            className="cute-btn flex items-center gap-2 px-6 py-2.5 bg-gradient-to-b from-honey-400 to-honey-500 text-white text-sm shadow-md"
          >
            ＋ 新建研究
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-10 relative z-10">
        {researches.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-8"
          >
            <div className="relative">
              <span className="text-8xl animate-bee-float drop-shadow-xl inline-block">🐝</span>
              <motion.div 
                className="absolute -top-4 -right-4 text-3xl"
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ✨
              </motion.div>
            </div>

            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-bee-dark mb-3">
                欢迎来到 BEESEARCH
              </h2>
              <p className="text-base text-bee-dark/60 font-medium bg-white/50 px-6 py-1.5 rounded-full inline-block backdrop-blur-sm">
                AI 蜂群情报搜索引擎
              </p>
            </div>

            <div className="cute-card p-8 text-base text-bee-dark/70 text-center leading-loose max-w-md bg-white/80 backdrop-blur-sm">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 justify-center"><span className="text-2xl">🍯</span> 派出 AI 蜜蜂军团采集情报</div>
                <div className="flex items-center gap-3 justify-center"><span className="text-2xl">⬡</span> 构建蜂巢知识图谱</div>
                <div className="flex items-center gap-3 justify-center"><span className="text-2xl">📜</span> 生成深度研究报告</div>
              </div>
            </div>

            <button
              onClick={() => setShowNewModal(true)}
              className="cute-btn px-10 py-4 bg-gradient-to-b from-honey-400 to-honey-500 text-white text-lg shadow-lg hover:shadow-xl mt-4"
            >
              🚀 开启首次研究
            </button>
          </motion.div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-extrabold text-bee-dark flex items-center gap-3">
                📦 我的研究任务
                <span className="cute-tag border-honey-200 text-honey-600 bg-honey-100 text-sm px-3 shadow-sm">
                  {researches.length}
                </span>
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
