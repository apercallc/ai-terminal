import type { CommandPlan, CommandStep, RiskLevel } from "@/types";
import type { LLMProvider } from "@/lib/llm/provider";
import { AgentContext } from "./context";

/**
 * The Planner asks the LLM to produce a CommandPlan from a user goal.
 * It also handles error analysis and success verification.
 */
export class AgentPlanner {
  private provider: LLMProvider;
  private context: AgentContext;

  constructor(provider: LLMProvider, context: AgentContext) {
    this.provider = provider;
    this.context = context;
  }

  /** Update the underlying LLM provider (e.g. after a settings change). */
  setProvider(provider: LLMProvider): void {
    this.provider = provider;
  }

  /**
   * Generate a command plan for the given goal.
   */
  async createPlan(goal: string): Promise<CommandPlan> {
    const userMessage = `Create a plan to accomplish this goal: "${goal}"`;
    this.context.addUserMessage(userMessage);

    const messages = this.context.buildMessages();
    const response = await this.provider.complete({ messages, temperature: 0.1 });

    this.context.addAssistantMessage(response.content);

    const parsed = this.parseJSON(response.content);

    if (!parsed?.plan) {
      throw new Error("LLM did not return a valid plan");
    }

    const plan: CommandPlan = {
      goal: parsed.plan.goal ?? goal,
      summary: parsed.plan.summary ?? "",
      steps: (parsed.plan.steps ?? []).map(
        (s: Record<string, unknown>, i: number): CommandStep => ({
          id: (s.id as string) ?? `step-${i + 1}`,
          command: (s.command as string) ?? "",
          description: (s.description as string) ?? "",
          riskLevel: this.validateRiskLevel(s.riskLevel as string),
          expectedOutcome: (s.expectedOutcome as string) ?? "",
          rollback: (s.rollback as string) ?? undefined,
        }),
      ),
    };

    if (plan.steps.length === 0) {
      throw new Error("Plan has no steps");
    }

    return plan;
  }

  /**
   * Analyze a command failure and suggest a fix.
   */
  async analyzeError(
    step: CommandStep,
    output: string,
    exitCode: number | null,
  ): Promise<{
    cause: string;
    fixCommand: string;
    fixDescription: string;
    fixRiskLevel: RiskLevel;
    shouldRetry: boolean;
  }> {
    const userMessage = [
      `The following command failed:`,
      `Command: ${step.command}`,
      `Exit code: ${exitCode ?? "unknown"}`,
      `Output:\n${output}`,
      "",
      "Analyze the error and suggest a fix.",
    ].join("\n");

    this.context.addUserMessage(userMessage);
    const messages = this.context.buildMessages();
    const response = await this.provider.complete({ messages, temperature: 0.1 });
    this.context.addAssistantMessage(response.content);

    const parsed = this.parseJSON(response.content);

    if (!parsed?.analysis) {
      return {
        cause: "Unable to analyze error",
        fixCommand: step.command,
        fixDescription: "Retry the same command",
        fixRiskLevel: step.riskLevel,
        shouldRetry: true,
      };
    }

    return {
      cause: parsed.analysis.cause ?? "Unknown cause",
      fixCommand: parsed.analysis.fix?.command ?? step.command,
      fixDescription: parsed.analysis.fix?.description ?? "Retry",
      fixRiskLevel: this.validateRiskLevel(parsed.analysis.fix?.riskLevel),
      shouldRetry: parsed.analysis.shouldRetry !== false,
    };
  }

  /**
   * Ask the LLM whether a step succeeded based on its output.
   */
  async verifySuccess(step: CommandStep, output: string): Promise<{ success: boolean; reason: string }> {
    const userMessage = [
      `Verify whether this command succeeded:`,
      `Command: ${step.command}`,
      `Expected outcome: ${step.expectedOutcome}`,
      `Output:\n${output}`,
      "",
      "Did this step succeed?",
    ].join("\n");

    this.context.addUserMessage(userMessage);
    const messages = this.context.buildMessages();
    const response = await this.provider.complete({ messages, temperature: 0 });
    this.context.addAssistantMessage(response.content);

    const parsed = this.parseJSON(response.content);

    if (!parsed?.verification) {
      // If we can't parse, assume success if there's output and no obvious error
      const looksLikeError =
        output.toLowerCase().includes("error") ||
        output.toLowerCase().includes("failed") ||
        output.toLowerCase().includes("not found");
      return {
        success: !looksLikeError,
        reason: looksLikeError
          ? "Output contains error indicators"
          : "Output appears normal",
      };
    }

    return {
      success: parsed.verification.success === true,
      reason: parsed.verification.reason ?? "",
    };
  }

  /**
   * Try to extract JSON from the LLM response, handling markdown fencing.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseJSON(text: string): Record<string, any> | null {
    // Strip markdown code fences
    let cleaned = text.trim();
    const jsonMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      cleaned = jsonMatch[1].trim();
    }

    // Try to find JSON object in the text
    const braceStart = cleaned.indexOf("{");
    const braceEnd = cleaned.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd > braceStart) {
      cleaned = cleaned.slice(braceStart, braceEnd + 1);
    }

    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }

  private validateRiskLevel(level: unknown): RiskLevel {
    const valid: RiskLevel[] = ["safe", "low", "medium", "high", "critical"];
    if (typeof level === "string" && valid.includes(level as RiskLevel)) {
      return level as RiskLevel;
    }
    return "low";
  }
}
