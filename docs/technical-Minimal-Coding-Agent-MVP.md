# Technical Design Document: Minimal Coding Agent (Teaching Edition) MVP

**Version:** 1.0 **Status:** Final **Last Updated:** 2026-10-19 **Corresponding PRD:** PRD-Minimal-Coding-Agent-MVP.md

------

## 1. Technical Architecture Overview

### 1.1 Overall Layered Architecture

采用**四层单向依赖架构**，严格遵循教学友好的单一职责原则，每层只依赖下层，不反向依赖：

```
┌─────────────────────────────────┐
│   Desktop UI Layer (Render)     │  React + Tailwind，聊天界面、工具卡片、设置面板
├─────────────────────────────────┤
│   Electron Main Process         │  窗口管理、IPC调度、安全弹窗、原生API调用
├─────────────────────────────────┤
│   Agent Core (Child Process)    │  ReAct循环、LLM交互、工具调度、沙箱校验
├─────────────────────────────────┤
│   Storage Layer                 │  SQLite元数据 + JSONL消息持久化
├─────────────────────────────────┤
│   Shared Types                  │  全局类型定义、常量、接口契约
└─────────────────────────────────┘
```

**核心设计决策（教学价值点）：**

- Agent 核心运行在**独立 Node.js 子进程**，通过标准输入输出（JSONL 帧）与主进程通信，直观演示进程间通信原理
- UI 与代理逻辑完全隔离，代理崩溃不影响主界面，符合生产级编码代理的进程模型
- 所有跨层交互通过标准化接口契约，便于学习者单独拆解、修改每一层

### 1.2 Monorepo Package Structure

使用 pnpm workspace 管理，包依赖方向严格单向：`shared-types → agent-core → storage → desktop`，禁止循环依赖。

```
minimal-coding-agent/
├── packages/
│   ├── shared-types/      # P0 - 共享类型定义、常量、接口
│   ├── agent-core/        # P0 - ReAct代理核心、工具集、沙箱、LLM适配器
│   ├── storage/           # P0 - SQLite封装、JSONL读写、会话仓储
│   └── desktop/           # P0 - Electron主进程 + React渲染进程
├── docs/
│   └── PRD-Minimal-Coding-Agent-MVP.md
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### 1.3 Core Technology Stack

| Layer    | Technology                           | Purpose              |
| -------- | ------------------------------------ | -------------------- |
| 前端渲染 | React 18 + TypeScript + Tailwind CSS | 聊天界面构建         |
| 桌面框架 | Electron 30 + electron-vite          | 桌面应用打包与热重载 |
| 代理核心 | Node.js 20 + TypeScript              | ReAct循环与工具执行  |
| 持久化   | better-sqlite3 + JSONL 文件          | 混合存储方案         |
| LLM对接  | Fetch API + SSE解析                  | Deepseek API流式调用 |
| 构建工具 | Vite + tsup                          | 前端与库构建         |
| 包管理   | pnpm 9 + workspace                   | monorepo依赖管理     |

------

## 2. Module Detailed Design

### 2.1 Package: shared-types

**职责：** 全局唯一的类型定义源，所有模块共享同一套接口契约，避免类型重复定义。 **教学知识点：** 接口契约设计、跨模块类型复用、消息协议定义。

**文件结构：**

```
shared-types/
├── src/
│   ├── index.ts          # 统一导出
│   ├── message.ts        # 消息类型定义
│   ├── tool.ts           # 工具调用类型
│   ├── session.ts        # 会话元数据类型
│   ├── config.ts         # 配置类型
│   └── ipc.ts            # IPC通信事件类型
└── package.json
```

**核心类型定义：**

```
// message.ts
export type MessageRole = 'user' | 'assistant' | 'tool' | 'system';

export interface BaseMessage {
  id: string;
  role: MessageRole;
  timestamp: number;
}

export interface TextMessage extends BaseMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCallMessage extends BaseMessage {
  role: 'assistant';
  toolCalls: ToolCall[];
}

export interface ToolResultMessage extends BaseMessage {
  role: 'tool';
  toolCallId: string;
  toolName: string;
  content: string;
  isError: boolean;
}

// tool.ts
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  content: string;
  error?: string;
}
```

### 2.2 Package: agent-core

**职责：** 编码代理的核心大脑，实现完整 ReAct 循环、LLM 交互、工具调度、沙箱安全校验。独立于 Electron，可单独运行、测试。 **教学知识点：** ReAct 循环原理、工具调用调度、提示工程、沙箱安全机制、流式响应处理。

**文件结构：**

```
agent-core/
├── src/
│   ├── index.ts                # 入口，子进程stdio通信监听
│   ├── agent/
│   │   ├── AgentLoop.ts        # 核心ReAct循环
│   │   └── PromptManager.ts    # 系统提示与消息构建
│   ├── llm/
│   │   ├── LLMAdapter.ts       # LLM适配器接口
│   │   └── DeepseekAdapter.ts  # Deepseek具体实现
│   ├── tools/
│   │   ├── ToolExecutor.ts     # 工具调度器
│   │   ├── ToolSandbox.ts      # 沙箱校验器
│   │   └── implementations/
│   │       ├── readFile.ts
│   │       ├── writeFile.ts
│   │       ├── globFiles.ts
│   │       └── searchCode.ts
│   └── types.ts                # 内部类型
└── package.json
```

#### 2.2.1 Core: AgentLoop (ReAct 循环)

**核心状态机：** `思考 → 工具调用 → 执行 → 观察 → 再思考` 闭环 **输入：** 用户消息、历史消息上下文 **输出：** 流式文本片段、工具调用请求、最终回复

**执行步骤：**

1. 接收用户消息，追加到上下文
2. 调用 LLM，传入系统提示 + 历史消息
3. 流式接收 LLM 响应，同时解析文本与工具调用
4. 若存在工具调用：
   - 逐个执行工具（先经沙箱校验）
   - 工具结果追加到上下文
   - 回到步骤2，继续推理
5. 若无工具调用，输出最终回复，循环结束

**关键设计：**

- 支持**可中断**：每次工具调用前检查终止信号
- 错误闭环：工具执行错误格式化后返回 LLM，让模型尝试修正
- Token 计数：每轮累计 token 用量，触发预算阈值时暂停自动工具调用

#### 2.2.2 Tool Sandbox (沙箱校验器)

所有文件工具执行前必须通过沙箱校验，是安全体系的核心。 **校验流程：**

1. 接收目标路径参数
2. 拼接工作区根目录，得到绝对路径
3. 调用 `fs.realpathSync` 解析真实物理路径（拦截符号链接越权）
4. 校验真实路径是否以工作区根目录开头
5. 校验文件扩展名是否在敏感黑名单中（读取操作）
6. 校验通过返回真实路径，否则抛出安全异常

**敏感文件黑名单：**

```
.env, .env.*, .pem, .key, .crt, .p12, id_rsa, id_rsa.*, .credentials
```

#### 2.2.3 工具实现规范

每个工具实现统一接口：

```
interface Tool {
  definition: ToolDefinition;
  execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
```

**4 个核心工具参数定义：**

| 工具名        | 参数                               | 说明                         |
| ------------- | ---------------------------------- | ---------------------------- |
| `read_file`   | `path: string`                     | 读取指定路径文件内容         |
| `write_file`  | `path: string`, `content: string`  | 写入内容到指定路径（需审批） |
| `glob_files`  | `pattern: string`                  | 按通配符查找匹配文件         |
| `search_code` | `pattern: string`, `path?: string` | 正则搜索文件内容             |

### 2.3 Package: storage

**职责：** 统一持久化层，封装 SQLite 与 JSONL 两种存储介质，提供会话、配置的读写接口。 **教学知识点：** 混合持久化设计、事件溯源（JSONL）、关系型存储、仓储模式。

**文件结构：**

```
storage/
├── src/
│   ├── index.ts
│   ├── SessionRepository.ts   # 会话元数据CRUD（SQLite）
│   ├── MessageStore.ts        # 消息JSONL读写
│   ├── ConfigStore.ts         # 配置存储（SQLite）
│   └── db/
│       └── init.sql           # 数据库初始化脚本
└── package.json
```

**设计原则：**

- **JSONL 存消息**：追加写入，不可篡改，天然事件溯源，适合演示会话历史回放
- **SQLite 存元数据**：会话列表、配置项，支持索引查询、排序
- 上层调用只依赖仓储接口，不感知底层存储介质

### 2.4 Package: desktop

**职责：** 桌面应用载体，包含 Electron 主进程与 React 渲染进程，负责窗口管理、用户交互、IPC 通信、安全弹窗。 **教学知识点：** Electron 进程模型、IPC 通信、桌面端安全、流式 UI 渲染。

**文件结构：**

```
desktop/
├── src/
│   ├── main/                 # Electron 主进程
│   │   ├── index.ts          # 主入口，窗口创建
│   │   ├── ipc/
│   │   │   ├── session.ts    # 会话相关IPC处理
│   │   │   ├── agent.ts      # 代理子进程管理
│   │   │   └── dialog.ts     # 确认弹窗、目录选择
│   │   └── security/
│   │       └── safeStorage.ts # API密钥加密存储
│   └── renderer/             # React 渲染进程
│       ├── App.tsx
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── ChatArea.tsx
│       │   ├── MessageBubble.tsx
│       │   ├── ToolCallCard.tsx
│       │   └── SettingsPanel.tsx
│       └── hooks/
│           ├── useAgent.ts   # 代理通信Hook
│           └── useSession.ts # 会话管理Hook
└── package.json
```

#### 2.4.1 进程间通信模型

```
渲染进程 ←─IPC─→ 主进程 ←─stdio JSONL─→ 代理子进程
```

- **渲染 → 主：** 发送用户消息、配置变更、确认写入操作
- **主 → 渲染：** 推送流式文本、工具调用事件、会话列表、错误提示
- **主 → 代理子进程：** 通过 stdin 写入 JSONL 帧（用户输入、配置、审批结果）
- **代理子进程 → 主：** 通过 stdout 输出 JSONL 帧（文本流、工具调用、状态变更）

#### 2.4.2 写入确认机制

1. 代理子进程发起 write_file 请求，输出到 stdout
2. 主进程接收请求，暂停代理循环
3. 主进程通过 IPC 通知渲染进程弹出确认弹窗，展示文件路径与内容预览
4. 用户点击「批准/拒绝」，结果通过 IPC 返回主进程
5. 主进程将审批结果通过 stdin 发回代理子进程
6. 代理子进程根据结果执行写入或终止，继续 ReAct 循环

------

## 3. Core Business Flow Sequence

### 3.1 ReAct Agent Loop Sequence

```
用户 → 渲染进程 → 主进程 → 代理子进程 → LLM API
  │        │          │            │
  ├────────┤          │            │
  │ 发送消息│          │            │
  │        ├──────────┤            │
  │        │  转发消息│            │
  │        │          ├────────────┤
  │        │          │  调用LLM   │
  │        │          │  ←─────────┤
  │        │          │ 流式返回   │
  │        │←──────────┤ 文本片段   │
  │        │  逐字渲染 │            │
  │        │          │            │
  │        │          │ 解析工具调用│
  │        │          │ 沙箱校验   │
  │        │←──────────┤ 工具调用事件│
  │        │展示工具卡片│            │
  │        │          │ 执行工具   │
  │        │          │ 获取结果   │
  │        │          ├────────────┤
  │        │          │ 结果喂回LLM│
  │        │          │  ←─────────┤
  │        │          │ 继续推理   │
  │        │←──────────┤ 最终回复   │
  └────────┘          └────────────┘
```

### 3.2 File Write Approval Flow

1. 代理输出 `tool_call` 帧，类型为 `write_file`
2. 主进程拦截写入请求，挂起代理循环
3. 主进程触发 `write-confirm` IPC 事件到渲染端
4. 渲染端弹出模态框，展示：目标路径、内容预览、「覆盖警告」（如文件已存在）
5. 用户点击「批准」或「拒绝」
6. 审批结果回传代理进程
7. 批准则执行写入并返回成功结果；拒绝则返回拒绝原因
8. 结果喂回 LLM，继续循环

------

## 4. Data Model & Storage Design

### 4.1 Core Data Structures

**Session（会话元数据）**

| 字段          | 类型   | 说明                     |
| ------------- | ------ | ------------------------ |
| id            | string | 会话唯一ID               |
| title         | string | 会话标题（首条消息截取） |
| workspacePath | string | 工作目录绝对路径         |
| createdAt     | number | 创建时间戳               |
| updatedAt     | number | 最后更新时间             |
| tokenUsage    | number | 累计token用量            |

**Config（应用配置）**

| 字段        | 类型   | 说明                         |
| ----------- | ------ | ---------------------------- |
| apiKey      | string | Deepseek API密钥（加密存储） |
| model       | string | 模型名称，默认deepseek-chat  |
| tokenBudget | number | 每会话token预算，默认100000  |

### 4.2 SQLite Database Schema

```
-- sessions 表
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  workspace_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  token_usage INTEGER NOT NULL DEFAULT 0
);

-- config 表（单例）
CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  api_key TEXT,
  model TEXT NOT NULL DEFAULT 'deepseek-chat',
  token_budget INTEGER NOT NULL DEFAULT 100000
);
```

### 4.3 JSONL Message Storage Format

每个会话对应一个 `{sessionId}.jsonl` 文件，存放在应用数据目录的 `messages/` 下。 每行一条 JSON 消息，按时间顺序追加写入：

```
{"id":"msg_1","role":"user","content":"读取src目录下的文件","timestamp":1730000000000}
{"id":"msg_2","role":"assistant","toolCalls":[{"id":"call_1","name":"glob_files","arguments":{"pattern":"src/**/*"}}],"timestamp":1730000001000}
{"id":"msg_3","role":"tool","toolCallId":"call_1","toolName":"glob_files","content":"src/index.ts\nsrc/types.ts","isError":false,"timestamp":1730000002000}
```

------

## 5. Interface Definition

### 5.1 IPC Event Contract (Main ↔ Renderer)

| 事件名                 | 方向          | 参数                  | 说明         |
| ---------------------- | ------------- | --------------------- | ------------ |
| `session:list`         | Render → Main | -                     | 获取会话列表 |
| `session:create`       | Render → Main | workspacePath         | 创建新会话   |
| `session:load`         | Render → Main | sessionId             | 加载历史消息 |
| `agent:send`           | Render → Main | sessionId, content    | 发送用户消息 |
| `agent:stream`         | Main → Render | text                  | 流式文本片段 |
| `agent:tool-call`      | Main → Render | toolCall              | 工具调用通知 |
| `agent:tool-result`    | Main → Render | toolResult            | 工具执行结果 |
| `dialog:write-confirm` | Main → Render | path, content, exists | 请求写入确认 |
| `dialog:write-result`  | Render → Main | approved              | 用户审批结果 |

### 5.2 Process Communication Protocol (Main ↔ Agent Child)

通过 stdio 传输 JSONL 帧，每行一个 JSON 对象，`type` 字段区分帧类型：

```
// 输入帧（主 → 代理）
type InputFrame =
  | { type: 'init'; config: AgentConfig; workspace: string }
  | { type: 'user-message'; content: string }
  | { type: 'write-approval'; approved: boolean; reason?: string };

// 输出帧（代理 → 主）
type OutputFrame =
  | { type: 'text-delta'; delta: string }
  | { type: 'tool-call'; toolCall: ToolCall }
  | { type: 'tool-result'; toolResult: ToolResult }
  | { type: 'done' }
  | { type: 'error'; message: string };
```

### 5.3 LLM Adapter Interface

```
interface LLMAdapter {
  chat(
    messages: ChatMessage[],
    options: {
      stream?: boolean;
      tools?: ToolDefinition[];
    }
  ): AsyncIterable<LLMChunk>;
}

interface LLMChunk {
  textDelta?: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
}
```

------

## 6. Security Design Details

### 6.1 Workspace Sandbox Mechanism

**三层防护：**

1. **路径归一化校验**：所有路径解析真实物理路径后校验前缀，拦截 `..` 遍历与符号链接越权
2. **敏感文件黑名单**：读取操作自动拦截密钥、证书等敏感格式
3. **写入人工审批**：所有写入操作必须用户逐次确认，无批量放行选项

### 6.2 Path Validation Algorithm

```
function resolveSafePath(workspaceRoot: string, inputPath: string): string {
  // 拼接绝对路径
  const absolutePath = path.resolve(workspaceRoot, inputPath);
  // 解析真实物理路径（解析符号链接）
  const realPath = fs.realpathSync(absolutePath);
  // 校验前缀
  if (!realPath.startsWith(path.resolve(workspaceRoot))) {
    throw new SecurityError(`Access denied: path outside workspace`);
  }
  return realPath;
}
```

### 6.3 API Key Security

- **存储**：使用 Electron `safeStorage` API 加密存储，底层调用系统密钥链（Windows DPAPI / macOS Keychain）
- **使用**：仅内存中解密使用，不写入日志、不发送到除 LLM API 以外的任何地址
- **脱敏**：发送到 LLM 的文件内容自动匹配 `sk-`、`api_key=` 等模式，替换为 `***MASKED***`

### 6.4 Content Desensitization

在文件内容发送给 LLM 前执行正则扫描与替换：

- `sk-[a-zA-Z0-9]{20,}` → `***API_KEY***`
- `api[_-]?key\s*[=:]\s*\S+` → `api_key=***`
- `password\s*[=:]\s*\S+` → `password=***`

------

## 7. Build & Development Specifications

### 7.1 pnpm Workspace Configuration

```
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

### 7.2 Scripts

| 脚本             | 说明                             |
| ---------------- | -------------------------------- |
| `pnpm dev`       | 启动 Electron 开发模式（热重载） |
| `pnpm build`     | 构建所有包                       |
| `pnpm test`      | 运行所有单元测试                 |
| `pnpm typecheck` | 全局 TypeScript 类型检查         |

### 7.3 TypeScript Rules

- 严格模式：`strict: true`
- 禁止隐式 `any`：`noImplicitAny: true`
- 禁止未使用变量：`noUnusedLocals: true`
- 统一 ESModule 模块规范

------

## 8. Testing Strategy

### 8.1 Unit Testing

**核心覆盖模块：**

- `ToolSandbox`：路径遍历、符号链接越权、敏感文件拦截
- `AgentLoop`：单轮对话、多轮工具调用、错误反馈闭环
- `MessageStore`：JSONL 追加写入、读取、恢复
- 路径校验算法：各种边界用例

**测试框架：** Vitest

### 8.2 Integration Testing

- 端到端会话流程：发送消息 → 工具调用 → 结果返回
- 写入审批流程：代理发起写入 → 弹窗确认 → 执行/拒绝
- 会话持久化：创建会话 → 发送消息 → 重启 → 恢复历史

### 8.3 Security Test Cases

1. `../` 目录遍历读取 → 拦截
2. 符号链接指向系统目录 → 拦截
3. 读取 `.env` 文件 → 拦截
4. 写入工作区外路径 → 拦截
5. API 密钥内容脱敏 → 验证替换生效

------

## 9. Development Timeline (2 Weeks)

| Week       | Phase              | Milestone                                                    |
| ---------- | ------------------ | ------------------------------------------------------------ |
| **Week 1** | 基础架构与核心模块 | 1. monorepo搭建、shared-types完成 2. storage包实现 3. agent-core核心：LLM适配器、ReAct循环、4个工具、沙箱 4. 核心单元测试通过 |
| **Week 2** | 桌面端集成与联调   | 1. Electron主进程与IPC通信 2. React聊天界面、工具卡片、设置面板 3. 写入确认弹窗与安全闭环 4. 端到端联调、bug修复 5. 文档完善、构建验证 |

------

## 10. Teaching Annotations Convention

代码中统一使用 `// TEACHING: ` 前缀标注教学知识点，例如：

```
// TEACHING: ReAct循环核心 - 思考(Thought)→行动(Action)→观察(Observation)
async function runAgentLoop() {
  // ...
}
```

每个核心模块入口处添加模块说明注释，包含：

- 模块职责
- 对应教学概念
- 依赖关系
- 可扩展点

------

技术设计已完成，完全对齐 PRD 所有 P0 需求，覆盖架构、模块、流程、数据、接口、安全、测试全维度，且全程贯彻教学友好的设计原则。