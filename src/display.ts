import chalk from "chalk";
import ora from "ora";
import { createInterface } from "readline/promises";
import { ToolCall, ToolResult, RunMode } from "./types.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── Styling helpers ───────────────────────────────────────

export const dim = chalk.dim;
export const bold = chalk.bold;
export const green = chalk.green;
export const red = chalk.red;
export const yellow = chalk.yellow;
export const cyan = chalk.cyan;
export const magenta = chalk.magenta;
export const gray = chalk.gray;

/** Header banner for each mode */
export function printHeader(mode: RunMode): void {
  const _disp_dir = dirname(fileURLToPath(import.meta.url));
  let version = "0.0.0";
  try {
    const pkg = JSON.parse(readFileSync(join(_disp_dir, "..", "package.json"), "utf-8"));
    version = pkg.version;
  } catch {}
  console.log(
    `\n  ${cyan("✦")} ${bold("km")} ${dim(`v${version}`)}  —  ${modeModeLabel(mode)}\n`
  );
}

function modeModeLabel(mode: RunMode): string {
  const labels: Record<RunMode, string> = {
    solo: "Solo 问答模式",
    chat: "交互对话模式",
    plan: "计划执行模式",
    agent: "自主 Agent 模式",
  };
  return dim(labels[mode]);
}

/** Print a user message bubble */
export function printUserMessage(msg: string): void {
  console.log(`\n${cyan("┌─ You")}`);
  msg.split("\n").forEach((l) => console.log(`${cyan("│")} ${l}`));
  console.log(`${cyan("└─")}\n`);
}

/** Print an assistant message */
export function printAssistantMessage(msg: string, title = "Assistant"): void {
  console.log(`\n${green("┌─")} ${bold(title)}`);
  console.log(`${green("│")}`);
  msg.split("\n").forEach((l) => console.log(`${green("│")} ${l}`));
  console.log(`${green("└─")}\n`);
}

/** Print an error message */
export function printError(msg: string): void {
  console.log(`\n${red("✖")} ${msg}\n`);
}

/** Print a warning */
export function printWarning(msg: string): void {
  console.log(`\n${yellow("⚠")} ${msg}\n`);
}

/** Print an info line */
export function printInfo(msg: string): void {
  console.log(`${dim("ℹ")} ${msg}`);
}

/** Print a success check */
export function printSuccess(msg: string): void {
  console.log(`${green("✔")} ${msg}`);
}

/** Print a tool call happening */
export function printToolCall(tc: ToolCall): void {
  console.log(`  ${cyan("→")} ${bold(tc.function.name)} ${dim(tc.function.arguments)}`);
}

/** Print tool result */
export function printToolResult(tr: ToolResult): void {
  const icon = tr.success ? dim("✔") : red("✖");
  const lines = tr.output.split("\n").filter(Boolean);
  const preview = lines.slice(0, 5).join("\n  ");
  console.log(`  ${icon} ${dim(tr.tool_name)}${tr.success ? "" : `: ${tr.error || "failed"}"}`}`);
  if (preview) {
    console.log(`  ${dim(preview)}`);
    if (lines.length > 5) console.log(`  ${dim(`... (${lines.length - 5} more lines)`)}`);
  }
}

/** Print a divider */
export function divider(): void {
  console.log(dim("─".repeat(process.stdout.columns || 60)));
}

/** Print mode exit message */
export function printExit(): void {
  console.log(`\n${dim("Bye!")}\n`);
}

/** Create a spinner */
export function spinner(text: string) {
  return ora({ text, color: "cyan" }).start();
}

/** Format code block for display */
export function formatCodeBlock(lang: string, code: string): string {
  return `${dim(`\`\`\`${lang}`)}\n${code}\n${dim("```")}`;
}

/** Show tool approval prompt and return boolean */
export async function confirmToolCall(tc: ToolCall): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const args = tc.function.arguments;
  console.log(`\n${yellow("?")} Allow tool: ${bold(tc.function.name)}`);
  console.log(`  ${dim(args)}`);
  const answer = await rl.question(`  ${dim("Allow? (Y/n) ")}`);
  rl.close();
  return answer.toLowerCase() !== "n";
}

/** Read multi-line input from user */
export async function readMultilineInput(prompt: string): Promise<string> {
  console.log(`\n${prompt} (Ctrl+D or .done to finish)`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const lines: string[] = [];
  for await (const line of rl) {
    if (line.trim() === ".done") break;
    if (line.trim() === "/exit") { rl.close(); return "/exit"; }
    lines.push(line);
  }
  rl.close();
  return lines.join("\n");
}

/** One-line prompt */
export async function promptOneLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${cyan("?")} ${question} `);
  rl.close();
  return answer;
}

/** Prompt the user to choose one option from a short list */
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
