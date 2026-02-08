import { describe, it, expect, vi, beforeEach } from "vitest";
import { LocalProvider } from "@/lib/llm/local";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("LocalProvider", () => {
  let provider: LocalProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new LocalProvider("http://127.0.0.1:1234/v1", "qwen2.5-7b-instruct", "not-needed");
  });

  it("has correct name", () => {
    expect(provider.name).toBe("Local LLM");
  });

  it("sends OpenAI-compatible request format", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Running locally" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    const result = await provider.complete({
      messages: [{ role: "user", content: "test" }],
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:1234/v1/chat/completions");
    expect(result.content).toBe("Running locally");
  });

  it("tests connection via /models endpoint first", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "test-model" }] }),
    });

    const result = await provider.testConnection();
    expect(result).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toBe("http://127.0.0.1:1234/v1/models");
  });

  it("falls back to completion on /models failure", async () => {
    // First call (/models) fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    // Second call (completion) succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "pong" } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
    });

    const result = await provider.testConnection();
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns false when both connection tests fail", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    const result = await provider.testConnection();
    expect(result).toBe(false);
  });
});
