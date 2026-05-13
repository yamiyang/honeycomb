"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { marked } from "marked";
import type { ChatMessage } from "@/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onStop?: () => void;
  isProcessing: boolean;
}

const roleConfig = {
  user: { emoji: "🧑‍💻", label: "研究员", bubbleClass: "bg-honey-100 text-bee-dark rounded-[20px] rounded-br-sm shadow-sm border border-honey-200 ml-auto" },
  queen: { emoji: "👑", label: "蜂后", bubbleClass: "bg-honey-50 text-bee-dark rounded-[20px] rounded-tl-sm shadow-sm border border-honey-100" },
  bee: { emoji: "🐝", label: "蜜蜂", bubbleClass: "bg-honey-50 text-bee-dark rounded-[20px] rounded-tl-sm shadow-sm border border-honey-100" },
  system: { emoji: "⚙️", label: "系统", bubbleClass: "bg-gray-50/80 text-bee-dark/70 rounded-[16px] border border-gray-100/50 text-xs shadow-sm" },
};

export default function ChatPanel({ messages, onSend, onStop, isProcessing }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleSubmit() {
    const text = input.trim();
    if (!text || isProcessing) return;
    onSend(text);
    setInput("");
    inputRef.current?.focus();
    if (inputRef.current) inputRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex flex-col h-full font-sans bg-honey-50/30">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-bee-dark/40 gap-4">
            <span className="text-6xl animate-bee-float opacity-40 grayscale drop-shadow-sm">🐝</span>
            <div className="bg-white/80 backdrop-blur-sm p-5 rounded-3xl border border-honey-100 shadow-sm text-center">
              <p className="text-sm leading-relaxed font-bold text-bee-dark/60">
                输入研究目标<br />
                蜂群将为你采集情报
              </p>
            </div>
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
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white shadow-sm border border-honey-100 flex items-center justify-center text-lg z-10 relative">
                  {config.emoji}
                </div>

                {/* Bubble */}
                <div className={`max-w-[80%] ${isUser ? "text-right" : ""}`}>
                  {!isUser && (
                    <div className="text-[11px] text-bee-dark/40 mb-1 px-2 font-bold flex items-center gap-1">
                      {msg.beeName ? <><span className="text-honey-500">🐝</span> {msg.beeName}</> : config.label}
                    </div>
                  )}
                  <div 
                    className={`${config.bubbleClass} px-4 py-3 text-[14px] leading-relaxed relative markdown-body`}
                    dangerouslySetInnerHTML={{ __html: marked.parse(msg.content, { async: false }) as string }}
                  />
                  <div className="text-[10px] text-bee-dark/30 mt-1.5 px-2 font-medium">
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white shadow-sm border border-honey-100 flex items-center justify-center text-lg z-10">
              👑
            </div>
            <div className="bg-white rounded-[20px] rounded-tl-sm shadow-sm border border-honey-100 px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-honey-400"
                    animate={{ y: [0, -4, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
              <span className="text-xs text-bee-dark/40 font-bold ml-1">蜂群工作中...</span>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-honey-100 shadow-[0_-4px_24px_rgba(0,0,0,0.02)] z-20">
        <div className="flex gap-3 items-end bg-honey-50/50 p-2 rounded-3xl border border-honey-100 transition-colors focus-within:border-honey-300 focus-within:bg-white">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isProcessing ? "蜂群工作中，请稍候..." : "输入你想研究的问题..."}
            disabled={isProcessing}
            rows={1}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-bee-dark
              placeholder:text-bee-dark/30 focus:outline-none disabled:opacity-50"
            style={{ minHeight: 40, maxHeight: 120 }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          {isProcessing && onStop ? (
            <button
              onClick={onStop}
              className="cute-btn flex-shrink-0 w-10 h-10 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center shadow-sm"
              title="停止研究"
            >
              <span className="text-lg">■</span>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isProcessing}
              className="cute-btn flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-honey-400 to-honey-500 text-white flex items-center justify-center shadow-md
                disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            >
              <svg className="w-4 h-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
