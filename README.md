# kimi-code

> **Kimi-powered coding agent CLI** — plan, code, review, and automate in your terminal.

[**中文文档**](README.zh-CN.md)

`kimi-code` is a terminal-based AI coding assistant powered by Moonshot AI (Kimi). It supports four operating modes, full tool access (file operations, shell commands, search), and is designed to be used like Claude Code, Codex, or DeepSeek TUI — but backed by Kimi's language models.

## Features

- **Solo mode** — Single Q&A, ask one question, get one answer
- **Chat mode** — Interactive conversation with context history
- **Plan mode** — Analyze → plan → execute step by step with user approval
- **Agent mode** — Fully autonomous: reads files, writes code, runs commands
- **Tool system**: Read, Write, Edit, Bash, Glob, Grep, Exit
- **Cross-platform**: Windows, macOS, Linux (Node.js 18+)
- **npm-installable**: `npm install -g kimi-code`

## Installation

### Via npm (recommended)

```bash
npm install -g kimi-code
```

### Via npx (no install)

```bash
npx kimi-code init
npx kimi-code solo "What is the capital of France?"
```

### From source

```bash
git clone https://github.com/moonshotai/kimi-code.git
cd kimi-code
npm install
npm run build
npm link
```

## Quick Start

### 1. Initialize

```bash
kimi-code init
```

This will prompt for your Moonshot API key and save it to `~/.kimi-code/config.json`.

**API Key**: Get yours at [platform.moonshot.cn](https://platform.moonshot.cn/console/api-keys)

### 2. Solo Mode

Ask a single question:

```bash
kimi-code solo "Explain Rust's ownership model"
kimi-code solo "Write a quick sort in Python" --model moonshot-v1-32k
```

### 3. Chat Mode

Interactive conversation:

```bash
kimi-code chat
```

Type your messages, use Ctrl+D or `.done` to finish input, and `/exit` to quit.

### 4. Plan Mode

Analyze a task, create a plan, then execute:

```bash
kimi-code plan "Build a REST API with Express and TypeScript"
kimi-code plan "Refactor the auth module" --interactive
```

With `--interactive`, the plan is shown for approval before execution.

### 5. Agent Mode

Fully autonomous with file and shell access:

```bash
kimi-code agent "Add a health check endpoint to the server"
kimi-code agent "Find and fix all TypeScript errors" -y
kimi-code agent --interactive
```

The `-y` flag auto-approves tool calls for faster execution.

## Configuration

### Environment variables

| Variable | Description |
|----------|-------------|
| `KIMI_API_KEY` | Moonshot API key |
| `MOONSHOT_API_KEY` | Alternative for KIMI_API_KEY |
| `KIMI_BASE_URL` | API base URL (default: `https://api.moonshot.cn/v1`) |
| `KIMI_MODEL` | Default model name |

### Config file

Location: `~/.kimi-code/config.json`

```json
{
  "api_key": "sk-...",
  "base_url": "https://api.moonshot.cn/v1",
  "model": "moonshot-v1-auto",
  "auto_approve": false,
  "max_tool_rounds": 25
}
```

Manage via CLI:

```bash
kimi-code config --show
kimi-code config --set model=moonshot-v1-128k
kimi-code config --set auto_approve=true
```

### Available models

```bash
kimi-code models
```

## Architecture

```
kimi-code/
├── src/
│   ├── index.ts          # Entry point
│   ├── cli.ts            # CLI command definitions
│   ├── config.ts         # Configuration management
│   ├── display.ts        # Terminal UI utilities
│   ├── types.ts          # Core type definitions
│   ├── llm/
│   │   ├── client.ts     # Moonshot API client (OpenAI-compatible)
│   │   └── prompts.ts    # System prompts + tool definitions
│   ├── agent/
│   │   └── loop.ts       # Core agent loop (think → act → observe)
│   ├── tools/
│   │   └── registry.ts   # Tool execution (Read, Write, Edit, Bash, etc.)
│   └── modes/
│       ├── solo.ts       # Single Q&A
│       ├── chat.ts       # Interactive conversation
│       ├── plan.ts       # Plan-then-execute
│       └── agent.ts      # Full autonomous agent
```

### Agent Loop

```
User Input → LLM (with tools) → Tool Calls? → Execute Tools → LLM
                                ↘ No         → Response → Done
```

The loop continues until either:
- The LLM produces a text response (no tool calls)
- The `Exit` tool is called
- The maximum number of tool rounds is reached

## Development

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Build
npm run build

# Run tests
npm test

# Development (build + run)
npm run dev -- solo "Hello"
```

## License

MIT
