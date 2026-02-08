import { describe, it, expect } from "vitest";
import { estimateTokens, parseSSEStream } from "@/lib/llm/provider";

describe("LLM Provider Utilities", () => {
  describe("estimateTokens", () => {
    it("estimates tokens roughly at 4 chars per token", () => {
      const text = "Hello, world!"; // 13 chars
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(20);
    });

    it("returns 0 for empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });

    it("handles long text", () => {
      const long = "a".repeat(4000);
      const tokens = estimateTokens(long);
      expect(tokens).toBeGreaterThan(500);
      expect(tokens).toBeLessThan(2000);
    });
  });

  describe("parseSSEStream", () => {
    it("parses SSE data lines", async () => {
      const text = `data: {"content":"Hello"}\n\ndata: {"content":" World"}\n\ndata: [DONE]\n\n`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(text));
          controller.close();
        },
      });

      const response = new Response(stream);
      const chunks: Record<string, unknown>[] = [];
      for await (const chunk of parseSSEStream(response)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("handles empty stream", async () => {
      const response = new Response(
        new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
      );
      const chunks: Record<string, unknown>[] = [];
      for await (const chunk of parseSSEStream(response)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(0);
    });
  });
});
