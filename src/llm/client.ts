// OpenAI SDK replaced with native fetch (Node 18+)
import { loadConfig } from "../config.js";
import { Message, KimiModel, ToolDefinition } from "../types.js";
import { spinner, dim } from "../display.js";

/** Map our internal ToolDefinition to OpenAI ChatCompletionTool */
function toOpenAITools(defs: ToolDefinition[]) {
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
function toOpenAIMessages(msgs: Message[]) {
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

/** Create API request headers */
function apiHeaders() {
  const cfg = loadConfig();
  return {
    "Authorization": `Bearer ${cfg.api_key}`,
    "Content-Type": "application/json",
  };
}

/** Build API base URL */
function apiBaseURL(): string {
  return loadConfig().base_url;
}

// ── Public API ────────────────────────────────────────────// ── Public API ────────────────────────────────────────────

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
 * Send messages to Kimi and get a response (fetch-based, no openai SDK).
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
    const body: Record<string, unknown> = {
      model,
      messages: toOpenAIMessages(messages),
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.max_tokens ?? 16384,
      stream: false,
    };
    if (options?.tools) {
      body.tools = toOpenAITools(options.tools);
    }

    const res = await fetch(`${apiBaseURL()}/chat/completions`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify(body),
    });

    sp?.stop();

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`HTTP ${res.status} ${res.statusText} — ${errBody}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice) {
      return { content: "" };
    }

    const msg = choice.message;
    const result: LLMResponse = {
      content: msg.content || "",
      usage: data.usage
        ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens,
          }
        : undefined,
    };

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      result.tool_calls = msg.tool_calls.map((tc: any) => ({
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

  const body: Record<string, unknown> = {
    model,
    messages: toOpenAIMessages(messages),
    temperature: options?.temperature ?? 0.2,
    max_tokens: options?.max_tokens ?? 16384,
    stream: true,
  };

  const res = await fetch(`${apiBaseURL()}/chat/completions`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Kimi API error: HTTP ${res.status} — ${errBody}`);
  }

  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const chunk = JSON.parse(data);
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Skip malformed chunks
      }
    }
  }
}

/** List available models from the API *//** List available models from the API */
export async function listModels(): Promise<string[]> {
  const res = await fetch(`${apiBaseURL()}/models`, {
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to list models: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.data
    .filter((m: any) => m.id.startsWith("moonshot"))
    .map((m: any) => m.id);
}

/** Simple token count estimation (for context management) *//** Simple token count estimation (for context management) */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cnChars = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const nonCnLen = text.length - cnChars;
  return Math.ceil(cnChars * 1.5) + Math.ceil(nonCnLen / 4);
}
