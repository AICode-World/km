/* ===== Core types for kimi-code ===== */

/** Supported Kimi / Moonshot models */
export type KimiModel =
  | "moonshot-v1-8k"
  | "moonshot-v1-32k"
  | "moonshot-v1-128k"
  | "moonshot-v1-auto";

/** Running mode */
export type RunMode = "solo" | "chat" | "plan" | "agent";

/** Available tool names */
export type ToolName = "Read" | "Write" | "Edit" | "Bash" | "Glob" | "Grep" | "Exit";

// ── Tool parameter types ──────────────────────────────────

export interface ReadParams {
  /** File path to read */
  file_path: string;
  /** Optional line offset (1-based) */
  offset?: number;
  /** Max lines to read */
  limit?: number;
}

export interface WriteParams {
  /** File path to create/overwrite */
  file_path: string;
  /** Content to write */
  content: string;
}

export interface EditParams {
  /** File path to edit */
  file_path: string;
  /** Old text snippet to replace (must be unique) */
  old_text: string;
  /** New text to insert */
  new_text: string;
}

export interface BashParams {
  /** Shell command to run */
  command: string;
  /** Working directory */
  cwd?: string;
  /** Timeout in ms (default 30_000) */
  timeout?: number;
}

export interface GlobParams {
  /** Glob pattern */
  pattern: string;
  /** Base directory */
  path?: string;
}

export interface GrepParams {
  /** Regex pattern */
  pattern: string;
  /** Path to search */
  path?: string;
  /** File include glob */
  include?: string[];
  /** Max results */
  max_results?: number;
}

export interface ExitParams {
  /** Reason / summary */
  reason?: string;
}

/** Union of all tool parameter types */
export type ToolParams =
  | ReadParams
  | WriteParams
  | EditParams
  | BashParams
  | GlobParams
  | GrepParams
  | ExitParams;

// ── Tool definitions ──────────────────────────────────────

export interface ToolDefinition {
  name: ToolName;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolResult {
  tool_name: ToolName;
  success: boolean;
  output: string;
  error?: string;
}

// ── Message types ─────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface Message {
  role: MessageRole;
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// ── Config types ──────────────────────────────────────────

export interface KimiCodeConfig {
  /** Moonshot API key */
  api_key: string;
  /** Base URL — defaults to Moonshot */
  base_url: string;
  /** Active model */
  model: KimiModel;
  /** Max tool call iterations before returning control */
  max_tool_rounds: number;
  /** Auto-approve tool calls in agent mode */
  auto_approve: boolean;
  /** Custom system prompt additions */
  system_prompt_hint?: string;
}

export const DEFAULT_CONFIG: KimiCodeConfig = {
  api_key: "",
  base_url: "https://api.moonshot.cn/v1",
  model: "moonshot-v1-auto",
  max_tool_rounds: 25,
  auto_approve: false,
};

// ── Mode-specific options ─────────────────────────────────

export interface ChatOptions {
  model?: KimiModel;
  temperature?: number;
  max_tokens?: number;
  system_hint?: string;
}

export interface AgentOptions extends ChatOptions {
  max_tool_rounds?: number;
  auto_approve?: boolean;
}

export interface PlanOptions extends ChatOptions {
  max_tool_rounds?: number;
}

// ── CLI argument types ────────────────────────────────────

export interface GlobalOptions {
  config?: string;
  verbose?: boolean;
}
