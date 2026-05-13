"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useResearchStore } from "@/store/research-store";
import type { FlowerSource, SourceType } from "@/types";

/**
 * 🌸 花田面板 — 信息源管理
 * 
 * 用户在这里：
 * - 查看所有可用信息源（花朵）
 * - 激活/停用信息源
 * - 配置 API Key 等认证信息
 * - 查看信息源状态和使用情况
 */
export default function FlowerFieldPanel() {
  const sources = useResearchStore((s) => s.flowerSources);
  const toggleSource = useResearchStore((s) => s.toggleFlowerSource);
  const updateSource = useResearchStore((s) => s.updateFlowerSource);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempConfig, setTempConfig] = useState<Record<string, string>>({});

  const activeCount = sources.filter(s => s.status === "active").length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-honey-200 bg-white/60">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🌸</span>
          <h2 className="text-lg font-bold text-bee-dark">花田 · 信息源管理</h2>
        </div>
        <p className="text-xs text-bee-dark/50">
          配置你的信息采集花田。激活的信息源将被蜜蜂用于搜索情报。
          已激活 <span className="font-bold text-honey-600">{activeCount}</span> / {sources.length} 个信息源
        </p>
      </div>

      {/* Source List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sources.map((source) => (
          <FlowerCard
            key={source.id}
            source={source}
            isEditing={editingId === source.id}
            tempConfig={editingId === source.id ? tempConfig : {}}
            onToggle={() => toggleSource(source.id)}
            onEdit={() => {
              if (editingId === source.id) {
                // 保存
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

      {/* Footer tip */}
      <div className="p-3 border-t border-honey-200 bg-honey-50/50">
        <p className="text-[10px] text-bee-dark/40 text-center">
          💡 部分信息源（如 arXiv、Hacker News、Reddit）无需 API Key 即可使用
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
      className={`rounded-xl border-2 p-3 transition-colors ${
        isActive
          ? "border-green-300 bg-green-50/30"
          : "border-gray-200 bg-white/50"
      }`}
    >
      {/* Top row */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">{source.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-bee-dark">{source.name}</span>
            {isActive && (
              <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-green-100 text-green-700 font-medium">
                已激活
              </span>
            )}
            {source.status === "error" && (
              <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-red-100 text-red-700 font-medium">
                错误
              </span>
            )}
            {source.status === "rate_limited" && (
              <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-orange-100 text-orange-700 font-medium">
                限流
              </span>
            )}
          </div>
          <p className="text-[11px] text-bee-dark/50 truncate">{source.description}</p>
        </div>

        {/* Toggle */}
        <button
          onClick={onToggle}
          className={`w-10 h-5 rounded-full relative transition-colors ${
            isActive ? "bg-green-400" : "bg-gray-300"
          }`}
        >
          <motion.div
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
            animate={{ left: isActive ? 20 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {/* Capabilities */}
      <div className="flex gap-1 mt-2 flex-wrap">
        {source.capabilities.map(cap => (
          <span key={cap} className="px-1.5 py-0.5 text-[9px] rounded bg-honey-100 text-honey-700">
            {capabilityLabel(cap)}
          </span>
        ))}
      </div>

      {/* Config button / form */}
      {needsKey && (
        <div className="mt-2">
          {!isEditing ? (
            <button
              onClick={onEdit}
              className="text-[11px] text-honey-600 hover:text-honey-800 underline"
            >
              {source.config.apiKey || source.config.bearerToken ? "✓ 已配置 · 修改" : "⚙️ 配置 API Key"}
            </button>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2 mt-2"
              >
                {getConfigFields(source.type).map(field => (
                  <div key={field.key}>
                    <label className="text-[10px] text-bee-dark/60 block mb-0.5">{field.label}</label>
                    <input
                      type={field.type || "text"}
                      placeholder={field.placeholder}
                      value={tempConfig[field.key] || (source.config as Record<string, string>)[field.key] || ""}
                      onChange={(e) => onConfigChange(field.key, e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-honey-200 rounded-lg focus:outline-none focus:border-honey-400 bg-white"
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <button
                    onClick={onEdit}
                    className="px-3 py-1 text-[11px] bg-honey-500 text-white rounded-lg hover:bg-honey-600"
                  >
                    保存
                  </button>
                  <button
                    onClick={onCancel}
                    className="px-3 py-1 text-[11px] text-bee-dark/50 hover:text-bee-dark"
                  >
                    取消
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Last used */}
      {source.lastUsed && (
        <p className="text-[9px] text-bee-dark/30 mt-1">
          上次使用: {new Date(source.lastUsed).toLocaleString("zh-CN")}
        </p>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function requiresApiKey(type: SourceType): boolean {
  return ["google", "twitter", "scholar", "youtube"].includes(type);
}

function capabilityLabel(cap: string): string {
  const labels: Record<string, string> = {
    search: "搜索",
    trending: "趋势",
    realtime: "实时",
    historical: "历史",
    user_profile: "用户",
    comments: "讨论",
    code: "代码",
    papers: "论文",
    media: "多媒体",
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
      return [
        { key: "apiKey", label: "Serper API Key (serper.dev)", placeholder: "输入 API Key...", type: "password" },
      ];
    case "twitter":
      return [
        { key: "bearerToken", label: "Twitter Bearer Token", placeholder: "输入 Bearer Token...", type: "password" },
      ];
    case "github":
      return [
        { key: "apiKey", label: "GitHub Token (可选, 提高限流)", placeholder: "ghp_...", type: "password" },
      ];
    case "scholar":
      return [
        { key: "apiKey", label: "SerpAPI Key (serpapi.com)", placeholder: "输入 API Key...", type: "password" },
      ];
    case "youtube":
      return [
        { key: "apiKey", label: "YouTube Data API Key", placeholder: "输入 API Key...", type: "password" },
      ];
    case "web":
      return [
        { key: "apiKey", label: "Jina API Key (可选)", placeholder: "jina_...", type: "password" },
      ];
    default:
      return [];
  }
}
