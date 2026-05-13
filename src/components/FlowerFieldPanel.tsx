"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useResearchStore } from "@/store/research-store";
import type { FlowerSource, SourceType } from "@/types";

export default function FlowerFieldPanel() {
  const sources = useResearchStore((s) => s.flowerSources);
  const toggleSource = useResearchStore((s) => s.toggleFlowerSource);
  const updateSource = useResearchStore((s) => s.updateFlowerSource);
  const initFlowerField = useResearchStore((s) => s.initFlowerField);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempConfig, setTempConfig] = useState<Record<string, string>>({});

  // 从后端 API 加载信息源
  useEffect(() => {
    initFlowerField();
  }, [initFlowerField]);

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
          💡 arXiv、Hacker News、Reddit、Wikipedia、StackOverflow、DuckDuckGo、Searx、RSS 无需 API Key 即可采蜜
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
              {source.config.apiKey || source.config.bearerToken || source.config.cookie ? "✓ 已配置 · 修改" : "⚙️ 配置认证"}
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
                    {field.multiline ? (
                      <textarea
                        placeholder={field.placeholder}
                        value={tempConfig[field.key] || (source.config as Record<string, string>)[field.key] || ""}
                        onChange={(e) => onConfigChange(field.key, e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-honey-200 bg-white focus:outline-none focus:border-honey-400 shadow-sm transition-colors resize-none font-mono text-[11px]"
                      />
                    ) : (
                      <input
                        type={field.type || "text"}
                        placeholder={field.placeholder}
                        value={tempConfig[field.key] || (source.config as Record<string, string>)[field.key] || ""}
                        onChange={(e) => onConfigChange(field.key, e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-honey-200 bg-white focus:outline-none focus:border-honey-400 shadow-sm transition-colors"
                      />
                    )}
                    {field.applyUrl && (
                      <a
                        href={field.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-500 hover:text-blue-600 mt-1 inline-flex items-center gap-0.5 ml-1"
                      >
                        🔗 {field.applyLabel || "申请 Key"}
                      </a>
                    )}
                    {field.helpText && (
                      <p className="text-[10px] text-bee-dark/40 mt-1 ml-1">{field.helpText}</p>
                    )}
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
  return ["google", "twitter", "scholar", "youtube", "github", "web", "stackoverflow", "rss"].includes(type);
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
  multiline?: boolean;
  applyUrl?: string;
  applyLabel?: string;
  helpText?: string;
}

function getConfigFields(type: SourceType): ConfigField[] {
  switch (type) {
    case "google":
      return [{
        key: "apiKey",
        label: "Serper API Key",
        placeholder: "输入 Serper API Key...",
        type: "password",
        applyUrl: "https://serper.dev/",
        applyLabel: "去 serper.dev 免费申请",
        helpText: "免费额度 2500 次/月",
      }];
    case "twitter":
      return [{
        key: "cookie",
        label: "Twitter/X Cookie",
        placeholder: "从浏览器复制完整 Cookie...",
        multiline: true,
        helpText: "登录 x.com → F12 → Network → 任意请求 → 复制 Cookie 头的值（需包含 ct0 和 auth_token）",
      }];
    case "github":
      return [{
        key: "apiKey",
        label: "GitHub Personal Access Token（可选，提高速率限制）",
        placeholder: "ghp_...",
        type: "password",
        applyUrl: "https://github.com/settings/tokens/new",
        applyLabel: "去 GitHub 生成 Token",
        helpText: "不配置也能用，但有 60次/小时 的限制",
      }];
    case "scholar":
      return [{
        key: "apiKey",
        label: "SerpAPI Key",
        placeholder: "输入 SerpAPI Key...",
        type: "password",
        applyUrl: "https://serpapi.com/manage-api-key",
        applyLabel: "去 serpapi.com 免费申请",
        helpText: "免费额度 100 次/月，不配置则使用 CrossRef 替代",
      }];
    case "youtube":
      return [{
        key: "apiKey",
        label: "YouTube Data API v3 Key",
        placeholder: "输入 API Key...",
        type: "password",
        applyUrl: "https://console.cloud.google.com/apis/credentials",
        applyLabel: "去 Google Cloud Console 申请",
        helpText: "需开启 YouTube Data API v3，免费额度 10000 单位/天",
      }];
    case "stackoverflow":
      return [{
        key: "apiKey",
        label: "StackExchange API Key（可选，提高速率限制）",
        placeholder: "输入 API Key...",
        type: "password",
        applyUrl: "https://stackapps.com/apps/oauth/register",
        applyLabel: "去 StackApps 免费注册",
        helpText: "不配置也能用（300次/天），配置后 10000次/天",
      }];
    case "web":
      return [{
        key: "apiKey",
        label: "Jina API Key（可选，增强爬取能力）",
        placeholder: "jina_...",
        type: "password",
        applyUrl: "https://jina.ai/reader/",
        applyLabel: "去 jina.ai 免费申请",
        helpText: "不配置则使用 DuckDuckGo 免费搜索",
      }];
    case "rss":
      return [{
        key: "feeds",
        label: "RSS 订阅地址（可选，逗号分隔）",
        placeholder: "https://example.com/feed.xml, https://blog.example.com/rss",
        multiline: true,
        helpText: "不配置则使用默认源（HN、Ars Technica、The Verge、GitHub Blog 等）",
      }];
    default:
      return [];
  }
}
