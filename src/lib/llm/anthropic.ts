import type { LLMRequest, LLMResponse, StreamChunk } from "@/types";
import type { LLMProvider } from "./provider";

/**
 * Anthropic Claude API provider.
 * Uses the Messages API (v2024-01-01+).
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = "Anthropic";
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(
    apiKey: string,
    model = "claude-sonnet-4-20250514",
    baseUrl = "https://api.anthropic.com",
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": "2024-01-01",
    };
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const { systemMessage, userMessages } = this.splitMessages(request);

    const url = `${this.baseUrl}/v1/messages`;
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: request.maxTokens ?? 4096,
      messages: userMessages,
    };
    if (systemMessage) {
      body.system = systemMessage;
    }

    const response = await this.fetchWithRetry(url, body);
    const json = await response.json();

    if (json.error) {
      throw new Error(`Anthropic API error: ${json.error.message}`);
    }

    const textBlock = json.content?.find(
      (b: { type: string }) => b.type === "text",
    );

    return {
      content: textBlock?.text ?? "",
      finishReason: json.stop_reason ?? "end_turn",
      usage: json.usage
        ? {
            promptTokens: json.usage.input_tokens,
            completionTokens: json.usage.output_tokens,
            totalTokens: json.usage.input_tokens + json.usage.output_tokens,
          }
        : undefined,
    };
  }

  async stream(
    request: LLMRequest,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<LLMResponse> {
    const { systemMessage, userMessages } = this.splitMessages(request);

    const url = `${this.baseUrl}/v1/messages`;
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: request.maxTokens ?? 4096,
      messages: userMessages,
      stream: true,
    };
    if (systemMessage) {
      body.system = systemMessage;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }

    let fullContent = "";
    let finishReason = "end_turn";

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
        if (trimmed.startsWith("data: ")) {
          try {
            const event = JSON.parse(trimmed.slice(6));

            if (event.type === "content_block_delta" && event.delta?.text) {
              fullContent += event.delta.text;
              onChunk({ content: event.delta.text, done: false });
            }

            if (event.type === "message_delta" && event.delta?.stop_reason) {
              finishReason = event.delta.stop_reason;
            }

            if (event.type === "message_stop") {
              break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }

    onChunk({ content: "", done: true });

    return { content: fullContent, finishReason };
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.complete({
        messages: [{ role: "user", content: "Say OK" }],
        maxTokens: 5,
      });
      return result.content.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Anthropic separates system messages from user/assistant messages.
   */
  private splitMessages(request: LLMRequest): {
    systemMessage: string | null;
    userMessages: Array<{ role: string; content: string }>;
  } {
    let systemMessage: string | null = null;
    const userMessages: Array<{ role: string; content: string }> = [];

    for (const msg of request.messages) {
      if (msg.role === "system") {
        systemMessage = (systemMessage ? systemMessage + "\n\n" : "") + msg.content;
      } else {
        userMessages.push({ role: msg.role, content: msg.content });
      }
    }

    return { systemMessage, userMessages };
  }

  private async fetchWithRetry(
    url: string,
    body: Record<string, unknown>,
    maxRetries = 3,
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(body),
        });

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get("retry-after") || "2", 10);
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        if (response.status >= 500) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }

        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error("Request failed after retries");
  }
}
