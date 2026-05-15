import { AgentOptions } from "../types.js";
import { createInterface } from "readline/promises";
import { buildSystemPrompt } from "../llm/prompts.js";
import { getToolDefinitions } from "../tools/registry.js";
import {
  printHeader,
  printAssistantMessage,
  printError,
  printSuccess,
  printInfo,
  printExit,
  divider,
  bold,
  cyan,
  dim,
  yellow,
} from "../display.js";
import { loadConfig, saveConfig, setRuntimeConfig } from "../config.js";
import { runAgentLoop } from "../agent/loop.js";

/**
 * Agent mode: fully autonomous with full tool access.
 * Accepts a task, explores the project, makes changes, verifies.
 */
export async function runAgent(task: string, options?: AgentOptions): Promise<void> {
  printHeader("agent");

  if (!task) {
    printError("Please provide a task. Usage: km agent <task>");
    return;
  }

  const systemPrompt = buildSystemPrompt("agent", options?.system_hint);
  const tools = getToolDefinitions();

  console.log(`\n${cyan("✦")} ${bold("Task:")} ${task}`);
  printInfo(`Tools available: ${tools.map((t) => t.name).join(", ")}`);
  printInfo(`Max tool rounds: ${options?.max_tool_rounds ?? 25}`);
  divider();

  const result = await runAgentLoop({
    systemPrompt,
    userMessage: task,
    tools,
    model: options?.model,
    temperature: options?.temperature ?? 0.2,
    maxToolRounds: options?.max_tool_rounds,
    autoApprove: options?.auto_approve ?? false,
    onResponse: (content) => {
      if (content && content !== "Exit") {
        printAssistantMessage(content, "Agent");
      }
    },
  });

  divider();

  if (result.success) {
    printSuccess(
      `Task completed in ${result.rounds} round(s) with ${result.toolCalls} tool call(s)`
    );
  } else {
    if (result.error?.includes("Maximum tool call rounds")) {
      printInfo("The task may still be in progress. Consider increasing max-tool-rounds.");
    }
    printError(`Task failed: ${result.error}`);
  }

  printExit();
}

/**
 * Interactive agent mode — maintains conversation across turns.
 * Tools remain available across user inputs.
 */
export async function runAgentInteractive(options?: AgentOptions): Promise<void> {
  printHeader("agent");

  const systemPrompt = buildSystemPrompt("agent", options?.system_hint);
  const tools = getToolDefinitions();

  // Session tracking
  let lastInput = "";
  let lastFailed = false;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  printInfo(`Tools available: ${tools.map((t) => t.name).join(", ")}`);
  printInfo("Type /help for available commands");
  divider();

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    const input = await rl.question(`\n${cyan("▸")} `);
    if (!input.trim()) continue;

    // ── Built-in commands ──────────────────────────────
    const cmd = input.trim();

    if (cmd === "/exit") break;

    if (cmd === "/help") {
      printInfo("Available commands:");
      console.log(`  ${bold("/exit")}      Exit interactive mode`);
      console.log(`  ${bold("/help")}      Show this help`);
      console.log(`  ${bold("/model")}     Switch model: /model <name>`);
      console.log(`  ${bold("/clear")}     Clear screen`);
      console.log(`  ${bold("/retry")}     Retry last failed message`);
      console.log(`  ${bold("/cost")}      Show accumulated token usage`);
      continue;
    }

    if (cmd === "/clear") {
      console.clear();
      printHeader("agent");
      printInfo("Session cleared (context preserved)");
      continue;
    }

    if (cmd === "/cost") {
      const total = totalPromptTokens + totalCompletionTokens;
      console.log(`  ${dim("Prompt tokens:")}     ${totalPromptTokens}`);
      console.log(`  ${dim("Completion tokens:")}  ${totalCompletionTokens}`);
      console.log(`  ${dim("Total:")}              ${total}`);
      continue;
    }

    if (cmd === "/retry") {
      if (!lastInput) {
        printInfo("Nothing to retry yet");
        continue;
      }
      if (!lastFailed) {
        printInfo("Last message succeeded, use /retry only after a failure");
        continue;
      }
      printInfo(`Retrying: ${lastInput}`);
      // Fall through to execute
    }

    if (cmd.startsWith("/model")) {
      const parts = cmd.split(/\s+/);
      const newModel = parts[1];
      if (newModel) {
        saveConfig({ model: newModel });
        setRuntimeConfig({ model: newModel as any });
        printSuccess(`Model changed to: ${newModel}`);
      } else {
        const cfg = loadConfig();
        printInfo(`Current model: ${cfg.model}`);
        printInfo("Usage: /model <model-name>");
        printInfo(`  e.g. /model moonshot-v1-32k`);
      }
      continue;
    }

    if (cmd.startsWith("/")) {
      printError(`Unknown command: ${cmd}. Type /help for available commands.`);
      continue;
    }

    // ── Normal message ────────────────────────────────
    lastInput = cmd;
    lastFailed = false;

    const result = await runAgentLoop({
      systemPrompt,
      userMessage: cmd,
      tools,
      model: options?.model,
      temperature: options?.temperature ?? 0.2,
      maxToolRounds: options?.max_tool_rounds,
      autoApprove: options?.auto_approve ?? false,
      onResponse: (content) => {
        if (content) {
          printAssistantMessage(content, "Agent");
        }
      },
    });

    if (result.success) {
      lastFailed = false;
      // Estimate token usage — runAgentLoop doesn't expose usage, so we estimate based on I/O
      totalPromptTokens += cmd.length / 4;
      totalCompletionTokens += (result.content?.length || 0) / 4;
    } else {
      lastFailed = true;
      printError(result.error || "Unknown error");
    }
  }

  rl.close();
  printExit();
}