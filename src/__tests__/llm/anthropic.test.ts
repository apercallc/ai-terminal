import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnthropicProvider } from "@/lib/llm/anthropic";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("AnthropicProvider", () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AnthropicProvider(
      "sk-ant-test-key",
      "claude-sonnet-4-20250514",
      "https://api.anthropic.com",
    );
  });

  it("has correct name", () => {
    expect(provider.name).toBe("Anthropic");
  });

  it("sends correct request format with system separation", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "Hello from Claude!" }],
        usage: { input_tokens: 15, output_tokens: 8 },
      }),
    });

    const result = await provider.complete({
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hi" },
      ],
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");

    const body = JSON.parse(options.body);
    expect(body.system).toBe("You are helpful.");
    expect(body.messages[0].role).toBe("user");
    expect(body.model).toBe("claude-sonnet-4-20250514");

    expect(result.content).toBe("Hello from Claude!");
  });

  it("uses x-api-key header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "OK" }],
        usage: { input_tokens: 5, output_tokens: 2 },
      }),
    });

    await provider.complete({ messages: [{ role: "user", content: "test" }] });
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["x-api-key"]).toBe("sk-ant-test-key");
    expect(headers["anthropic-version"]).toBe("2024-01-01");
  });

  it("handles error responses", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: { message: "Invalid API key" } }),
    });

    await expect(
      provider.complete({ messages: [{ role: "user", content: "test" }] }),
    ).rejects.toThrow();
  });

  it("tests connection", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "pong" }],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    });

    const result = await provider.testConnection();
    expect(result).toBe(true);
  });
});
