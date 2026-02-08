import type { LLMRequest, LLMResponse, StreamChunk } from "@/types";

/**
 * Abstract LLM provider interface.
 * All providers implement this contract, enabling clean switching.
 */
export interface LLMProvider {
  /** Human-readable name */
  readonly name: string;

  /** Send a chat completion request and return the full response */
  complete(request: LLMRequest): Promise<LLMResponse>;

  /** Send a streaming chat completion request */
  stream(
    request: LLMRequest,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<LLMResponse>;

  /** Test that the provider connection works */
  testConnection(): Promise<boolean>;
}

/**
 * Estimate token count for a string using a simple heuristic.
 * ~4 characters per token on average for English text.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Build the standard headers for an OpenAI-compatible API request.
 */
export function buildHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  if (extra) {
    Object.assign(headers, extra);
  }
  return headers;
}

/**
 * Parse an SSE stream from a fetch Response.
 * Yields the `data:` payloads as parsed JSON.
 */
export async function* parseSSEStream(
  response: Response,
): AsyncGenerator<Record<string, unknown>> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      if (trimmed === "data: [DONE]") return;
      if (trimmed.startsWith("data: ")) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          yield json;
        } catch {
          // Malformed JSON — skip
        }
      }
    }
  }
}
