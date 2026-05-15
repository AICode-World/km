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

  // Get first input
  const firstInput = options?.system_hint || "";
  let userInput = firstInput || await readMultilineInput("Ask anything");

  while (userInput && userInput !== "/exit") {
    if (!userInput.trim()) {
      userInput = await readMultilineInput("\nAsk anything");
      continue;
    }

    printUserMessage(userInput);
    messages.push({ role: "user", content: userInput });

    try {
      const response = await chat(messages, {
        model: options?.model,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.max_tokens,
        tools: undefined, // Chat mode: no tools by default for simplicity
      });

      if (response.content) {
        printAssistantMessage(response.content);
      }

      if (response.usage) {
        printInfo(
          `Tokens: ${response.usage.prompt_tokens}↑ ${response.usage.completion_tokens}↓ = ${response.usage.total_tokens} total`
        );
      }

      // Add assistant response to history
      messages.push({ role: "assistant", content: response.content || "" });
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err));
    }

    divider();
    userInput = await readMultilineInput("Continue");
  }

  printExit();
}
