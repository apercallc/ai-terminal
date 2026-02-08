import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProvider, validateProviderSettings } from "@/lib/llm";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("LLM Factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createProvider", () => {
    it("creates OpenAI provider", () => {
      const provider = createProvider({
        type: "openai",
        apiKey: "sk-test",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4",
      });
      expect(provider.name).toBe("OpenAI");
    });

    it("creates Anthropic provider", () => {
      const provider = createProvider({
        type: "anthropic",
        apiKey: "sk-ant-test",
        baseUrl: "https://api.anthropic.com",
        model: "claude-sonnet-4-20250514",
      });
      expect(provider.name).toBe("Anthropic");
    });

    it("creates Local provider", () => {
      const provider = createProvider({
        type: "local",
        apiKey: "",
        baseUrl: "http://127.0.0.1:1234/v1",
        model: "llama3",
      });
      expect(provider.name).toBe("Local LLM");
    });
  });

  describe("validateProviderSettings", () => {
    it("returns no errors for valid OpenAI settings", () => {
      const errors = validateProviderSettings({
        type: "openai",
        apiKey: "sk-something",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4",
      });
      expect(errors).toHaveLength(0);
    });

    it("requires API key for OpenAI", () => {
      const errors = validateProviderSettings({
        type: "openai",
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4",
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.toLowerCase().includes("api key"))).toBe(true);
    });

    it("requires API key for Anthropic", () => {
      const errors = validateProviderSettings({
        type: "anthropic",
        apiKey: "",
        baseUrl: "https://api.anthropic.com",
        model: "claude-sonnet-4-20250514",
      });
      expect(errors.length).toBeGreaterThan(0);
    });

    it("does not require API key for local", () => {
      const errors = validateProviderSettings({
        type: "local",
        apiKey: "",
        baseUrl: "http://127.0.0.1:1234/v1",
        model: "llama3",
      });
      const keyErrors = errors.filter((e) => e.toLowerCase().includes("api key"));
      expect(keyErrors).toHaveLength(0);
    });

    it("requires model name", () => {
      const errors = validateProviderSettings({
        type: "openai",
        apiKey: "sk-test",
        baseUrl: "https://api.openai.com/v1",
        model: "",
      });
      expect(errors.some((e) => e.toLowerCase().includes("model"))).toBe(true);
    });

    it("requires base URL", () => {
      const errors = validateProviderSettings({
        type: "openai",
        apiKey: "sk-test",
        baseUrl: "",
        model: "gpt-4",
      });
      expect(errors.some((e) => e.toLowerCase().includes("url"))).toBe(true);
    });
  });
});
