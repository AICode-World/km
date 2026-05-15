import { ChatOptions, Message } from "../types.js";
import { buildSystemPrompt } from "../llm/prompts.js";
import { chat } from "../llm/client.js";
import {
  printHeader,
  printUserMessage,
  printAssistantMessage,
  printError,
  printInfo,
  printExit,
  divider,
  readMultilineInput,
} from "../display.js";
import { runAgentLoop } from "../agent/loop.js";

/** Chat mode: interactive conversation with optional tool access */
export async function runChat(options?: ChatOptions): Promise<void> {
  printHeader("chat");

  const systemPrompt = buildSystemPrompt("chat", options?.system_hint);
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
  ];

  // Session tracking
  let lastUserMessage = "";
  let retryInProgress = false;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  printInfo("Type /help for available commands");

  // Get first input
  let userInput = await readMultilineInput("Ask anything");

  while (userInput && userInput !== "/exit") {
    // ── Built-in commands ──────────────────────────────
    if (userInput.startsWith("/")) {
      if (userInput === "/help") {
        printInfo("Available commands:");
        console.log(`  ${bold("/exit")}     Exit chat`);
        console.log(`  ${bold("/help")}     Show this help`);
        console.log(`  ${bold("/clear")}    Clear screen and reset conversation`);
        console.log(`  ${bold("/retry")}    Retry last message`);
        console.log(`  ${bold("/cost")}     Show accumulated token usage`);
        console.log(`  ${bold("/compact")}  Summarize older messages to save context`);
        userInput = await readMultilineInput("Continue");
        continue;
      }

      if (userInput === "/clear") {
        console.clear();
        printHeader("chat");
        // Reset messages (keep system prompt)
        messages.length = 1;
        totalPromptTokens = 0;
        totalCompletionTokens = 0;
        printInfo("Conversation reset");
        userInput = await readMultilineInput("Ask anything");
        continue;
      }

      if (userInput === "/cost") {
        const total = totalPromptTokens + totalCompletionTokens;
        console.log(`  ${dim("Prompt tokens:")}     ${Math.round(totalPromptTokens)}`);
        console.log(`  ${dim("Completion tokens:")}  ${Math.round(totalCompletionTokens)}`);
        console.log(`  ${dim("Total:")}              ${Math.round(total)}`);
        userInput = await readMultilineInput("Continue");
        continue;
      }

      if (userInput === "/retry") {
        if (!lastUserMessage) {
          printInfo("Nothing to retry yet");
          userInput = await readMultilineInput("Continue");
          continue;
        }
        // Find and remove the last user message from messages array
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === "user") {
            if (i + 1 < messages.length && messages[i + 1].role === "assistant") {
              messages.splice(i, 2);
            } else {
              messages.splice(i, 1);
            }
            break;
          }
        }
        printInfo(`Retrying: ${lastUserMessage}`);
        retryInProgress = true;
        userInput = lastUserMessage;
        continue;
      }

      if (userInput === "/compact") {
        if (messages.length <= 3) {
          printInfo("Conversation too short to compact");
        } else {
          // Keep: system prompt + last 3 messages
          // Summarize everything in between
          const systemMsg = messages[0];
          const keepCount = Math.min(3, messages.length - 1);
          const keepMessages = messages.slice(-keepCount);
          const summarizeCount = messages.length - 1 - keepCount;
          printInfo(`Compacting ${summarizeCount} older messages...`);

          // Build a summary using the LLM itself
          const summaryPrompt = "Summarize the following conversation concisely. Focus on key decisions, facts established, and any code or commands discussed.";
          try {
            // chat is already imported at top of file
            const summaryResult = await chat([
              { role: "system", content: summaryPrompt },
              { role: "user", content: JSON.stringify(messages.slice(1, -keepCount).map(m => ({ role: m.role, content: m.content }))) }
            ]);
            const summary = summaryResult.content || "(summary unavailable)";
            messages.length = 0;
            messages.push(systemMsg);
            messages.push({ role: "system", content: `[Previous context summary: ${summary}]` });
            messages.push(...keepMessages);
            printSuccess(`Compacted ${summarizeCount} messages into summary`);
          } catch (err) {
            printError(`Compact failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        userInput = await readMultilineInput("Continue");
        continue;
      }

      // Unknown command
      printError(`Unknown command: ${userInput}. Type /help for available commands.`);
      userInput = await readMultilineInput("Continue");
      continue;
    }

    // ── Retry mode ─────────────────────────────────────
    if (retryInProgress) {
      retryInProgress = false;
      // Fall through to normal message processing below
    }

    // ── Skip empty input ───────────────────────────────
    if (!userInput.trim()) {
      userInput = await readMultilineInput("\nAsk anything");
      continue;
    }

    // ── Normal message ─────────────────────────────────
    printUserMessage(userInput);
    messages.push({ role: "user", content: userInput });
    lastUserMessage = userInput;

    try {
      const response = await chat(messages, {
        model: options?.model,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.max_tokens,
        tools: undefined,
      });

      if (response.content) {
        printAssistantMessage(response.content);
      }

      if (response.usage) {
        totalPromptTokens += response.usage.prompt_tokens;
        totalCompletionTokens += response.usage.completion_tokens;
        printInfo(
          `Tokens: ${response.usage.prompt_tokens}↑ ${response.usage.completion_tokens}↓ = ${response.usage.total_tokens} total`
        );
      } else {
        // Estimate if usage not returned
        totalPromptTokens += userInput.length / 4;
        totalCompletionTokens += (response.content?.length || 0) / 4;
      }

      messages.push({ role: "assistant", content: response.content || "" });
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err));
    }

    divider();
    userInput = await readMultilineInput("Continue");
  }

  printExit();
}