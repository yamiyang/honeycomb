# 🐝 Argus — 蜂群智能研究平台

> **Swarm Intelligence Research Platform**
> 启发式扩散情报搜索与行业调研工具

<div align="center">

🐝 小蜜蜂 = SubAgent（情报采集员）<br/>
🍯 蜂蜜 = 采集到的情报<br/>
🏠 蜂巢 = 知识图谱（力导向可视化）<br/>
👑 蜂后 = MainAgent（AI 自主调度员）<br/>
🌻 花田 = 互联网信息源

</div>

---

## ✨ 功能特性

- **📋 研究管理** — 创建、查看、管理多个研究项目
- **🐝 蜂群调度** — 蜂后（AI）自主派发多个蜜蜂分头搜索
- **🧠 启发式搜索** — AI 自主规划搜索方向、自主判断深度、自主决定何时停止
- **🏠 知识图谱** — 力导向 Canvas 可视化，实时展示知识积累和关系网络
- **🐝 蜂群可视化** — 看蜜蜂一点点采蜜（拿回情报）的动态过程
- **📄 HTML 报告** — 自动生成完整 HTML 网页研究报告，支持下载和新窗口查看
- **💬 实时对话** — 与蜂后对话查看研究进展
- **💰 预算控制** — 通过最大搜索次数（默认 100 次）控制资源消耗

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────┐
│                 Argus UI                     │
│  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Chat Panel │  │   Content Panel      │  │
│  │   (Left)     │  │   ┌─ 🐝 Swarm Viz   │  │
│  │              │  │   ├─ 🏠 Graph View   │  │
│  │   👑 Queen   │  │   └─ 📄 Report View │  │
│  │   🐝 Bees    │  │                      │  │
│  │   👤 User    │  │                      │  │
│  └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────┤
│            Swarm Research Engine              │
│   Queen → plan → dispatch Bees → search     │
│   → analyze → update Knowledge Graph        │
│   → AI decides next action → loop / stop    │
├─────────────────────────────────────────────┤
│           Hermes Agent System                │
│   AI-powered research orchestration          │
│   Heuristic search with autonomous control  │
├─────────────────────────────────────────────┤
│          Flower Field (信息源)               │
│   arXiv · HackerNews · Reddit · GitHub ...  │
└─────────────────────────────────────────────┘
```

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 打开浏览器访问
open http://localhost:3000
```

## 📁 项目结构

```
src/
├── app/                     # Next.js App Router
│   ├── page.tsx             # 首页（研究列表）
│   ├── layout.tsx           # 根布局
│   ├── globals.css          # 全局样式（蜂巢主题）
│   ├── api/hermes/          # Hermes AI 代理 API
│   └── research/[id]/       # 研究详情页
│       └── page.tsx
├── components/              # UI 组件
│   ├── BeeIcon.tsx          # 🐝 蜜蜂 SVG 图标
│   ├── HexagonNode.tsx      # 六边形蜂巢节点
│   ├── SwarmVisualizer.tsx  # 蜂群可视化面板
│   ├── ChatPanel.tsx        # 聊天对话面板
│   ├── ContentPanel.tsx     # 右侧内容面板（报告/图谱）
│   ├── FlowerFieldPanel.tsx # 花田信息源管理
│   ├── ResearchCard.tsx     # 研究卡片
│   └── NewResearchModal.tsx # 新建研究弹窗
├── store/                   # 状态管理
│   └── research-store.ts   # Zustand 全局状态
├── engine/                  # 研究引擎
│   ├── swarm.ts            # 蜂群研究引擎（启发式搜索）
│   ├── hermes.ts           # Hermes AI Agent 核心
│   └── flowers/            # 花田信息源适配层
└── types/                   # TypeScript 类型
    └── index.ts
```

## 🧠 启发式搜索机制

Argus 的核心设计是 **AI 自主启发式搜索**：

1. **AI 规划** — 蜂后分析研究目标，自主规划初始搜索方向
2. **蜂群执行** — 蜜蜂并行搜索多个信息源
3. **情报分析** — AI 分析搜索结果，提炼关键洞察
4. **知识图谱** — 每轮搜索后更新知识图谱
5. **AI 自主决策** — 基于已有情报和知识图谱，AI 自主决定：
   - 🟢 **继续搜索** — 发现了新方向或知识空白
   - 🔴 **停止搜索** — 判断已充分覆盖目标
6. **预算兜底** — `maxSearches`（默认 100 次）作为唯一硬约束

> 没有硬编码的轮次限制。AI 决定何时已经"够了"。

## 🎨 设计主题

- **主色**: 蜂蜜金 `#FFC107`
- **风格**: 黄色可爱风，简洁 UI
- **图形**: 六边形蜂巢 + 力导向知识图谱
- **动画**: 蜜蜂飞行、脉冲光晕、弹性过渡

---

<div align="center">
  <b>🐝 Powered by Argus — Making Research as Natural as Bees Collecting Honey</b>
</div>
