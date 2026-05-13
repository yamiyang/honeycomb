import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🐝 BeeHive — 蜂群智能研究平台",
  description: "Swarm Intelligence Research Platform - 启发式扩散情报搜索与行业调研工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
