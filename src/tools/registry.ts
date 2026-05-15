import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { join, resolve, relative } from "path";
import { execSync } from "child_process";
import { mkdirSync } from "fs";
import { globSync } from "glob";
import {
  ToolName,
  ToolDefinition,
  ToolResult,
  ReadParams,
  WriteParams,
  EditParams,
  BashParams,
  GlobParams,
  GrepParams,
  ExitParams,
} from "../types.js";
import { TOOL_DEFINITIONS } from "../llm/prompts.js";

export { TOOL_DEFINITIONS };

/** Get tool definitions for function calling API */
export function getToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}

/** Map tool name to definition */
export function getToolDefinition(name: ToolName): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.name === name);
}

// ── Tool execution ────────────────────────────────────────

export async function executeTool(
  name: ToolName,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (name) {
    case "Read":
      return executeRead(args as unknown as ReadParams);
    case "Write":
      return executeWrite(args as unknown as WriteParams);
    case "Edit":
      return executeEdit(args as unknown as EditParams);
    case "Bash":
      return executeBash(args as unknown as BashParams);
    case "Glob":
      return executeGlob(args as unknown as GlobParams);
    case "Grep":
      return executeGrep(args as unknown as GrepParams);
    case "Exit":
      return executeExit(args as unknown as ExitParams);
    default:
      return {
        tool_name: name,
        success: false,
        output: "",
        error: `Unknown tool: ${name}`,
      };
  }
}

// ── Read ──────────────────────────────────────────────────

function executeRead(params: ReadParams): ToolResult {
  try {
    const filePath = resolve(params.file_path);
    if (!existsSync(filePath)) {
      return {
        tool_name: "Read",
        success: false,
        output: "",
        error: `File not found: ${params.file_path}`,
      };
    }

    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const offset = params.offset ?? 1;
    const limit = params.limit ?? 500;

    const startIdx = Math.max(0, offset - 1);
    const endIdx = Math.min(lines.length, startIdx + limit);
    const selected = lines.slice(startIdx, endIdx);
    const totalLines = lines.length;
    const meta = `File: ${params.file_path} (${totalLines} lines, showing ${startIdx + 1}–${endIdx})`;

    return {
      tool_name: "Read",
      success: true,
      output: `${meta}\n${selected.join("\n")}`,
    };
  } catch (err) {
    return {
      tool_name: "Read",
      success: false,
      output: "",
      error: String(err),
    };
  }
}

// ── Write ─────────────────────────────────────────────────

function executeWrite(params: WriteParams): ToolResult {
  try {
    const filePath = resolve(params.file_path);
    const dir = filePath.substring(0, Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\")));
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, params.content, "utf-8");
    return {
      tool_name: "Write",
      success: true,
      output: `Written ${params.content.length} bytes to ${params.file_path}`,
    };
  } catch (err) {
    return {
      tool_name: "Write",
      success: false,
      output: "",
      error: String(err),
    };
  }
}

// ── Edit ──────────────────────────────────────────────────

function executeEdit(params: EditParams): ToolResult {
  try {
    const filePath = resolve(params.file_path);
    if (!existsSync(filePath)) {
      return {
        tool_name: "Edit",
        success: false,
        output: "",
        error: `File not found: ${params.file_path}`,
      };
    }

    const content = readFileSync(filePath, "utf-8");
    const { old_text, new_text } = params;

    const idx = content.indexOf(old_text);
    if (idx === -1) {
      return {
        tool_name: "Edit",
        success: false,
        output: "",
        error: `Could not find old_text in ${params.file_path}. Note: old_text must match exactly.`,
      };
    }

    const newContent = content.replace(old_text, new_text);
    writeFileSync(filePath, newContent, "utf-8");

    return {
      tool_name: "Edit",
      success: true,
      output: `Applied edit to ${params.file_path} (replaced ${old_text.length} chars)`,
    };
  } catch (err) {
    return {
      tool_name: "Edit",
      success: false,
      output: "",
      error: String(err),
    };
  }
}

// ── Bash ──────────────────────────────────────────────────

function executeBash(params: BashParams): ToolResult {
  try {
    const cwd = params.cwd ? resolve(params.cwd) : process.cwd();
    const timeout = params.timeout ?? 30_000;

    const output = execSync(params.command, {
      cwd,
      timeout,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB
      windowsHide: true,
    });

    return {
      tool_name: "Bash",
      success: true,
      output: output.trim() || "(command completed with no output)",
    };
  } catch (err) {
    const error = err as Error & { stdout?: string; stderr?: string };
    const stderr = error.stderr || "";
    const stdout = error.stdout || "";
    const message = error.message || String(err);
    return {
      tool_name: "Bash",
      success: false,
      output: stdout.trim(),
      error: stderr || message,
    };
  }
}

// ── Glob ──────────────────────────────────────────────────

function executeGlob(params: GlobParams): ToolResult {
  try {
    const baseDir = params.path ? resolve(params.path) : process.cwd();
    const matches = globSync(params.pattern, {
      cwd: baseDir,
      nodir: false,
      dot: true,
    });

    if (matches.length === 0) {
      return {
        tool_name: "Glob",
        success: true,
        output: `No files matching "${params.pattern}" in ${baseDir}`,
      };
    }

    const maxShow = 200;
    const shown = matches.slice(0, maxShow);
    const lines = shown.map((f) => {
      const full = join(baseDir, f);
      const isDir = existsSync(full) && statSync(full).isDirectory();
      return isDir ? `${f}/` : f;
    });

    let output = `Found ${matches.length} matches:\n${lines.join("\n")}`;
    if (matches.length > maxShow) {
      output += `\n... and ${matches.length - maxShow} more`;
    }

    return {
      tool_name: "Glob",
      success: true,
      output,
    };
  } catch (err) {
    return {
      tool_name: "Glob",
      success: false,
      output: "",
      error: String(err),
    };
  }
}

// ── Grep ──────────────────────────────────────────────────

function executeGrep(params: GrepParams): ToolResult {
  try {
    const basePath = params.path ? resolve(params.path) : process.cwd();
    const pattern = params.pattern;
    const maxResults = params.max_results ?? 50;
    const isWindows = process.platform === "win32";
    const nullRedirect = isWindows ? "2>nul" : "2>/dev/null";

    // Use the pattern directly with grep/ripgrep
    // Fallback to a simple implementation
    let command: string;

    if (params.include && params.include.length > 0) {
      const includes = params.include.map((i) => `--include="${i}"`).join(" ");
      command = `grep -rn --binary-files=without-match ${includes} "${pattern}" "${basePath}" ${nullRedirect} || echo "no matches"`;
    } else {
      command = `grep -rn --binary-files=without-match "${pattern}" "${basePath}" ${nullRedirect} || echo "no matches"`;
    }

    const output = execSync(command, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15_000,
      windowsHide: true,
    });

    const lines = output.split("\n").filter((l) => l.trim());
    if (lines.length === 0 || (lines.length === 1 && lines[0] === "no matches")) {
      return {
        tool_name: "Grep",
        success: true,
        output: `No matches for /${pattern}/`,
      };
    }

    const shown = lines.slice(0, maxResults);
    let result = `Found ${lines.length} matches for /${pattern}/:\n${shown.join("\n")}`;
    if (lines.length > maxResults) {
      result += `\n... and ${lines.length - maxResults} more matches`;
    }

    return {
      tool_name: "Grep",
      success: true,
      output: result,
    };
  } catch (err) {
    return {
      tool_name: "Grep",
      success: false,
      output: "",
      error: String(err),
    };
  }
}

// ── Exit ──────────────────────────────────────────────────

function executeExit(params: ExitParams): ToolResult {
  return {
    tool_name: "Exit",
    success: true,
    output: params.reason || "Task completed",
  };
}
