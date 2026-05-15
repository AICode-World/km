# km

> **基于 Kimi 的编程 Agent CLI** — 在终端中规划、编码、审查和自动化。

`km` 是一个终端 AI 编程助手，由 Moonshot AI（Kimi）驱动。它支持四种运行模式、完整的工具访问权限（文件操作、Shell 命令、搜索），设计理念类似于 Claude Code、Codex 或 DeepSeek TUI——但底层由 Kimi 大语言模型驱动。

## 功能特性

- **Solo 模式** — 单轮问答，一问一答
- **Chat 模式** — 交互式对话，保持上下文历史
- **Plan 模式** — 分析 → 规划 → 逐步执行（含用户确认）
- **Agent 模式** — 完全自主：读写文件、编写代码、执行命令
- **Doctor 模式** — 诊断环境（API Key、配置文件、网络连接）
- **工具系统**：Read、Write、Edit、Bash、Glob、Grep、Exit
- **跨平台**：Windows、macOS、Linux（Node.js 18+）
- **npm 安装**：`npm install -g km`

## 安装

### 通过 npm（推荐）

```bash
npm install -g km
```

### 通过 npx（免安装）

```bash
npx km init
npx km solo "帮我写一个快速排序"
```

### 从源码安装

```bash
git clone https://gitee.com/all-xu/km.git
cd km
npm install
npm run build
npm link
```

## 快速开始

### 1. 初始化

```bash
km init
```

按提示输入你的 Moonshot API Key，配置将保存在 `~/.km/config.json`。

**获取 API Key**：[platform.moonshot.cn](https://platform.moonshot.cn/console/api-keys)

### 2. Solo 模式（单轮问答）

提问一句话：

```bash
km solo "解释 Rust 的所有权模型"
km solo "用 Python 写一个快速排序" --model moonshot-v1-32k
```

### 3. Chat 模式（交互对话）

```bash
km chat
```

输入你的消息，使用 Ctrl+D 或 `.done` 结束输入，输入 `/exit` 退出。

### 4. Plan 模式（先规划后执行）

分析任务、生成计划、逐步执行：

```bash
km plan "用 Express 和 TypeScript 构建一个 REST API"
km plan "重构 auth 模块" --interactive
```

`--interactive` 模式下，会先展示计划，等你确认后再执行。

### 5. Agent 模式（完全自主）

拥有完整文件和 Shell 权限的自主 Agent：

```bash
km agent "给服务器添加一个健康检查端点"
km agent "查找并修复所有 TypeScript 错误" -y
km agent --interactive
```

`-y` 标志自动批准工具调用，加快执行速度。

### 6. Doctor 模式

诊断你的运行环境：

```bash
km doctor
```

检查 API Key 是否存在、配置文件是否有效、与 Moonshot API 的网络连通性以及已安装版本。

## 配置

### 环境变量

| 变量 | 说明 |
|----------|------|
| `KIMI_API_KEY` | Moonshot API 密钥 |
| `MOONSHOT_API_KEY` | KIMI_API_KEY 的别名 |
| `KIMI_BASE_URL` | API 基础地址（默认 `https://api.moonshot.cn/v1`） |
| `KIMI_MODEL` | 默认模型名称 |

### 配置文件

路径：`~/.km/config.json`

```json
{
  "api_key": "sk-...",
  "base_url": "https://api.moonshot.cn/v1",
  "model": "moonshot-v1-auto",
  "auto_approve": false,
  "max_tool_rounds": 25
}
```

通过命令行管理：

```bash
km config --show
km config --set model=moonshot-v1-128k
km config --set auto_approve=true
```

### 内联 --config 参数

不修改配置文件，运行时临时覆盖：

```bash
km --config "model=moonshot-v1-128k,auto_approve=true" agent "重构 auth"
km --config "base_url=https://custom.api.com/v1" chat
```

支持的键：`api_key`、`base_url`、`model`、`max_tool_rounds`、`auto_approve`。

### 查看可用模型

```bash
km models
```

## 架构

```
km/
├── src/
│   ├── index.ts          # 入口
│   ├── cli.ts            # CLI 命令定义
│   ├── config.ts         # 配置管理
│   ├── display.ts        # 终端 UI 工具
│   ├── types.ts          # 核心类型定义
│   ├── llm/
│   │   ├── client.ts     # Moonshot API 客户端（OpenAI 兼容）
│   │   └── prompts.ts    # 系统提示词 + 工具定义
│   ├── agent/
│   │   └── loop.ts       # 核心 Agent 循环（思考 → 行动 → 观察）
│   ├── tools/
│   │   └── registry.ts   # 工具执行（Read、Write、Edit、Bash 等）
│   └── modes/
│       ├── solo.ts       # 单轮问答
│       ├── chat.ts       # 交互对话
│       ├── plan.ts       # 计划执行
│       └── agent.ts      # 完全自主 Agent
```

### Agent 循环

```
用户输入 → LLM（带工具） → 有工具调用？ → 执行工具 → 返回 LLM
                           ↘ 无 → 输出文本 → 完成
```

循环在以下任一条件满足时结束：
- LLM 输出纯文本响应（无工具调用）
- 调用 `Exit` 工具
- 达到最大工具轮数

## 工具列表

| 工具 | 说明 |
|------|------|
| **Read** | 读取文件内容，支持偏移量和行数限制 |
| **Write** | 创建新文件或覆写已有文件 |
| **Edit** | 搜索替换方式编辑已有文件 |
| **Bash** | 执行 Shell 命令 |
| **Glob** | 按 Glob 模式搜索文件 |
| **Grep** | 按正则表达式搜索文件内容 |
| **Exit** | 标记任务完成并输出总结 |

## 开发

```bash
# 安装依赖
npm install

# 类型检查
npm run typecheck

# 构建
npm run build

# 运行测试
npm test

# 开发模式（构建 + 运行）
npm run dev -- solo "你好"
```

## 技术栈

| 项目 | 选择 |
|------|------|
| 语言 | TypeScript 5.4 |
| 运行时 | Node.js 18+ |
| 构建工具 | tsup v8（esbuild） |
| CLI 框架 | Commander.js v12 |
| LLM API | OpenAI SDK v4（Moonshot 兼容） |
| 终端 UI | chalk v5 + ora v8 |
| 测试框架 | Vitest v1.6 |

## License

MIT
