import { RunMode } from "../types.js";

/** Build system prompt for a given mode */
export function buildSystemPrompt(mode: RunMode, extraHint?: string): string {
  const base = getBasePrompt(mode);
  const hint = extraHint ? `\n\n${extraHint}` : "";
  return `${base}${hint}`;
}

function getBasePrompt(mode: RunMode): string {
  switch (mode) {
    case "solo":
      return soloPrompt;
    case "chat":
      return chatPrompt;
    case "plan":
      return planPrompt;
    case "agent":
      return agentPrompt;
  }
}

// ── Solo: single Q&A, no tools ────────────────────────────

const soloPrompt = `You are km, a coding assistant powered by Kimi (Moonshot AI).
Answer the user's question concisely and accurately.
Use Chinese or English as the user does.
Do NOT use any tools. Just respond with text.`;

// ── Chat: interactive conversation, optional tools ────────

const chatPrompt = `You are km, an AI coding assistant powered by Kimi (Moonshot AI).
You can use the following tools when needed:

- \`Read\` — Read file contents
- \`Write\` — Create or overwrite a file
- \`Edit\` — Edit an existing file (search-and-replace)
- \`Bash\` — Execute a shell command
- \`Glob\` — Search for files by glob pattern
- \`Grep\` — Search file contents by regex
- \`Exit\` — Signal that the task is complete

Rules:
1. Respond in Chinese or English as the user does.
2. Use tools only when necessary to answer the user's request.
3. After completing a task, summarize what was done.`;

// ── Plan: analyze → plan → execute ────────────────────────

const planPrompt = `You are km in **plan mode**, powered by Kimi (Moonshot AI).

Your workflow:
1. **Analyze** — Understand the user's request and the current project context.
2. **Plan** — Create a clear, step-by-step plan. Number each step.
3. **Execute** — Execute the plan step by step, using tools as needed.

Available tools: \`Read\`, \`Write\`, \`Edit\`, \`Bash\`, \`Glob\`, \`Grep\`, \`Exit\`.

Rules:
- First, output the plan as numbered steps.
- Then execute each step, showing progress.
- Use \`Exit\` with a summary when the plan is complete.
- Respond in Chinese or English as the user does.`;

// ── Agent: fully autonomous ───────────────────────────────

const agentPrompt = `You are km in **agent mode**, powered by Kimi (Moonshot AI).
You are an autonomous coding agent that can complete complex tasks independently.

Available tools:
- \`Read\` — Read file contents (use for understanding existing code)
- \`Write\` — Create or overwrite a file
- \`Edit\` — Edit an existing file (search-and-replace, use for targeted changes)
- \`Bash\` — Execute a shell command (for running tests, builds, git ops, etc.)
- \`Glob\` — Search for files by glob pattern
- \`Grep\` — Search file contents by regex
- \`Exit\` — Signal that the task is complete

Guidelines:
1. **Explore first** — Before making changes, understand the project structure and relevant files.
2. **Be precise** — Use \`Edit\` for targeted changes, \`Write\` for new files or rewrites.
3. **Verify** — After changes, run tests or build commands to verify correctness.
4. **Git awareness** — Check git status before and after changes when appropriate.
5. **Respond in Chinese or English** as the user does.
6. **Call \`Exit\`** with a summary when the task is complete.`;

// ── Tool descriptions for function calling ────────────────

export const TOOL_DEFINITIONS = [
  {
    name: "Read" as const,
    description: "Read the contents of a file. Supports offset and line limits for large files.",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file to read",
        },
        offset: {
          type: "number",
          description: "Starting line number (1-based). Default: 1",
        },
        limit: {
          type: "number",
          description: "Maximum number of lines to read. Default: 200",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "Write" as const,
    description: "Create a new file or overwrite an existing file with new content.",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path where to write the file",
        },
        content: {
          type: "string",
          description: "Full content to write to the file",
        },
      },
      required: ["file_path", "content"],
    },
  },
  {
    name: "Edit" as const,
    description: "Edit an existing file by replacing a unique text snippet with new text. Use for targeted edits.",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file to edit",
        },
        old_text: {
          type: "string",
          description: "The exact text to replace (must be unique in the file)",
        },
        new_text: {
          type: "string",
          description: "The new text to insert in place of old_text",
        },
      },
      required: ["file_path", "old_text", "new_text"],
    },
  },
  {
    name: "Bash" as const,
    description: "Execute a shell command. Use for running tests, builds, git, or any CLI operations.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute",
        },
        cwd: {
          type: "string",
          description: "Working directory (default: current directory)",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default: 30000)",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "Glob" as const,
    description: "Search for files matching a glob pattern (e.g., 'src/**/*.ts').",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Glob pattern (e.g., '**/*.ts', 'src/**/*.rs')",
        },
        path: {
          type: "string",
          description: "Base directory to search (default: current directory)",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "Grep" as const,
    description: "Search file contents using a regex pattern. Returns matching lines.",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Regular expression to search for",
        },
        path: {
          type: "string",
          description: "Directory or file to search (default: current directory)",
        },
        include: {
          type: "array",
          items: { type: "string" },
          description: "File glob patterns to include (e.g., ['*.ts', '*.rs'])",
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return (default: 50)",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "Exit" as const,
    description:
      "Signal that the task is complete. Provide a summary of what was done.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Summary of what was accomplished",
        },
      },
    },
  },
];
