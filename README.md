# Minimal Coding Agent (Teaching Edition)

一个极简、开源、模块化的桌面编码代理，专为 AI Agent 开发教学场景设计。它剥离商业编码代理的冗余功能，保留核心的 **ReAct 循环、工具调用、进程通信与安全边界**，让你通过阅读、运行、修改代码，理解编码代理的底层工作机制。

## 当前状态

MVP 开发中（v0.1）：

- ✅ 代理核心（`agent-core`）：ReAct 循环、`read_file` 工具、路径沙箱、Deepseek LLM 适配器（含流式 SSE 解析）
- ⏳ 待实现：`write_file` + 写入审批、`glob_files`/`search_code`、会话持久化（SQLite + JSONL）、Electron 桌面端

## 技术栈

| 层 | 技术 |
|----|------|
| 前端（规划中） | React 18 + TypeScript + Tailwind CSS |
| 桌面（规划中） | Electron 30 + electron-vite |
| 代理核心 | Node.js 20 + TypeScript |
| 持久化（规划中） | better-sqlite3 + JSONL |
| LLM | Deepseek API（`deepseek-v4-pro`），Fetch + SSE 流式 |
| 构建 / 测试 | pnpm workspace + TypeScript + Vitest |

## 项目结构

```
minimal-coding-agent/
├── packages/
│   ├── shared-types/   # 全局类型契约（接口定义）
│   ├── agent-core/     # ReAct 循环、工具集、沙箱、LLM 适配器
│   ├── storage/        # （规划中）SQLite + JSONL 持久化
│   └── desktop/        # （规划中）Electron 主进程 + React 渲染进程
├── agent_docs/         # 开发文档（brief / tech_stack / testing / code_patterns）
├── docs/               # PRD 与技术设计
├── AGENTS.md           # AI 编码助手项目指令
└── MEMORY.md           # 项目进度与决策记录
```

## 快速开始

要求：Node.js ≥ 20，pnpm。

```bash
# 安装依赖
pnpm install

# 类型检查
pnpm typecheck

# 运行单元测试
pnpm test
```

## 配置 Deepseek API Key

在项目根目录创建 `.env` 文件（已加入 `.gitignore`，**不要提交到仓库**）：

```
DEEPSEEK_API_KEY=sk-你的密钥
```

密钥获取：<https://platform.deepseek.com/>

配置后即可运行一次真实代理（流式输出）：

```bash
pnpm smoke <工作目录> deepseek-v4-pro "读取某个文件的内容"
```

## 安全设计

- 所有文件工具路径经过沙箱校验（`realpath` + 工作区前缀检查），拦截 `..` 目录遍历与符号链接越权
- 敏感文件（`.env`、`.pem`、`id_rsa` 等）读取自动拦截
- 文件写入需用户逐次确认（`write_file` 审批流程，规划中）

## 文档

- 产品需求：`docs/PRD-Minimal-Coding-Agent-MVP.md`
- 技术设计：`docs/technical-Minimal-Coding-Agent-MVP.md`
- 开发约定：`agent_docs/`
