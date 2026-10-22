# Product Requirements Document: Minimal Coding Agent (Teaching Edition) MVP

## Executive Summary

**Product:** Minimal Coding Agent (Teaching Edition) **Version:** MVP (1.0) **Document Status:** Draft **Last Updated:** 2026-10-16

### Product Vision

构建一个开源、极简、模块化的桌面编码代理，专为AI代理开发教学场景设计。剥离商业编码代理的冗余功能，保留最核心的ReAct循环、工具调用、进程通信与安全边界架构，让学习者可以通过阅读、运行、修改代码，透彻理解编码代理的底层工作机制。

### Success Criteria

- 核心ReAct代理循环完整可运行，支持流式响应与自主工具调用调度
- 4个核心文件工具（read_file、write_file、glob_files、search_code）功能正常且受沙箱约束
- 工作区安全机制生效，100%拦截目录越权与敏感文件访问
- 会话历史可持久化存储与加载，格式标准可观测
- 代码结构模块化、注释清晰，每个模块对应明确的教学概念

------

## Problem Statement

### Problem Definition

当前AI编码代理（Cursor、Claude Code、Aider等）已成为开发者主流工具，但绝大多数商业产品都是闭源黑盒，学习者和初级开发者无法理解其内部工作原理——包括ReAct循环如何运转、工具调用如何调度、进程间如何通信、安全边界如何设计。 同时，想要自建编码代理的开发者缺乏面向教学的架构参考，现有开源项目要么功能过度复杂，要么缺少模块化分层设计，难以作为入门学习范本。 对于计算机专业学生、初级AI开发者、希望理解Agent技术的软件工程师来说，缺少一个"最小可运行"的编码代理实现，用来学习核心概念、验证架构思路、开展二次开发实验。

### Impact Analysis

- **User Impact:** 让学习者可以从"最小可行"的代码出发，逐步理解编码代理的每一层架构，避免在复杂商业产品中迷失细节
- **Market Impact:** 填补教学型编码代理的空白，为AI Agent开发入门提供标准化的实践范本
- **Business Impact:** 无直接商业目标，定位为开源教学工具，可用于课程教学、技术分享、企业内部培训

------

## Target Audience

### Primary Persona: AI Agent Learner / Junior Developer

**Demographics:**

- 计算机相关专业学生、0-3年工作经验的后端/全栈开发者
- 具备基础JavaScript/TypeScript开发能力
- 对AI Agent概念有初步认知，希望深入底层原理

**Psychographics:**

- 信奉动手实践学习，倾向通过拆解代码理解技术
- 对黑盒工具抱有好奇心，喜欢探究内部机制
- 重视代码的可读性与架构的清晰性

**Jobs to Be Done:**

1. 理解编码代理的核心架构与工作流程
2. 动手运行并修改一个可运行的编码代理实例
3. 掌握工具调用、进程通信、安全边界等关键技术点

**Current Solutions & Pain Points:**

| Current Solution                    | Pain Points                        | Our Advantage                              |
| ----------------------------------- | ---------------------------------- | ------------------------------------------ |
| 商业编码代理（Cursor、Claude Code） | 闭源黑盒，无法看到内部实现逻辑     | 完全开源，代码极简，每一层都可拆解学习     |
| 大型开源Agent项目（OpenHands等）    | 代码量大、架构复杂，入门者难以理解 | 最小实现，模块化拆分，每个模块职责单一     |
| 零散博客教程                        | 只有片段代码，无法完整运行验证     | 完整可运行项目，包含从UI到代理逻辑的全链路 |

### Secondary Personas

- **技术讲师：** 可将此项目作为AI Agent开发课程的配套实践案例
- **高级开发者：** 可基于此项目快速验证新的Agent思路与工具扩展方案

------

## User Stories

### Epic: Core Agent Learning Experience

**Primary User Story:** "As an AI agent learner, I want to run and disassemble a minimal coding agent, so that I can understand the core principles of ReAct loop, tool calling, and inter-process communication."

**Acceptance Criteria:**

-  项目可以在本地一键启动，完整运行端到端代理流程
-  我可以在界面中看到每一次工具调用的请求参数与返回结果
-  我可以修改代理的系统提示、工具逻辑，观察代理行为变化
-  代码有清晰的模块划分与注释，对应理论概念

### Supporting User Stories

1. "As a learner, I want the agent to read and write local files, so that I can verify how file tools work."
   - AC: [ ] 代理可以读取指定路径的文件并展示内容
   - AC: [ ] 代理可以写入内容到指定路径的文件
   - AC: [ ] 所有文件操作被限制在指定工作目录内
2. "As a developer, I want to save and restore chat sessions, so that I can learn how session persistence works."
   - AC: [ ] 对话历史可以保存到本地文件
   - AC: [ ] 重新打开程序可以加载之前的会话
3. "As a learner, I want to see confirmation prompts before file writes, so that I can understand how agent safety boundaries are designed."
   - AC: [ ] 每次write_file调用前都弹出确认界面
   - AC: [ ] 我可以选择批准或拒绝写入操作

------

## Functional Requirements

### Core Features (MVP — P0)

#### 1. Agent Loop & LLM Integration

- **Description:** 实现标准ReAct代理循环，对接Anthropic Claude API，支持流式响应与工具调用调度。包含LLM客户端、提示管理器、代理循环核心逻辑。
- **User Value:** 编码代理的"大脑"，学习者可以直观理解思考-行动-观察的循环机制
- **Business Value:** 核心教学价值所在，所有其他功能都围绕此展开
- Acceptance Criteria:
  -  接收用户消息后，代理可以自主判断是否需要调用工具
  -  工具执行结果可以反馈给LLM，继续推理迭代
  -  支持流式输出回复内容，提升交互体验
  -  默认使用Claude Sonnet 4模型，预留扩展其他模型的接口
- **Dependencies:** LLM API服务、网络连接
- **Estimated Effort:** M

#### 2. File System Toolkit

- **Description:** 实现4个核心文件工具：read_file（读取文件）、write_file（写入文件）、glob_files（按模式查找文件）、search_code（在文件中搜索文本）。
- **User Value:** 让代理具备操作本地代码的能力，是编码代理的核心"手"
- **Business Value:** 完整演示工具调用链路：定义→调度→执行→结果反馈
- Acceptance Criteria:
  -  read_file可以读取工作区内任意文本文件
  -  write_file可以创建或覆盖文件，写入前触发审批
  -  glob_files支持通配符匹配查找文件
  -  search_code支持正则表达式搜索文件内容
  -  所有工具路径解析后都限制在工作目录内，禁止`..`目录遍历
- **Dependencies:** 文件系统权限、工作区沙箱
- **Estimated Effort:** M

#### 3. Desktop Chat Interface

- **Description:** 基于Electron + React的桌面聊天界面，支持消息展示、流式渲染、输入框、工作目录选择。
- **User Value:** 提供可视化交互入口，学习者可以直观看到代理的工作过程
- **Business Value:** 完整桌面应用形态，接近商业产品的使用体验
- Acceptance Criteria:
  -  聊天界面支持多轮对话，消息区分用户/助手角色
  -  支持流式渲染助手回复，逐字显示
  -  工具调用过程与结果可以在界面中展示
  -  可以选择本地文件夹作为工作目录
- **Dependencies:** Electron框架、React组件库
- **Estimated Effort:** M

#### 4. Workspace Sandbox & Safety Guardrails

- **Description:** 工作区沙箱机制 + 多层安全防护，包括路径校验、写入审批、敏感文件拦截、API密钥脱敏。
- **User Value:** 演示编码代理的安全设计，让学习者理解风险与防护手段
- **Business Value:** 建立安全基线，避免代理操作对本地系统造成破坏
- Acceptance Criteria:
  -  所有文件操作都被限制在用户选择的工作目录内
  -  每次写入文件前必须用户确认
  -  自动拦截`.env`、`.pem`、`id_rsa`等敏感文件读取
  -  发送到LLM的内容自动脱敏常见API密钥模式
- **Dependencies:** 路径校验逻辑、UI确认弹窗
- **Estimated Effort:** S

#### 5. Session Persistence (Hybrid)

- **Description:** 混合持久化方案：聊天消息以JSONL格式存储到文件，会话元数据与配置存储在SQLite。
- **User Value:** 演示两种持久化模式的适用场景，学习事件溯源与关系型存储的差异
- **Business Value:** 会话可保存、可恢复，提升使用体验
- Acceptance Criteria:
  -  每条消息追加写入JSONL文件，格式标准
  -  会话列表、配置项存储在SQLite数据库
  -  重启应用后可以恢复历史会话
  -  可以查看每个会话的创建与更新时间
- **Dependencies:** node:sqlite（Node 内置）、文件系统
- **Estimated Effort:** S

### Should Have (P1)

- Plan / Act模式分离：先规划后执行，清晰展示信息收集与行动的区别
- CodeMirror 6代码预览：内置代码编辑器，支持语法高亮查看文件内容
- 设置面板：API密钥管理、模型选择、参数配置
- 多提供商支持：兼容OpenAI、Gemini等其他模型

### Could Have (P2)

- 简单diff预览：写入文件前展示差异对比
- CLI版本：脱离UI的纯命令行版本代理
- 提示工程面板：可视化编辑系统提示与参数

## Out of Scope (Not in MVP)

- **Terminal/Bash工具：** 风险较高，且与核心代理机制教学无关，推迟至v0.2
- **MCP协议支持：** 抽象了工具调用底层，不适合入门教学，后续作为扩展内容
- **Git集成：** 正交于代理核心架构，非必要教学内容
- **多代理编排：** 高级主题，MVP聚焦单代理原理
- **代码lint反馈、Shadow Workspace：** Cursor的高级特性，复杂度高，不适合入门
- **语音输入、自动纠错：** 非核心教学功能
- **企业级安全、DLP集成：** 生产级需求，教学场景不需要

------

## Non-Functional Requirements

### Performance

- **Page Load:** 首屏加载 < 2秒
- **API Response:** 流式首字延迟 < 2秒
- **Concurrent Users:** 单用户桌面应用，无并发需求
- **Uptime:** 应用启动成功率 > 99%，本地运行无服务依赖

### Security

- **Authentication:** 无，本地桌面应用，数据全部存储在本地
- **Authorization:** 所有文件写入操作需要用户手动确认；工具权限最小化
- **Data Protection:** API密钥本地加密存储；发送到第三方API的内容自动脱敏敏感信息
- **Compliance:** 无强制合规要求，本地运行；用户数据默认不上传
- AI/Tool Permissions:
  - Read-only tools: read_file、glob_files、search_code，工作区内无限制
  - Write tool: write_file，必须用户逐次确认
  - Prohibited: 目录遍历、敏感文件读取、外部网络请求（除LLM API外）

### AI / Automation Requirements

- **AI Surface:** 内置AI代理，作为产品核心功能
- **Provider Strategy:** 默认Anthropic Claude Sonnet 4；预留适配器接口可扩展其他提供商
- **Output Contract:** 流式文本 + 结构化工具调用对象，JSONL帧格式
- Action Permissions:
  - Read: 工作区内的非敏感文件
  - Write: 工作区内文件，需用户确认
  - Forbidden: 访问系统目录、执行终端命令、访问外部网络（除API）
- Data Retention:
  - Local: 所有对话、文件都在用户本地
  - Provider: 选择零数据保留模式（Anthropic do-not-store）
- **Cost Ceiling:** 可配置每会话token预算，达到上限提示用户
- **Fallback Behavior:** API调用失败时展示错误信息，不崩溃；支持手动重试
- **Eval Set:** 手动验证功能正确性；无自动化评估

### Usability

- **Accessibility:** 基础WCAG 2.1 AA，对比度达标、键盘可操作
- **Browser Support:** 不涉及浏览器，桌面端支持Windows 10+
- **Mobile Support:** 无，纯桌面应用
- **Internationalization:** 英文界面为主，代码注释英文；暂不支持多语言

### Scalability

- **User Growth:** 单用户应用，无用户规模扩展需求
- **Data Growth:** 本地会话文件随使用增长，支持手动清理
- **Geographic Distribution:** 无，本地运行

------

## Quality Standards

*Engineering quality standards (type safety, testing, code rules) are defined later in AGENTS.md, not in this document.*

- 代码必须通过TypeScript严格类型检查，禁用隐式`any`类型
- 核心模块必须有单元测试，覆盖代理循环、工具校验逻辑
- 所有异步操作必须有错误处理，禁止静默失败
- 代码注释清晰，每个模块说明职责、输入输出、依赖关系

------

## UI/UX Requirements

### Design Principles

1. **极简清晰：** 界面简洁，突出聊天内容与工具过程，无多余装饰
2. **教学友好：** 工具调用、思考过程清晰可见，不隐藏内部逻辑
3. **功能优先：** 以展示技术原理为核心，UI轻量化，不追求视觉特效

### Information Architecture

```
├── 主窗口
│   ├── 侧边栏：会话列表 + 新建按钮
│   ├── 聊天区域
│   │   ├── 消息流（用户消息、助手消息、工具调用卡片）
│   │   └── 输入框 + 发送按钮
│   └── 设置面板（折叠）
│       ├── API密钥配置
│       ├── 模型选择
│       └── 工作目录选择
```

### Key User Flows

#### Flow 1: First Launch & Configuration

1. 打开应用 → 2. 弹出设置面板，提示输入API密钥、选择工作目录 → 3. 保存配置 → 4. 进入空白会话，开始使用

#### Flow 2: Basic Dialogue & Tool Calling

1. 用户输入问题/指令 → 2. 代理接收，调用LLM推理 → 3. LLM返回工具调用 → 4. 代理执行工具（读取文件等） → 5. 结果返回LLM继续推理 → 6. 生成最终回复展示给用户

#### Flow 3: File Write Approval

1. 代理决定写入文件 → 2. 弹出确认弹窗，展示文件路径与内容预览 → 3. 用户点击"批准"或"拒绝" → 4. 批准则执行写入，拒绝则终止操作并告知LLM

------

## Success Metrics

| Category                | Metric                         | Target                                            | Measurement                   |
| ----------------------- | ------------------------------ | ------------------------------------------------- | ----------------------------- |
| Functional Completeness | Core feature pass rate         | 100% P0 features functional                       | Manual test case verification |
| Teaching Effectiveness  | Learner comprehension          | Learners can explain agent mechanics via code     | Learning feedback survey      |
| Performance             | First screen load time         | < 2 seconds                                       | Local performance test        |
| Stability               | Crash rate                     | < 1% runtime                                      | Error log statistics          |
| Security                | Unauthorized access block rate | 100% directory traversal & sensitive file blocked | Security test cases           |

------

## Constraints & Assumptions

### Constraints

- **Budget:** 零开发成本，全部使用开源工具与免费API额度；API使用成本由学习者自行承担
- **Timeline:** MVP v0.1开发周期2周
- **Resources:** 单人开发，教学项目
- **Technical:** 必须使用Electron + React + TypeScript技术栈；pnpm monorepo结构

### Assumptions

- 用户具备基础的JavaScript/TypeScript开发能力
- 用户拥有可用的Anthropic API密钥
- 用户主要在Windows系统上运行，兼容macOS但不做重点优化
- 学习者具备基本的AI Agent概念认知，了解ReAct基本原理

### Open Questions

- 是否在v0.1加入Plan/Act模式分离，还是推迟到v0.2
- 文件预览初始版本用纯文本`<pre>`还是直接集成CodeMirror 6
- 默认每会话token预算设置为多少合适
- 是否需要提供CLI版本的代理

### Dependencies

- **External:** Anthropic Claude API服务、node:sqlite（Node 内置）、CodeMirror 6（可选）
- **Internal:** agent-core模块、storage模块、desktop UI模块

------

## MVP Definition of Done

### Feature Complete

-  所有P0功能全部实现
-  所有验收标准通过验证
-  代码Review完成，符合规范

### Quality Assurance

-  核心路径测试全部通过
-  手动测试完成，无阻塞性bug
-  性能基准达标

### Documentation

-  代码注释完整，模块说明清晰
-  README文档包含启动说明、架构讲解
-  每个核心模块有设计说明

### Release Ready

-  本地可正常构建运行
-  错误处理完善，异常场景有提示
-  回滚机制：文件写入前备份，可撤销

------

## Handoff Context

- Stage: prd
- App name: Minimal Coding Agent (Teaching Edition)
- User level: B (developer)
- Target platform: Desktop (Windows, Electron)
- Budget: 0 development cost; API cost borne by user, estimated $0.3–$20 per user per month
- Timeline: v0.1 development cycle: 2 weeks
- AI in product scope: yes
- Research status: Researched with sources — 25+ sources across architecture, competitors, providers, safety, and tooling
- Constraints: Code must be minimal, modular, and well-commented for teaching; Windows desktop priority; pnpm monorepo structure; SQLite+JSON hybrid persistence
- Decisions:
  - Electron + React + TS + Tailwind + Vite + electron-vite as preferred stack ✅ validated
  - Node.js child process + JSONL stdio communication architecture ✅ recommended for teaching
  - Direct tool calling (not MCP) for MVP ✅ recommended
  - Hybrid persistence: JSONL for messages + SQLite for metadata ✅ recommended
  - Claude Sonnet 4 as default AI provider ✅ recommended with fallbacks
  - CodeMirror 6 as code editor (plain text preview optional for v0.1) ✅ balanced choice
  - pnpm monorepo with agent-core, shared-types, storage, desktop packages ✅ recommended
- Open questions:
  - Whether to include bash/terminal tool in v0.1 (research recommends NO — defer to v0.2)
  - Plain text vs CodeMirror for file preview in v0.1
  - Default token budget / cost ceiling values
  - Whether to include Plan/Act mode separation in v0.1 or v0.2
- Source files: research-minimal-coding-agent.md → docs/research-minimal-coding-agent.md

→ docs/PRD-Minimal-Coding-Agent-MVP.md

------

```
{
  "schemaVersion": 1,
  "documentType": "prd",
  "appName": "Minimal Coding Agent (Teaching Edition)",
  "oneLiner": "A minimal desktop coding agent for teaching, demonstrating ReAct loop, tool calling, and inter-process communication core mechanisms",
  "targetUsers": "Developers, students, and tech enthusiasts learning AI agent development",
  "phase": "Foundation",
  "mustHave": [
    "Agent Loop & LLM Integration",
    "File System Toolkit",
    "Desktop Chat Interface",
    "Workspace Sandbox & Safety Guardrails",
    "Session Persistence"
  ],
  "niceToHave": [
    "Plan/Act Mode Separation",
    "CodeMirror Code Preview",
    "Settings Panel",
    "Multi-provider Support"
  ],
  "notInMvp": [
    "Terminal/Bash Tool",
    "MCP Protocol Support",
    "Git Integration",
    "Multi-agent Orchestration",
    "Lint Feedback & Shadow Workspace",
    "Voice Input"
  ],
  "successMetrics": [
    "Core feature pass rate",
    "Unauthorized access block rate",
    "First screen load time",
    "Crash rate"
  ]
}
```

------

Review the PRD: check its scope, must-have features, and out-of-scope list. The PRD is a living document; update it as you learn from users.

Save `PRD-Minimal-Coding-Agent-MVP.md`, including its Handoff Context and final JSON block. Its eventual location is `docs/PRD-Minimal-Coding-Agent-MVP.md`.

When you're ready, you can paste the complete Part 3 technical design prompt and attach this PRD to proceed to the technical design phase. Let me know if you'd like any adjustments before moving forward.