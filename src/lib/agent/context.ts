import type { ConversationMessage, SystemInfo } from "@/types";
import { estimateTokens } from "@/lib/llm/provider";

const MAX_CONTEXT_TOKENS = 12000;
const MAX_OUTPUT_CHARS = 2000;

/**
 * Manages the conversation context sent to the LLM.
 * Handles system info, pruning, summarization, and token budgeting.
 */
export class AgentContext {
  private systemInfo: SystemInfo | null = null;
  private messages: ConversationMessage[] = [];
  private outputBuffer: Map<string, string> = new Map();

  /** Set system information gathered from the OS. */
  setSystemInfo(info: SystemInfo): void {
    this.systemInfo = info;
  }

  /** Get the system prompt incorporating OS context. */
  getSystemPrompt(): string {
    const parts = [
      "You are an AI terminal assistant. You help users accomplish tasks by generating and executing shell commands.",
      "You MUST respond with valid JSON only. No markdown, no explanation outside JSON.",
      "",
      "Response format for command planning:",
      '{"plan": {"goal": "<goal>", "summary": "<brief summary>", "steps": [{"id": "<uuid>", "command": "<shell command>", "description": "<what this does>", "riskLevel": "safe|low|medium|high|critical", "expectedOutcome": "<what success looks like>", "rollback": "<undo command or null>"}]}}',
      "",
      "Response format for error analysis:",
      '{"analysis": {"cause": "<root cause>", "fix": {"command": "<fixed command>", "description": "<what the fix does>", "riskLevel": "safe|low|medium|high|critical"}, "shouldRetry": true|false}}',
      "",
      "Response format for success verification:",
      '{"verification": {"success": true|false, "reason": "<explanation>"}}',
      "",
      "Rules:",
      "- Generate ONE command per step (no && chaining for complex operations)",
      "- Always verify installations (e.g., `node --version` after installing node)",
      "- Use non-interactive flags when available (-y, --yes, --non-interactive)",
      "- Prefer Homebrew for macOS package installation",
      "- Never run commands that could damage the system without warning",
      "- Mark destructive commands as high or critical risk",
      "- If a step fails, analyze the output and suggest a fix",
    ];

    if (this.systemInfo) {
      parts.push(
        "",
        "System information:",
        `- OS: ${this.systemInfo.os}`,
        `- Architecture: ${this.systemInfo.arch}`,
        `- Shell: ${this.systemInfo.shell}`,
        `- User: ${this.systemInfo.user}`,
        `- Home: ${this.systemInfo.home}`,
      );
    }

    return parts.join("\n");
  }

  /** Add a user message to the conversation. */
  addUserMessage(content: string): void {
    this.messages.push({ role: "user", content });
    this.pruneIfNeeded();
  }

  /** Add an assistant message to the conversation. */
  addAssistantMessage(content: string): void {
    this.messages.push({ role: "assistant", content });
    this.pruneIfNeeded();
  }

  /** Record command output so it can be referenced in future context. */
  recordOutput(stepId: string, output: string): void {
    // Truncate long outputs to keep context manageable
    const truncated =
      output.length > MAX_OUTPUT_CHARS
        ? output.slice(0, MAX_OUTPUT_CHARS / 2) +
          "\n... [truncated] ...\n" +
          output.slice(-MAX_OUTPUT_CHARS / 2)
        : output;

    this.outputBuffer.set(stepId, truncated);
  }

  /** Get the output recorded for a step. */
  getOutput(stepId: string): string | undefined {
    return this.outputBuffer.get(stepId);
  }

  /** Build the full message array for an LLM request. */
  buildMessages(additionalUserMessage?: string): ConversationMessage[] {
    const result: ConversationMessage[] = [
      { role: "system", content: this.getSystemPrompt() },
      ...this.messages,
    ];

    if (additionalUserMessage) {
      result.push({ role: "user", content: additionalUserMessage });
    }

    return result;
  }

  /** Clear all conversation messages but keep system info. */
  clear(): void {
    this.messages = [];
    this.outputBuffer.clear();
  }

  /** Reset everything including system info. */
  reset(): void {
    this.systemInfo = null;
    this.messages = [];
    this.outputBuffer.clear();
  }

  /** Estimate the total tokens in the current context. */
  estimateTotalTokens(): number {
    const systemTokens = estimateTokens(this.getSystemPrompt());
    const messageTokens = this.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    return systemTokens + messageTokens;
  }

  /** Drop oldest non-system messages if we exceed the budget. */
  private pruneIfNeeded(): void {
    while (this.messages.length > 2 && this.estimateTotalTokens() > MAX_CONTEXT_TOKENS) {
      this.messages.shift();
    }
  }
}
