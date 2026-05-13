"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useResearchStore } from "@/store/research-store";
import type { FlowerSource, SourceType } from "@/types";

export default function FlowerFieldPanel() {
  const sources = useResearchStore((s) => s.flowerSources);
  const toggleSource = useResearchStore((s) => s.toggleFlowerSource);
  const updateSource = useResearchStore((s) => s.updateFlowerSource);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempConfig, setTempConfig] = useState<Record<string, string>>({});

  const activeCount = sources.filter(s => s.status === "active").length;

  return (
    <div className="h-full flex flex-col font-sans">
      {/* Header */}
      <div className="cute-header px-6 py-4 flex items-center justify-between shadow-sm z-10 relative">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl drop-shadow-sm animate-bee-float">🌸</span>
          <div>
            <h2 className="text-lg font-extrabold text-honey-700">
              花田 · 信息源管理
            </h2>
            <p className="text-xs text-honey-600/70 font-medium">
              激活 <span className="text-honey-500 font-bold bg-honey-100 px-1.5 rounded-md">{activeCount}</span>/{sources.length} 个信息源 | 蜜蜂将采集已激活的花田
            </p>
          </div>
        </div>
      </div>

      {/* Source List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-honey-50/50">
        {sources.map((source) => (
          <FlowerCard
            key={source.id}
            source={source}
            isEditing={editingId === source.id}
            tempConfig={editingId === source.id ? tempConfig : {}}
            onToggle={() => toggleSource(source.id)}
            onEdit={() => {
              if (editingId === source.id) {
                updateSource(source.id, { config: { ...source.config, ...tempConfig } });
                setEditingId(null);
                setTempConfig({});
              } else {
                setEditingId(source.id);
                setTempConfig({});
              }
            }}
            onConfigChange={(key, value) => {
              setTempConfig(prev => ({ ...prev, [key]: value }));
            }}
            onCancel={() => {
              setEditingId(null);
              setTempConfig({});
            }}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-honey-100 bg-white">
        <p className="text-[11px] text-honey-800/40 text-center font-bold">
          💡 arXiv、Hacker News、Reddit 无需 API Key 即可采蜜
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────

interface FlowerCardProps {
  source: FlowerSource;
  isEditing: boolean;
  tempConfig: Record<string, string>;
  onToggle: () => void;
  onEdit: () => void;
  onConfigChange: (key: string, value: string) => void;
  onCancel: () => void;
}

function FlowerCard({ source, isEditing, tempConfig, onToggle, onEdit, onConfigChange, onCancel }: FlowerCardProps) {
  const isActive = source.status === "active";
  const needsKey = requiresApiKey(source.type);

  return (
    <motion.div
      layout
      className={`cute-card p-4 transition-all relative ${
        isActive
          ? "border-green-300 shadow-[0_4px_16px_rgba(74,222,128,0.1)]"
          : "border-gray-200 opacity-80"
      }`}
    >
      <div className="flex items-center gap-4">
        <span className="text-3xl drop-shadow-sm">{source.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-extrabold text-[15px] text-bee-dark">{source.name}</span>
            {isActive && (
              <span className="cute-tag bg-green-50 border-green-200 text-green-600">
                ✓ 激活
              </span>
            )}
            {source.status === "error" && (
              <span className="cute-tag bg-red-50 border-red-200 text-red-600">
                💥 错误
              </span>
            )}
            {source.status === "rate_limited" && (
              <span className="cute-tag bg-orange-50 border-orange-200 text-orange-600">
                ⏳ 限流
              </span>
            )}
          </div>
          <p className="text-xs text-bee-dark/50 truncate font-medium">{source.description}</p>
        </div>

        {/* Custom iOS-like Switch */}
        <button
          onClick={onToggle}
          className={`w-12 h-6 rounded-full relative transition-colors shadow-inner flex-shrink-0 ${
            isActive ? "bg-green-400" : "bg-gray-200"
          }`}
        >
          <motion.div
            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm"
            animate={{ left: isActive ? 26 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      <div className="flex gap-1.5 mt-3 flex-wrap">
        {source.capabilities.map(cap => (
          <span key={cap} className="cute-tag text-[10px] bg-honey-50 text-honey-600 border border-honey-100">
            {capabilityLabel(cap)}
          </span>
        ))}
      </div>

      {needsKey && (
        <div className="mt-4 pt-3 border-t border-honey-100/50">
          {!isEditing ? (
            <button
              onClick={onEdit}
              className="text-xs text-honey-600 hover:text-honey-500 font-bold flex items-center gap-1 bg-honey-50 px-3 py-1.5 rounded-full transition-colors"
            >
              {source.config.apiKey || source.config.bearerToken ? "✓ 已配置 · 修改" : "⚙️ 配置 API Key"}
            </button>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 mt-2"
              >
                {getConfigFields(source.type).map(field => (
                  <div key={field.key}>
                    <label className="text-xs text-bee-dark/60 block mb-1.5 font-bold ml-1">
                      {field.label}
                    </label>
                    <input
                      type={field.type || "text"}
                      placeholder={field.placeholder}
                      value={tempConfig[field.key] || (source.config as Record<string, string>)[field.key] || ""}
                      onChange={(e) => onConfigChange(field.key, e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-honey-200 bg-white focus:outline-none focus:border-honey-400 shadow-sm transition-colors"
                    />
                  </div>
                ))}
                <div className="flex gap-2 justify-end mt-3">
                  <button onClick={onCancel} className="cute-btn px-4 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-bee-dark/60 font-bold">
                    取消
                  </button>
                  <button onClick={onEdit} className="cute-btn px-4 py-1.5 text-xs bg-honey-400 hover:bg-honey-500 text-white font-bold shadow-sm">
                    保存
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      )}

      {source.lastUsed && (
        <p className="text-[10px] text-bee-dark/30 mt-3 font-medium text-right">
          上次采集: {new Date(source.lastUsed).toLocaleString("zh-CN")}
        </p>
      )}
    </motion.div>
  );
}

// ─── Helpers ───

function requiresApiKey(type: SourceType): boolean {
  return ["google", "twitter", "scholar", "youtube"].includes(type);
}

function capabilityLabel(cap: string): string {
  const labels: Record<string, string> = {
    search: "🔍搜索",
    trending: "📈趋势",
    realtime: "⚡实时",
    historical: "📚历史",
    user_profile: "👤用户",
    comments: "💬讨论",
    code: "💻代码",
    papers: "📄论文",
    media: "🎬媒体",
  };
  return labels[cap] || cap;
}

interface ConfigField {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
}

function getConfigFields(type: SourceType): ConfigField[] {
  switch (type) {
    case "google":
      return [{ key: "apiKey", label: "Serper API Key (serper.dev)", placeholder: "输入 API Key...", type: "password" }];
    case "twitter":
      return [{ key: "bearerToken", label: "Twitter Bearer Token", placeholder: "输入 Bearer Token...", type: "password" }];
    case "github":
      return [{ key: "apiKey", label: "GitHub Token (可选)", placeholder: "ghp_...", type: "password" }];
    case "scholar":
      return [{ key: "apiKey", label: "SerpAPI Key (serpapi.com)", placeholder: "输入 API Key...", type: "password" }];
    case "youtube":
      return [{ key: "apiKey", label: "YouTube Data API Key", placeholder: "输入 API Key...", type: "password" }];
    case "web":
      return [{ key: "apiKey", label: "Jina API Key (可选)", placeholder: "jina_...", type: "password" }];
    default:
      return [];
  }
}
