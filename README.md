# km

> **Kimi-powered coding agent CLI** — plan, code, review, and automate in your terminal.

`km` is a terminal-based AI coding assistant powered by Moonshot AI (Kimi). It supports four operating modes, full tool access (file operations, shell commands, search), and is designed to be used like Claude Code, Codex, or DeepSeek TUI — but backed by Kimi's language models.

> **This project was fully generated and maintained by DeepSeek** — code refactoring, npm dependency simplification (removing C++ native modules), installation fixes, rebranding (kimi-code to km), Gitee push and configuration.

## Features

- **Solo mode** — Single Q&A, ask one question, get one answer
- **Chat mode** — Interactive conversation with context history
- **Plan mode** — Analyze to plan to execute step by step with user approval
- **Agent mode** — Fully autonomous: reads files, writes code, runs commands
- **Doctor mode** — Diagnose your environment (API key, config, network)
- **Tool system**: Read, Write, Edit, Bash, Glob, Grep, Exit
- **Cross-platform**: Windows, macOS, Linux (Node.js 18+)
- **Pure JavaScript** — No C++ compilation required

## Installation

### npm install (recommended)

```bash
npm install -g @ai-xuyan/km
```

### From source

```bash
git clone https://gitee.com/all-xu/km.git
cd km
npm install
npm run build
npm link
```

### Single binary (no Node.js required)

```bash
bun build --compile ./src/index.ts --outfile km
```

## Quick Start

### 1. Initialize

```bash
km init
```

This will prompt for your Moonshot API key and save it to `~/.km/config.json`.

**API Key**: Get yours at [platform.moonshot.cn](https://platform.moonshot.cn/console/api-keys)

### 2. Solo Mode

```bash
km solo "Explain Rust ownership model"
km solo "Write a quick sort in Python" --model moonshot-v1-32k
```

### 3. Chat Mode

```bash
km chat
```

Type your messages, use Ctrl+D or `.done` to finish input, and `/exit` to quit.

### 4. Plan Mode

```bash
km plan "Build a REST API with Express and TypeScript"
km plan "Refactor the auth module" --interactive
```

### 5. Agent Mode

```bash
km agent "Add a health check endpoint to the server"
km agent "Find and fix all TypeScript errors" -y
km agent --interactive
```

### 6. Doctor Mode

Diagnose your environment:

```bash
km doctor
```

Checks API key presence, config file validity, network connectivity to Moonshot API, and installed version.

## Configuration

### Environment variables

| Variable | Description |
|----------|-------------|
| `KIMI_API_KEY` | Moonshot API key |
| `MOONSHOT_API_KEY` | Alternative for KIMI_API_KEY |
| `KIMI_BASE_URL` | API base URL (default: `https://api.moonshot.cn/v1`) |
| `KIMI_MODEL` | Default model name |

### Config file

Location: `~/.km/config.json`

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
km config --show
km config --set model=moonshot-v1-128k
km config --set auto_approve=true
```

### Inline --config

Override config on the fly without editing your config file:

```bash
km --config "model=moonshot-v1-128k,auto_approve=true" agent "Refactor auth"
km --config "base_url=https://custom.api.com/v1" chat
```

Supported keys: `api_key`, `base_url`, `model`, `max_tool_rounds`, `auto_approve`.

### Available models

```bash
km models
```

## Architecture

```
km/
 +-- src/
     +-- index.ts          # Entry point
     +-- cli.ts            # CLI command definitions
     +-- config.ts         # Configuration management
     +-- display.ts        # Terminal UI utilities
     +-- types.ts          # Core type definitions
     +-- llm/
     |   +-- client.ts     # Moonshot API client (OpenAI-compatible)
     |   +-- prompts.ts    # System prompts + tool definitions
     +-- agent/
     |   +-- loop.ts       # Core agent loop (think -> act -> observe)
     +-- tools/
     |   +-- registry.ts   # Tool execution (Read, Write, Edit, Bash, etc.)
     +-- modes/
         +-- solo.ts       # Single Q&A
         +-- chat.ts       # Interactive conversation
         +-- plan.ts       # Plan-then-execute
         +-- agent.ts      # Full autonomous agent
```

## Repositories

- **Gitee**: https://gitee.com/all-xu/km
- **GitHub**: https://github.com/AICode-World/km

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
npm run dev -- solo "Hello"
```

## License

MIT
