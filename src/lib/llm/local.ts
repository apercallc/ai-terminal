import type { LLMRequest, LLMResponse, StreamChunk } from "@/types";
import { type LLMProvider, buildHeaders, parseSSEStream } from "./provider";

/**
 * Local LLM provider for OpenAI-compatible servers.
 * Works with LM Studio, Ollama, vLLM, LocalAI, etc.
 */
export class LocalProvider implements LLMProvider {
  readonly name = "Local LLM";
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(
    baseUrl = "http://127.0.0.1:1234/v1",
    model = "qwen2.5-7b-instruct",
    apiKey = "not-needed",
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.model = model;
    this.apiKey = apiKey;
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

    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(this.apiKey),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Local LLM error (${response.status}): ${errText}`);
    }

    const json = await response.json();

    if (json.error) {
      throw new Error(`Local LLM error: ${json.error.message || json.error}`);
    }

    const choice = json.choices?.[0];
    return {
      content: choice?.message?.content ?? "",
      finishReason: choice?.finish_reason ?? "stop",
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens ?? 0,
            completionTokens: json.usage.completion_tokens ?? 0,
            totalTokens: json.usage.total_tokens ?? 0,
          }
        : undefined,
    };
  }

  async stream(
    request: LLMRequest,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<LLMResponse> {
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
      throw new Error(`Local LLM error (${response.status}): ${errText}`);
    }

    let fullContent = "";
    let finishReason = "stop";

    for await (const data of parseSSEStream(response)) {
      const delta = (data.choices as Array<{ delta?: { content?: string }; finish_reason?: string }>)?.[0];
      if (delta?.delta?.content) {
        fullContent += delta.delta.content;
        onChunk({ content: delta.delta.content, done: false });
      }
      if (delta?.finish_reason) {
        finishReason = delta.finish_reason;
      }
    }

    onChunk({ content: "", done: true });

    return { content: fullContent, finishReason };
  }

  async testConnection(): Promise<boolean> {
    try {
      // First try a simple models list request
      const modelsUrl = `${this.baseUrl}/models`;
      const modelsResponse = await fetch(modelsUrl, {
        method: "GET",
        headers: buildHeaders(this.apiKey),
        signal: AbortSignal.timeout(5000),
      });

      if (modelsResponse.ok) return true;

      // Fall back to a simple completion test
      const result = await this.complete({
        messages: [{ role: "user", content: "Say OK" }],
        maxTokens: 5,
      });
      return result.content.length > 0;
    } catch {
      return false;
    }
  }
}
