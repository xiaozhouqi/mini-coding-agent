# Memory 模块技术调研与实现排表

> 本文是对 `agent_docs/roadmap.md` **阶段 3「上下文与记忆」** 的细化拆解。
> 先做技术调研，再按**用户价值**（非技术难度）排序，给出记忆功能的分阶段排表。
>
> 最后更新：2026-10-29。当前状态：调研 + 提案（未实施），三项决策已锁定并落实（见「一、决策记录」）。

## 一、决策记录（2026-10-29）

调研后拍板三项，均已落实到下方排表。其中两项是**对主流的刻意偏离**，记此备查：

| 决策 | 选择 | 说明 |
|------|------|------|
| 长期记忆存储位置 | **用户全局 · 按项目哈希** | 存 `<userData>/memory/<sha256(workspace realpath)>/`。同一项目换路径/克隆后仍共享记忆（贴近 Claude Code）；代价是写盘越过工作区沙箱，故 `remember` 是**唯一、审批门控的越界写**。 |
| 会话压缩位次 | **先持久、后压缩** | 维持 P1→P2→P3→P4：项目指令 → 记忆 → 记忆工具 → 压缩。教学上先教「存」再教「丢」。 |
| 项目指令脱敏 | **不脱敏** | AGENTS.md / CLAUDE.md 当**可信配置**直接注入（与 Claude Code 一致），不经过 `desensitize()`。 |

> 决策一的架构后果（已体现在 P2/P3）：记忆存储由 **Electron 主进程**（持有 `userData`）拥有，而非 agent 子进程。注入经 `init` 帧下发；`remember` 落盘由主进程在批准后执行——**子进程依旧不能在工作区之外写任何文件**。

## 二、调研结论

### 1.1 记忆的四个层次（业界共识）

调研 Claude Code 官方文档与多篇 agent 记忆架构分析后，主流 coding agent 的「记忆」实际是**四层，按生命周期与丢失代价区分**：

| 层 | 名字 | 生命周期 | 是否 lossy | 解决什么 |
|----|------|----------|-----------|----------|
| A | **项目指令**（CLAUDE.md / AGENTS.md） | 跨会话，人写 | 否（每次从磁盘重读） | 项目约定、规范、流程 |
| B | **长期记忆 / 自动记忆**（memory 文件） | 跨会话，agent 沉淀 | 否 | 跨会话知识、决策、事实 |
| C | **会话上下文 + 压缩**（compact/summary） | 单会话 | 是 | 上下文窗口不够用 / 降本 |
| D | **语义检索 / RAG** | 按需 | 否 | 记忆量大后的精确召回 |

关键共识：**C（压缩）是 lossy 的，只有在 A/B 这类「从磁盘重读的持久层」就位之后才能安全启用**——否则压缩只会把唯一的知识也丢掉。所以正确顺序是「先持久、后压缩」。

### 1.2 对当前代码库的映射（已读源码核实）

- **注入点已存在且唯一**：`packages/agent-core/src/agent/PromptManager.ts#buildMessages` 构造 `[system, ...history, user]`，system prompt 目前是静态串（或来自 `config.systemPrompt`）。A/B 层都在这里拼接。
- **上下文已按会话持久化**：`storage/MessageStore`（JSONL）+ `storage/SessionRepository`（SQLite 元数据）+ `desktop/main/history.ts#messagesToChatHistory` 把存储消息还原成 `ChatMessage[]`，经 `stdio-server.init` 的 `history` 参数送回子进程。**没有**跨会话的记忆存储。
- **token 预算已有但只「刹车」不「压缩」**：`AgentLoop` 的 `tokenBudget`（默认 100000）到阈值就 `[token budget reached]` 停止，不会压缩历史继续。
- **写入需审批的约束**：所有写盘走统一 `approval-request/result` 通道（`{ kind: 'write' | 'command' }`）。记忆工具的写盘也要纳入该通道，不能开后门。
- **脱敏边界**：`security/desensitize.ts` 是所有**工具输出（读到的文件内容/命令输出）**进入 LLM 前的必经层。项目指令按决策三当可信配置不脱敏；长期记忆是主进程已审批写盘的沉淀事实，也按可信内容直接注入。

### 1.3 Provider 约束（Deepseek）

- **上下文窗口**：V4 系（`deepseek-v4-pro`/`deepseek-v4-flash`）报告为 **1M token** 级（第三方口径，需以官方为准）；旧 V3.2 为 128K。**但当前 `tokenBudget` 默认 100K 才是真正的约束**——压缩触发点应按预算（~70–80K）设，而不是 1M。
- **Prompt Caching**：Deepseek 的「上下文硬盘缓存」**默认自动开启**，无需代码或 cache-control 头；命中的是**字节完全一致的前缀**，缓存命中段输入价约降 80%+。设计规则：**稳定内容（system prompt + 项目指令 + 记忆）放前面，易变内容（时间戳、用户消息）放后面**——任何前缀变动会使其后缓存失效。
- 见官方文档：[DeepSeek 上下文硬盘缓存（KV Cache）](https://api-docs.deepseek.com/guides/kv_cache/)；参考 [Claude Code 上下文窗口文档](https://code.claude.com/docs/en/context-window) 与 [claude-code-handbook 记忆系统一章](https://github.com/vitoworleone/claude-code-handbook/blob/main/docs/manual/part-04-context/ch-10-memory-system.md)。

---

## 三、排表（按用户价值从高到低）

| 阶段 | 功能 | 为什么这个位次 | 改动落点 | 复杂度 |
|------|------|----------------|----------|--------|
| **P1** | 项目指令注入（读 `AGENTS.md`/`CLAUDE.md`） | 最高杠杆：让 agent 跨会话/跨重启遵守项目约定，且零新存储、纯确定性、成本最低 | agent-core（`PromptManager` + `stdio-server`） | 低 |
| **P2** | 长期记忆存储 + 注入（`MemoryStore`） | 「跨会话知识沉淀」的另一半；用户全局按项目哈希，存储归主进程 | storage（新 `MemoryStore`）+ shared-types（init 帧扩展）+ desktop 主进程下发 + agent-core 注入 | 中 |
| **P3** | 记忆工具（`remember` / `recall`） | 让模型能自主保存/召回，把 P2 从「人肉维护」升级成「自动记忆」 | agent-core tools + approval 扩 `{ kind:'memory' }` + desktop 主进程落盘 | 中 |
| **P4** | 会话自动压缩 / 摘要 | 长任务失忆退化 + 降本的根治；**依赖 P1/P2 就位**，否则压缩丢的是唯一知识 | agent-core（`ContextManager`） | 中高 |
| **P5** | 稳定前缀 / prompt caching 加固 | 免费省成本；主要是「排序约束」而非新功能，P1–P4 设计时顺带遵守 | 无新文件，规则约束 + 文档 | 低 |
| **P6** | 语义检索 / RAG（暂缓） | 记忆量变大后的召回优化，对「最小教学版」过重 | —（先不做） | 高 |

依赖关系：`P1 → P2 → P3`，`P4 依赖 P1+P2`，`P5` 是贯穿 P1–P4 的设计约束。**P1 体量小、风险低，可与 roadmap 阶段 2（edit_file + git）并行交付**，不必等阶段 2 全部完成。

---

## 四、各阶段实现要点与验收

### P1 — 项目指令注入

**做什么**：在 `init` 时读 workspace 根目录的 `AGENTS.md`（回退 `CLAUDE.md`），注入 system prompt；`PromptManager` 支持拼接。

**实现要点**
- 读文件发生在**子进程**（`stdio-server.init` 已知 `workspace`），是沙箱内读取，无需 IPC 往返。
- 注入顺序：`base system prompt → 项目指令 → （P2 的记忆）`；项目指令当**可信配置**直接注入，不脱敏（见「一、决策记录」）。
- 只读根目录一个文件即可（嵌套/子目录 `AGENTS.md` 属后续优化，暂不做）。

**验收**：把「一律用 `pnpm`、不要 `npm`」写进 AGENTS.md → 重启 → 让 agent 装依赖，它遵守约定；单测覆盖「无 AGENTS.md 时回退/空」「注入顺序正确」。

### P2 — 长期记忆存储 + 注入

**做什么**：新增 `MemoryStore`（markdown 文件，一条记忆一个文件 + 一个 `MEMORY.md` 索引），注入 system prompt。

**实现要点**
- **用户全局、按项目哈希**（决策一）：存 `<userData>/memory/<sha256(workspace realpath)>/*.md`。同一项目换路径/克隆后仍共享记忆。
- **存储归 Electron 主进程所有**：`storage/src/MemoryStore.ts` 镜像 `MessageStore` 的目录+文件风格，在 `desktop/main/index.ts` 用 `userData` 构造；主进程在 `start()` 前读索引/条目，随 `init` 帧（新增 `memory` 字段）下发给子进程注入——**子进程仍不持有 userData、不直接读写存储**。
- 文件格式沿用本仓库 CLAUDE.md 里定的 memory 格式：frontmatter `name/description/type` + 正文，`MEMORY.md` 做一行一条的索引。注入先注入索引（短），命中条目再展开正文。
- 新 `shared-types/src/memory.ts`（`MemoryEntry`、索引类型）+ `init` 帧扩展；`remember` 成功后如需刷新，由主进程重发 memory 上下文。

**验收**：主进程写一条记忆 → 重启新会话 → 注入的 system prompt 含该条目，agent 能据此作答；`MemoryStore` 单测（append/read/索引/缺失目录）+ `init` 帧 memory 下发。

### P3 — 记忆工具（remember / recall）

**做什么**：让模型在对话中自己 `remember`（存事实）与 `recall`（召回），把记忆变成「自动记忆」。

**实现要点**
- 新增工具 `remember`（写一条记忆）与 `recall`（读索引/条目）。`remember` 是**越界写盘 → 走审批**：扩 `ApprovalRequest` 加 `{ kind: 'memory' }`，desktop 弹窗明确提示「写入工作区外的 agent 记忆」。
- **落盘由主进程执行**：子进程的 `remember` 只发出 `{ kind: 'memory', entry }` 审批帧；批准后**主进程**调用 `MemoryStore` 写 `userData/memory/<hash>/`，再回 `approval-result`。这是全链路**唯一**的工作区外写，且路径由主进程按 hash 派生，模型无法指定任意路径。
- `recall` 只读（数据来自 P2 注入/主进程下发），直接返回；输出照例过 `desensitize()`。

**验收**：对话中让 agent「记住本项目用 node:sqlite 而非 better-sqlite3」→ 弹审批（明示越界）→ 批准后由主进程写入 memory 目录 → 重启后它还记得；测试覆盖 memory 审批往返 + 越界仅允许写 memory 目录。

### P4 — 会话自动压缩 / 摘要

**做什么**：当历史 token 逼近预算（如 ~70–80%）时，把较早轮次摘要成一段「运行摘要」，保留最近若干轮原文，继续循环。

**实现要点**
- 新增 `agent-core/src/agent/ContextManager.ts`：触发阈值、摘要调用（一次 LLM 调用，lossy）、「摘要 + 近轮原文」拼装。
- 关键不变量：压缩**之后** P1 项目指令、P2 记忆仍**从磁盘重读重注入**，不依赖摘要存活（对应调研里的「CLAUDE.md 抗压缩」结论）。
- 摘要提示里显式要求保留：任务目标、关键文件路径、已做决策、测试结果。

**验收**：构造长会话触发压缩 → 摘要保留关键决策 → 压缩后项目约定仍生效、agent 可继续正确推进；`ContextManager` 单测（阈值触发/不触发、摘要拼装）。

### P5 — 稳定前缀 / prompt caching 加固

**做什么**：把「稳定在前、易变在后」固化为 `PromptManager` 的顺序约束，并把「system prompt 不写时间戳/请求号」写进约定，避免无谓失效缓存。

**验收**：`PromptManager` 输出顺序固定为 `system(base+指令+记忆) → history → user`；单测断言稳定段字节不变。

### P6 — 语义检索 / RAG（暂缓）

记忆量大到「全量注入不划算」时才需要（embedding + 向量检索）。最小教学版不做，保留接口位即可。

---

## 五、范围与原则

- 不在首版：嵌套/子目录 `AGENTS.md`、语义检索、记忆去重/遗忘策略、多模型记忆隔离。
- 全程遵守：`shared-types → agent-core → storage → desktop` 单向依赖；记忆写盘走审批（全链路唯一越界写）；`// TEACHING:` 标注。
- 每个阶段完成后按 `agent_docs/testing.md` 跑单测 + typecheck + build，并在运行的 Electron 里走一遍用户路径。
