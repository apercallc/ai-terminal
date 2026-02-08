import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAIProvider } from "@/lib/llm/openai";

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIProvider("sk-test-key", "gpt-4", "https://api.openai.com/v1");
  });

  it("has correct name", () => {
    expect(provider.name).toBe("OpenAI");
  });

  it("sends correct request format", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello!" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    const result = await provider.complete({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body);
    expect(body.model).toBe("gpt-4");
    expect(body.messages[0].role).toBe("user");

    expect(result.content).toBe("Hello!");
    expect(result.usage?.promptTokens).toBe(10);
    expect(result.usage?.completionTokens).toBe(5);
  });

  it("includes authorization header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "OK" } }],
        usage: { prompt_tokens: 5, completion_tokens: 2 },
      }),
    });

    await provider.complete({ messages: [{ role: "user", content: "test" }] });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer sk-test-key");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: { message: "Invalid request" } }),
    });

    await expect(
      provider.complete({ messages: [{ role: "user", content: "test" }] }),
    ).rejects.toThrow();
  });

  it("tests connection successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "pong" } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
    });

    const result = await provider.testConnection();
    expect(result).toBe(true);
  });

  it("tests connection failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await provider.testConnection();
    expect(result).toBe(false);
  });
});
