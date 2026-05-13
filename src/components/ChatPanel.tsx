"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "@/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onStop?: () => void;
  isProcessing: boolean;
}

const roleConfig = {
  user: { emoji: "👤", label: "你", bubbleClass: "chat-bubble-user ml-auto" },
  queen: { emoji: "👑", label: "蜂后", bubbleClass: "chat-bubble-agent" },
  bee: { emoji: "🐝", label: "蜜蜂", bubbleClass: "chat-bubble-agent" },
  system: { emoji: "⚙️", label: "系统", bubbleClass: "chat-bubble-agent opacity-70" },
};

export default function ChatPanel({ messages, onSend, onStop, isProcessing }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleSubmit() {
    const text = input.trim();
    if (!text || isProcessing) return;
    onSend(text);
    setInput("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-bee-dark/40 gap-3">
            <span className="text-5xl animate-bee-float">🐝</span>
            <p className="text-sm text-center leading-relaxed">
              输入研究目标<br />蜂群将为你采集情报
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const config = roleConfig[msg.role];
            const isUser = msg.role === "user";

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-honey-100 flex items-center justify-center text-sm border border-honey-200">
                  {config.emoji}
                </div>

                {/* Bubble */}
                <div className={`max-w-[85%] ${isUser ? "text-right" : ""}`}>
                  {!isUser && (
                    <div className="text-[10px] text-bee-dark/50 mb-0.5 px-1">
                      {msg.beeName ? `🐝 ${msg.beeName}` : config.label}
                    </div>
                  )}
                  <div className={`${config.bubbleClass} px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap`}>
                    {msg.content}
                  </div>
                  <div className="text-[9px] text-bee-dark/30 mt-0.5 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing indicator */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 px-2"
          >
            <span className="text-sm">👑</span>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-honey-400"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
            <span className="text-xs text-bee-dark/40">蜂群工作中...</span>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t-2 border-honey-200 bg-white/60 backdrop-blur-sm">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isProcessing ? "蜂群工作中，请稍候..." : "输入研究目标，如「AI Agent 行业调研」"}
            disabled={isProcessing}
            rows={1}
            className="flex-1 resize-none rounded-xl border-2 border-honey-200 bg-white px-3.5 py-2.5 text-sm
              placeholder:text-bee-dark/30 focus:outline-none focus:border-honey-400
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ minHeight: 42, maxHeight: 120 }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          {isProcessing && onStop ? (
            <button
              onClick={onStop}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600
                text-white flex items-center justify-center transition-all
                active:scale-95 shadow-md shadow-red-500/20"
              title="停止研究"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isProcessing}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-honey-500 hover:bg-honey-600
                text-white flex items-center justify-center transition-all
                disabled:opacity-30 disabled:cursor-not-allowed active:scale-95
                shadow-md shadow-honey-500/20"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
