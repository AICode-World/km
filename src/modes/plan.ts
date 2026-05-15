import { PlanOptions } from "../types.js";
import { createInterface } from "readline/promises";
import { buildSystemPrompt } from "../llm/prompts.js";
import {
  printHeader,
  printAssistantMessage,
  printError,
  printSuccess,
  printInfo,
  divider,
  bold,
  cyan,
  dim,
  green,
  yellow,
} from "../display.js";
import { runAgentLoop } from "../agent/loop.js";

/**
 * Plan mode:
 * 1. LLM analyzes the request and creates a structured plan
 * 2. Plan is shown to the user
 * 3. User can approve or modify the plan
 * 4. Each step is executed sequentially with tool access
 */
export async function runPlan(task: string, options?: PlanOptions): Promise<void> {
  printHeader("plan");

  if (!task) {
    printError("Please provide a task. Usage: km plan <task>");
    return;
  }

  const systemPrompt = buildSystemPrompt("plan", options?.system_hint);

  console.log(`\n${cyan("✦")} ${bold("Task:")} ${task}\n`);

  // Execute the full plan loop
  const result = await runAgentLoop({
    systemPrompt,
    userMessage: task,
    model: options?.model,
    temperature: options?.temperature ?? 0.2,
    maxToolRounds: options?.max_tool_rounds,
    autoApprove: true,
    onResponse: (content) => {
      if (content) {
        printAssistantMessage(content, "Plan Result");
      }
    },
  });

  if (result.success) {
    printSuccess(`Plan execution completed in ${result.rounds} round(s) with ${result.toolCalls} tool call(s)`);
  } else {
    printError(`Plan execution failed: ${result.error}`);
  }

  divider();
}

/** Interactive plan mode where user can approve each step */
export async function runPlanInteractive(task: string, options?: PlanOptions): Promise<void> {
  printHeader("plan");

  if (!task) {
    printError("Please provide a task.");
    return;
  }

  const systemPrompt = buildSystemPrompt("plan", options?.system_hint);

  console.log(`\n${cyan("✦")} ${bold("Task:")} ${task}\n`);

  // Phase 1: Generate plan
  printInfo("Analyzing request and creating plan...");

  const planResult = await runAgentLoop({
    systemPrompt,
    userMessage: `Analyze this task and create a step-by-step plan:\n\n${task}\n\nOutput the plan as numbered steps. Do NOT execute anything yet, just output the plan.`,
    model: options?.model,
    temperature: 0.3,
    maxToolRounds: 3,
    autoApprove: true,
    onResponse: (content) => {
      if (content) {
        printAssistantMessage(content, "Plan");
      }
    },
  });

  if (!planResult.success) {
    printError("Failed to create plan");
    return;
  }

  divider();

  // Phase 2: Ask for approval
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${yellow("?")} Execute this plan? (Y/n) `);
  rl.close();

  if (answer.toLowerCase() === "n") {
    printInfo("Plan cancelled.");
    return;
  }

  divider();

  // Phase 3: Execute plan
  printInfo("Executing plan...");

  const execResult = await runAgentLoop({
    systemPrompt: `${systemPrompt}\n\nThe plan has been approved. Execute each step now.`,
    userMessage: `Execute the plan step by step for this task:\n\n${task}`,
    model: options?.model,
    temperature: 0.2,
    maxToolRounds: options?.max_tool_rounds ?? 30,
    autoApprove: true,
    onResponse: (content) => {
      if (content) {
        printAssistantMessage(content, "Execution Result");
      }
    },
  });

  if (execResult.success) {
    printSuccess(
      `Plan executed successfully in ${execResult.rounds} round(s) with ${execResult.toolCalls} tool call(s)`
    );
  } else {
    printError(`Execution failed: ${execResult.error}`);
  }

  divider();
}
