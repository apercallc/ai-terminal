import { describe, it, expect, beforeEach } from "vitest";
import { AgentContext } from "@/lib/agent/context";

describe("AgentContext", () => {
  let ctx: AgentContext;

  beforeEach(() => {
    ctx = new AgentContext();
  });

  it("initializes with a system prompt", () => {
    const messages = ctx.buildMessages();
    expect(messages.length).toBe(1);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("AI terminal assistant");
  });

  it("adds user message", () => {
    ctx.addUserMessage("install package X");
    const messages = ctx.buildMessages();
    const userMsgs = messages.filter((m) => m.role === "user");
    expect(userMsgs.length).toBe(1);
    expect(userMsgs[0].content).toBe("install package X");
  });

  it("adds assistant message", () => {
    ctx.addAssistantMessage("I will do X");
    const messages = ctx.buildMessages();
    const assistantMsgs = messages.filter((m) => m.role === "assistant");
    expect(assistantMsgs.length).toBe(1);
    expect(assistantMsgs[0].content).toBe("I will do X");
  });

  it("records output and truncates long output", () => {
    const longOutput = "a".repeat(3000);
    ctx.recordOutput("step-1", longOutput);
    const stored = ctx.getOutput("step-1");
    expect(stored).toBeDefined();
    expect(stored!.length).toBeLessThan(longOutput.length);
    expect(stored).toContain("[truncated]");
  });

  it("records short output without truncation", () => {
    const shortOutput = "hello world";
    ctx.recordOutput("step-2", shortOutput);
    const stored = ctx.getOutput("step-2");
    expect(stored).toBe(shortOutput);
  });

  it("returns undefined for unknown step output", () => {
    expect(ctx.getOutput("nonexistent")).toBeUndefined();
  });

  it("prunes messages when token budget exceeded", () => {
    // Add many messages to exceed token budget
    for (let i = 0; i < 200; i++) {
      ctx.addUserMessage("A ".repeat(100) + ` message ${i}`);
      ctx.addAssistantMessage("B ".repeat(100) + ` response ${i}`);
    }
    const messages = ctx.buildMessages();
    // System message should always be first
    expect(messages[0].role).toBe("system");
    // Should have pruned some messages
    expect(messages.length).toBeLessThan(401);
  });

  it("clears conversation but keeps system prompt", () => {
    ctx.addUserMessage("test");
    ctx.addAssistantMessage("ok");
    ctx.clear();
    const messages = ctx.buildMessages();
    // Only the system prompt remains
    expect(messages.length).toBe(1);
    expect(messages[0].role).toBe("system");
  });

  it("clear also clears recorded outputs", () => {
    ctx.recordOutput("step-1", "some output");
    ctx.clear();
    expect(ctx.getOutput("step-1")).toBeUndefined();
  });

  it("reset clears everything including system info", () => {
    ctx.setSystemInfo({
      os: "FakeTestOS",
      arch: "arm64",
      shell: "/bin/zsh",
      user: "test",
      home: "/home/test",
      term: "xterm-256color",
    });
    // Verify system info is present before reset
    expect(ctx.getSystemPrompt()).toContain("FakeTestOS");
    ctx.addUserMessage("test");
    ctx.reset();
    const messages = ctx.buildMessages();
    expect(messages.length).toBe(1);
    expect(messages[0].role).toBe("system");
    // System info should be gone after reset
    expect(messages[0].content).not.toContain("FakeTestOS");
  });

  it("setSystemInfo adds OS details to system prompt", () => {
    ctx.setSystemInfo({
      os: "Linux",
      arch: "x86_64",
      shell: "/bin/bash",
      user: "dev",
      home: "/home/dev",
      term: "xterm-256color",
    });
    const prompt = ctx.getSystemPrompt();
    expect(prompt).toContain("Linux");
    expect(prompt).toContain("x86_64");
    expect(prompt).toContain("/bin/bash");
  });

  it("buildMessages includes additional user message when provided", () => {
    ctx.addUserMessage("first message");
    const messages = ctx.buildMessages("follow-up question");
    const userMsgs = messages.filter((m) => m.role === "user");
    expect(userMsgs.length).toBe(2);
    expect(userMsgs[0].content).toBe("first message");
    expect(userMsgs[1].content).toBe("follow-up question");
  });

  it("estimateTotalTokens returns a positive number", () => {
    ctx.addUserMessage("hello");
    const tokens = ctx.estimateTotalTokens();
    expect(tokens).toBeGreaterThan(0);
  });
});
