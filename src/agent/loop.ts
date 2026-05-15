import { loadConfig } from "../config.js";
import { Message, ToolCall, ToolResult, ToolDefinition, KimiModel, ToolName } from "../types.js";
import { chat as llmChat } from "../llm/client.js";
import { printToolCall, printToolResult, printAssistantMessage, printError } from "../display.js";
import { executeTool, getToolDefinitions } from "../tools/registry.js";

export interface AgentLoopOptions {
  /** System prompt */
  systemPrompt: string;
  /** Initial user message */
  userMessage: string;
  /** Whether to auto-approve tool calls */
  autoApprove?: boolean;
  /** Tool definitions available */
  tools?: ToolDefinition[];
  /** Max tool call iterations */
  maxToolRounds?: number;
  /** Model to use */
  model?: KimiModel;
  /** Temperature */
  temperature?: number;
  /** Callback for each assistant text chunk */
  onToken?: (token: string) => void;
  /** Callback for final response */
  onResponse?: (content: string) => void;
}

export interface AgentLoopResult {
  content: string;
  toolCalls: number;
  rounds: number;
  success: boolean;
  error?: string;
}

/**
 * Core agent loop:
 * 1. Send messages (system + user + history) to LLM
 * 2. If response has tool_calls → execute each → add results → go to 1
 * 3. If response is text → return
 */
export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const cfg = loadConfig();
  const tools = options.tools ?? getToolDefinitions();
  const maxRounds = options.maxToolRounds ?? cfg.max_tool_rounds;
  const autoApprove = options.autoApprove ?? cfg.auto_approve;

  const messages: Message[] = [
    { role: "system", content: options.systemPrompt },
    { role: "user", content: options.userMessage },
  ];

  let rounds = 0;
  let totalToolCalls = 0;

  while (rounds < maxRounds) {
    rounds++;

    // 1. Call LLM
    const response = await llmChat(messages, {
      model: options.model,
      tools,
      temperature: options.temperature ?? 0.2,
      show_spinner: true,
    });

    // 2. Check for tool calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Add assistant message with tool calls to history
      messages.push({
        role: "assistant",
        content: response.content || "",
        tool_calls: response.tool_calls,
      });

      // 3. Execute each tool call
      for (const tc of response.tool_calls) {
        totalToolCalls++;

        // Approval check
        if (!autoApprove) {
          printToolCall(tc);
          // In agent mode with autoApprove=false, we just log and proceed
          // For more strict control, we could prompt here
        }

        // Parse arguments
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }

        // Execute
        if (!isToolName(tc.function.name)) {
          printError(`Unknown tool requested by model: ${tc.function.name}`);
          continue;
        }

        const result = await executeTool(tc.function.name, args);

        // Log
        if (!autoApprove) {
          printToolResult(result);
        }

        // Add tool result to messages
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
          name: tc.function.name,
        });

        // If Exit was called, return immediately
        if (tc.function.name === "Exit") {
          const finalContent = response.content || result.output;
          options.onResponse?.(finalContent);
          return {
            content: finalContent,
            toolCalls: totalToolCalls,
            rounds,
            success: result.success,
          };
        }
      }

      // Continue loop for next round of thinking
      continue;
    }

    // 4. Text response — done
    const content = response.content;
    options.onResponse?.(content);

    return {
      content,
      toolCalls: totalToolCalls,
      rounds,
      success: true,
    };
  }

  // Max rounds reached
  const error = `Reached maximum tool call rounds (${maxRounds})`;
  printError(error);
  return {
    content: "",
    toolCalls: totalToolCalls,
    rounds,
    success: false,
    error,
  };
}

function isToolName(name: string): name is ToolName {
  return name === "Read"
    || name === "Write"
    || name === "Edit"
    || name === "Bash"
    || name === "Glob"
    || name === "Grep"
    || name === "Exit";
}
