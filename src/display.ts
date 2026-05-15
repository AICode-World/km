// Native ANSI (replaced chalk + ora)
import { createInterface } from "readline/promises";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { ToolCall, ToolResult, RunMode } from "./types.js";

const RESET = "\x1b[0m";

function ansi(code: string) {
  return (s: string) => `${code}${s}${RESET}`;
}

export const dim = ansi("\x1b[2m");
export const bold = ansi("\x1b[1m");
export const green = ansi("\x1b[32m");
export const red = ansi("\x1b[31m");
export const yellow = ansi("\x1b[33m");
export const cyan = ansi("\x1b[36m");
export const magenta = ansi("\x1b[35m");
export const gray = ansi("\x1b[90m");

export function printHeader(mode: RunMode): void {
  const dispDir = dirname(fileURLToPath(import.meta.url));
  let version = "0.0.0";
  try {
    const pkg = JSON.parse(readFileSync(join(dispDir, "..", "package.json"), "utf-8"));
    version = pkg.version;
  } catch {
    // ignore
  }
  console.log(`\n  ${cyan("✦")} ${bold("km")} ${dim(`v${version}`)}  —  ${dim(modeModeLabel(mode))}\n`);
}

function modeModeLabel(mode: RunMode): string {
  const labels: Record<RunMode, string> = {
    solo: "Solo mode",
    chat: "Chat mode",
    plan: "Plan mode",
    agent: "Agent mode",
  };
  return labels[mode];
}

export function printUserMessage(msg: string): void {
  console.log(`\n${cyan("┏")} You`);
  msg.split("\n").forEach((l) => console.log(`${cyan("┃")} ${l}`));
  console.log(`${cyan("┗")}\n`);
}

export function printAssistantMessage(msg: string, title = "Assistant"): void {
  console.log(`\n${green("┏")} ${bold(title)}`);
  console.log(`${green("┃")}`);
  msg.split("\n").forEach((l) => console.log(`${green("┃")} ${l}`));
  console.log(`${green("┗")}\n`);
}

export function printError(msg: string): void {
  console.log(`\n${red("✗")} ${msg}\n`);
}

export function printWarning(msg: string): void {
  console.log(`\n${yellow("!")} ${msg}\n`);
}

export function printInfo(msg: string): void {
  console.log(`${dim("i")} ${msg}`);
}

export function printSuccess(msg: string): void {
  console.log(`${green("✓")} ${msg}`);
}

export function printToolCall(tc: ToolCall): void {
  console.log(`  ${cyan("->")} ${bold(tc.function.name)} ${dim(tc.function.arguments)}`);
}

export function printToolResult(tr: ToolResult): void {
  const icon = tr.success ? dim("✓") : red("✗");
  const lines = tr.output.split("\n").filter(Boolean);
  const preview = lines.slice(0, 5).join("\n  ");
  console.log(`  ${icon} ${dim(tr.tool_name)}${tr.success ? "" : `: ${tr.error || "failed"}`}`);
  if (preview) {
    console.log(`  ${dim(preview)}`);
    if (lines.length > 5) console.log(`  ${dim(`... (${lines.length - 5} more lines)`)}`);
  }
}

export function divider(): void {
  console.log(dim("=".repeat(process.stdout.columns || 60)));
}

export function printExit(): void {
  console.log(`\n${dim("Bye!")}\n`);
}

const SPINNER_FRAMES = ["-", "\\", "|", "/"];

export function spinner(text: string) {
  let i = 0;
  const id = setInterval(() => {
    process.stdout.write(`\r\x1b[36m${SPINNER_FRAMES[i]}\x1b[0m ${text}`);
    i = (i + 1) % SPINNER_FRAMES.length;
  }, 80);

  function clearLine() {
    process.stdout.write("\r" + " ".repeat(process.stdout.columns || 60) + "\r");
  }

  return {
    stop() {
      clearInterval(id);
      clearLine();
    },
    succeed(t?: string) {
      clearInterval(id);
      clearLine();
      console.log(`\x1b[32m✓\x1b[0m ${t || text}`);
    },
    fail(t?: string) {
      clearInterval(id);
      clearLine();
      console.log(`\x1b[31m✗\x1b[0m ${t || text}`);
    },
  };
}

export function formatCodeBlock(lang: string, code: string): string {
  return `${dim(`\`\`\`${lang}`)}\n${code}\n${dim("```")}`;
}

export async function confirmToolCall(tc: ToolCall): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const args = tc.function.arguments;
  console.log(`\n${yellow("?")} Allow tool: ${bold(tc.function.name)}`);
  console.log(`  ${dim(args)}`);
  const answer = await rl.question(`  ${dim("Allow? (Y/n) ")}`);
  rl.close();
  return answer.toLowerCase() !== "n";
}

export async function readMultilineInput(prompt: string): Promise<string> {
  console.log(`\n${prompt} (Ctrl+D or .done to finish)`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const lines: string[] = [];
  for await (const line of rl) {
    if (line.trim() === ".done") break;
    if (line.trim() === "/exit") {
      rl.close();
      return "/exit";
    }
    lines.push(line);
  }
  rl.close();
  return lines.join("\n");
}

export async function promptOneLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${cyan("?")} ${question} `);
  rl.close();
  return answer;
}

export async function promptChoice(question: string, choices: string[], defaultChoice?: string): Promise<string> {
  console.log(`\n${question}`);
  choices.forEach((choice, idx) => console.log(`  ${dim(String(idx + 1).padStart(2, "0"))} ${choice}`));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultChoice ? ` (default: ${defaultChoice})` : "";
  const answer = await rl.question(`${cyan("?")} Choose one${suffix}: `);
  rl.close();
  const trimmed = answer.trim();
  if (!trimmed && defaultChoice) return defaultChoice;
  if (/^\d+$/.test(trimmed)) {
    const idx = Number(trimmed) - 1;
    if (idx >= 0 && idx < choices.length) return choices[idx];
  }
  return trimmed || defaultChoice || choices[0];
}
