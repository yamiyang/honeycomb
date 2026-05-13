import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🐝 HoneyComb 蜜探 — 你的专属蜂群智能探索工具",
  description: "让小蜜蜂为你采蜜",
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
