import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentPlanner } from "@/lib/agent/planner";
import { AgentContext } from "@/lib/agent/context";
import type { LLMProvider } from "@/lib/llm/provider";
import type { CommandStep } from "@/types";

function createMockProvider(response: string): LLMProvider {
  return {
    name: "mock",
    complete: vi.fn().mockResolvedValue({
      content: response,
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    }),
    stream: vi.fn(),
    testConnection: vi.fn().mockResolvedValue(true),
  };
}

function makeStep(overrides: Partial<CommandStep> = {}): CommandStep {
  return {
    id: "step-1",
    command: "npm install lodash",
    description: "Install lodash",
    riskLevel: "safe",
    expectedOutcome: "Package installed",
    rollback: "npm uninstall lodash",
    ...overrides,
  };
}

describe("AgentPlanner", () => {
  let context: AgentContext;

  const validPlanJson = JSON.stringify({
    plan: {
      goal: "Install lodash",
      summary: "Install lodash package",
      steps: [
        {
          id: "step-1",
          command: "npm install lodash",
          description: "Install lodash",
          riskLevel: "safe",
          expectedOutcome: "Package installed",
          rollback: "npm uninstall lodash",
        },
      ],
    },
  });

  beforeEach(() => {
    context = new AgentContext();
  });

  it("creates a plan from goal via LLM", async () => {
    const provider = createMockProvider(validPlanJson);
    const planner = new AgentPlanner(provider, context);

    const plan = await planner.createPlan("Install lodash");

    expect(plan).toBeDefined();
    expect(plan.summary).toBe("Install lodash package");
    expect(plan.steps.length).toBe(1);
    expect(plan.steps[0].command).toBe("npm install lodash");
  });

  it("handles markdown code fences wrapping JSON", async () => {
    const fenced = "```json\n" + validPlanJson + "\n```";
    const provider = createMockProvider(fenced);
    const planner = new AgentPlanner(provider, context);

    const plan = await planner.createPlan("Install lodash");

    expect(plan).toBeDefined();
    expect(plan.steps.length).toBe(1);
  });

  it("throws for invalid JSON response", async () => {
    const provider = createMockProvider("Sorry I cannot help with that");
    const planner = new AgentPlanner(provider, context);

    await expect(planner.createPlan("Install lodash")).rejects.toThrow(
      "LLM did not return a valid plan",
    );
  });

  it("throws when plan has no steps", async () => {
    const emptyPlan = JSON.stringify({
      plan: { goal: "Do something", summary: "Empty", steps: [] },
    });
    const provider = createMockProvider(emptyPlan);
    const planner = new AgentPlanner(provider, context);

    await expect(planner.createPlan("Do something")).rejects.toThrow(
      "Plan has no steps",
    );
  });

  it("analyzes an error and suggests a fix", async () => {
    const analysisJson = JSON.stringify({
      analysis: {
        cause: "Permission denied",
        fix: {
          command: "sudo npm install lodash",
          description: "Retry with elevated permissions",
          riskLevel: "medium",
        },
        shouldRetry: true,
      },
    });
    const provider = createMockProvider(analysisJson);
    const planner = new AgentPlanner(provider, context);

    const step = makeStep();
    const result = await planner.analyzeError(
      step,
      "EACCES permission denied",
      1,
    );

    expect(result.cause).toBe("Permission denied");
    expect(result.fixCommand).toContain("sudo");
    expect(result.fixDescription).toBe("Retry with elevated permissions");
    expect(result.fixRiskLevel).toBe("medium");
    expect(result.shouldRetry).toBe(true);
  });

  it("returns fallback when analyzeError gets unparseable response", async () => {
    const provider = createMockProvider("I don't know what went wrong");
    const planner = new AgentPlanner(provider, context);

    const step = makeStep();
    const result = await planner.analyzeError(step, "some error", 1);

    expect(result.cause).toBe("Unable to analyze error");
    expect(result.fixCommand).toBe(step.command);
    expect(result.shouldRetry).toBe(true);
  });

  it("verifies success based on output", async () => {
    const verifyJson = JSON.stringify({
      verification: { success: true, reason: "Package installed successfully" },
    });
    const provider = createMockProvider(verifyJson);
    const planner = new AgentPlanner(provider, context);

    const step = makeStep();
    const result = await planner.verifySuccess(step, "added 1 package");

    expect(result.success).toBe(true);
    expect(result.reason).toBe("Package installed successfully");
  });

  it("verifies failure based on output", async () => {
    const verifyJson = JSON.stringify({
      verification: { success: false, reason: "Network timeout occurred" },
    });
    const provider = createMockProvider(verifyJson);
    const planner = new AgentPlanner(provider, context);

    const step = makeStep();
    const result = await planner.verifySuccess(step, "ERR! network timeout");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("Network timeout occurred");
  });

  it("falls back to heuristic when verifySuccess gets unparseable response", async () => {
    const provider = createMockProvider("looks good to me!");
    const planner = new AgentPlanner(provider, context);

    const step = makeStep();
    const result = await planner.verifySuccess(step, "added 1 package");

    expect(result.success).toBe(true);
    expect(result.reason).toContain("normal");
  });

  it("heuristic detects error keywords in output", async () => {
    const provider = createMockProvider("no JSON here");
    const planner = new AgentPlanner(provider, context);

    const step = makeStep();
    const result = await planner.verifySuccess(step, "fatal error occurred");

    expect(result.success).toBe(false);
    expect(result.reason).toContain("error");
  });

  it("setProvider swaps the underlying provider", async () => {
    const provider1 = createMockProvider("bad response");
    const provider2 = createMockProvider(validPlanJson);
    const planner = new AgentPlanner(provider1, context);

    planner.setProvider(provider2);

    const plan = await planner.createPlan("Install lodash");
    expect(plan.steps.length).toBe(1);
    expect(provider2.complete).toHaveBeenCalled();
    expect(provider1.complete).not.toHaveBeenCalled();
  });
});
