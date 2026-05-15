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

  printInfo(`Tools available: ${tools.map((t) => t.name).join(", ")}`);
  printInfo("Interactive agent mode — type /exit to quit");
  divider();

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    const input = await rl.question(`\n${cyan("▸")} `);
    if (!input.trim()) continue;
    if (input.trim() === "/exit") break;

    const result = await runAgentLoop({
      systemPrompt,
      userMessage: input,
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

    if (!result.success) {
      printError(result.error || "Unknown error");
    }
  }

  rl.close();
  printExit();
}
