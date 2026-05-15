import OpenAI from "openai";
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions.js";
import { loadConfig } from "../config.js";
import { Message, KimiModel, ToolDefinition } from "../types.js";
import { spinner, dim } from "../display.js";

/** Map our internal ToolDefinition to OpenAI ChatCompletionTool */
function toOpenAITools(defs: ToolDefinition[]): ChatCompletionTool[] {
  return defs.map((d) => ({
    type: "function" as const,
    function: {
      name: d.name,
      description: d.description,
      parameters: d.input_schema as Record<string, unknown>,
    },
  }));
}

/** Map our internal Message to OpenAI message format */
function toOpenAIMessages(msgs: Message[]): ChatCompletionMessageParam[] {
  const result: ChatCompletionMessageParam[] = [];
  for (const m of msgs) {
    if (m.role === "system") {
      result.push({ role: "system", content: m.content });
    } else if (m.role === "user") {
      result.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const msg: ChatCompletionMessageParam = {
        role: "assistant",
        content: m.content || null,
      };
      if (m.tool_calls && m.tool_calls.length > 0) {
        msg.tool_calls = m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        }));
      }
      result.push(msg);
    } else if (m.role === "tool") {
      result.push({
        role: "tool",
        tool_call_id: m.tool_call_id || "",
        content: m.content,
      });
    }
  }
  return result;
}

/** Create a fresh OpenAI client */
function createClient(): OpenAI {
  const cfg = loadConfig();
  return new OpenAI({
    apiKey: cfg.api_key,
    baseURL: cfg.base_url,
    maxRetries: 3,
  });
}

// ── Public API ────────────────────────────────────────────

export interface LLMResponse {
  content: string;
  tool_calls?: Message["tool_calls"];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Send messages to Kimi and get a response (streaming with spinner).
 * If tool_defs is provided, function calling is enabled.
 */
export async function chat(
  messages: Message[],
  options?: {
    model?: KimiModel;
    tools?: ToolDefinition[];
    temperature?: number;
    max_tokens?: number;
    show_spinner?: boolean;
  }
): Promise<LLMResponse> {
  const cfg = loadConfig();
  const model = options?.model || cfg.model;
  const sp = options?.show_spinner !== false ? spinner(`Thinking (${model})…`) : null;

  try {
    const client = createClient();
    const openaiMessages = toOpenAIMessages(messages);
    const openaiTools = options?.tools ? toOpenAITools(options.tools) : undefined;

    const response = await client.chat.completions.create({
      model,
      messages: openaiMessages,
      tools: openaiTools,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.max_tokens ?? 16384,
      stream: false,
    });

    sp?.stop();

    const choice = response.choices[0];
    if (!choice) {
      return { content: "" };
    }

    const msg = choice.message;
    const result: LLMResponse = {
      content: msg.content || "",
      usage: response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
          }
        : undefined,
    };

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      result.tool_calls = msg.tool_calls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      }));
    }

    return result;
  } catch (err) {
    sp?.stop();
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Kimi API error: ${message}`);
  }
}

/**
 * Streaming chat — yields text chunks as they arrive.
 * Does NOT support tool calls in streaming mode for simplicity.
 */
export async function* chatStreaming(
  messages: Message[],
  options?: {
    model?: KimiModel;
    temperature?: number;
    max_tokens?: number;
  }
): AsyncGenerator<string> {
  const cfg = loadConfig();
  const model = options?.model || cfg.model;

  const client = createClient();
  const openaiMessages = toOpenAIMessages(messages);

  const stream = await client.chat.completions.create({
    model,
    messages: openaiMessages,
    temperature: options?.temperature ?? 0.2,
    max_tokens: options?.max_tokens ?? 16384,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
}

/** List available models from the API */
export async function listModels(): Promise<string[]> {
  const cfg = loadConfig();
  const client = createClient();
  const response = await client.models.list();
  return response.data
    .filter((m) => m.id.startsWith("moonshot"))
    .map((m) => m.id);
}

/** Simple token count estimation (for context management) */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cnChars = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const nonCnLen = text.length - cnChars;
  return Math.ceil(cnChars * 1.5) + Math.ceil(nonCnLen / 4);
}
