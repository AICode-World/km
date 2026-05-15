import { ChatOptions } from "../types.js";
import { buildSystemPrompt } from "../llm/prompts.js";
import { chat } from "../llm/client.js";
import { printHeader, printUserMessage, printAssistantMessage, printError, printInfo } from "../display.js";

/** Solo mode: single Q&A, no tools */
export async function runSolo(query: string, options?: ChatOptions): Promise<void> {
  printHeader("solo");

  if (!query) {
    printError("Please provide a question. Usage: km solo <question>");
    return;
  }

  printUserMessage(query);

  try {
    const systemPrompt = buildSystemPrompt("solo", options?.system_hint);
    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: query },
    ];

    const response = await chat(messages, {
      model: options?.model,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.max_tokens,
    });

    if (response.content) {
      printAssistantMessage(response.content);
    }

    if (response.usage) {
      printInfo(
        `Tokens: ${response.usage.prompt_tokens}↑ ${response.usage.completion_tokens}↓ = ${response.usage.total_tokens} total`
      );
    }
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
  }
}
