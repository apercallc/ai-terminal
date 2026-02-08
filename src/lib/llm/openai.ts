import type { LLMRequest, LLMResponse, StreamChunk } from "@/types";
import { type LLMProvider, buildHeaders, parseSSEStream } from "./provider";

/**
 * OpenAI API provider (GPT-4, GPT-3.5, etc.)
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = "OpenAI";
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, model = "gpt-4", baseUrl = "https://api.openai.com/v1") {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const url = `${this.baseUrl}/chat/completions`;
    const body = {
      model: this.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 4096,
      stream: false,
    };

    const response = await this.fetchWithRetry(url, body);
    const json = await response.json();

    if (json.error) {
      throw new Error(`OpenAI API error: ${json.error.message}`);
    }

    const choice = json.choices?.[0];
    return {
      content: choice?.message?.content ?? "",
      finishReason: choice?.finish_reason ?? "stop",
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined,
    };
  }

  async stream(request: LLMRequest, onChunk: (chunk: StreamChunk) => void): Promise<LLMResponse> {
    const url = `${this.baseUrl}/chat/completions`;
    const body = {
      model: this.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 4096,
      stream: true,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(this.apiKey),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    let fullContent = "";
    let finishReason = "stop";

    for await (const data of parseSSEStream(response)) {
      const delta = (
        data.choices as Array<{ delta?: { content?: string }; finish_reason?: string }>
      )?.[0];
      if (delta?.delta?.content) {
        fullContent += delta.delta.content;
        onChunk({ content: delta.delta.content, done: false });
      }
      if (delta?.finish_reason) {
        finishReason = delta.finish_reason;
      }
    }

    onChunk({ content: "", done: true });

    return {
      content: fullContent,
      finishReason,
    };
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
          headers: buildHeaders(this.apiKey),
          body: JSON.stringify(body),
        });

        // Rate limited — wait and retry
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get("retry-after") || "2", 10);
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        // Server error — retry
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
