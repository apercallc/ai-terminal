import type { CommandStep, ExecutionMode, ExecutionRecord } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AgentPlanner } from "./planner";
import { AgentContext } from "./context";
import { AgentStateMachine } from "./state-machine";
import type { LLMProvider } from "@/lib/llm/provider";
import { redactSecrets } from "@/lib/security/redact";

/**
 * Orchestrates command execution across the PTY and AI planning loop.
 */
export class AgentExecutor {
  private planner: AgentPlanner;
  private context: AgentContext;
  private stateMachine: AgentStateMachine;
  private sessionId: string;
  private ptySessionId: string | null = null;
  private mode: ExecutionMode = "safe";
  private commandTimeout: number;
  private abortController: AbortController | null = null;

  constructor(
    provider: LLMProvider,
    options: {
      sessionId: string;
      maxRetries?: number;
      commandTimeout?: number;
    },
  ) {
    this.context = new AgentContext();
    this.planner = new AgentPlanner(provider, this.context);
    this.stateMachine = new AgentStateMachine(options.maxRetries ?? 3);
    this.sessionId = options.sessionId;
    this.commandTimeout = options.commandTimeout ?? 120;
  }

  /** Replace the LLM provider (e.g. settings changed). */
  setProvider(provider: LLMProvider): void {
    this.planner.setProvider(provider);
  }

  /** Set the current PTY session to send commands to. */
  setPtySession(ptySessionId: string): void {
    this.ptySessionId = ptySessionId;
  }

  /** Set the execution mode. */
  setMode(mode: ExecutionMode): void {
    this.mode = mode;
  }

  /** Get the state machine for subscribing to state changes. */
  getStateMachine(): AgentStateMachine {
    return this.stateMachine;
  }

  /** Get the context manager. */
  getContext(): AgentContext {
    return this.context;
  }

  /**
   * Execute a user goal end-to-end.
   * In auto mode, runs all steps without pausing.
   * In safe mode, the caller must handle approval via the state machine.
   */
  async executeGoal(goal: string): Promise<void> {
    this.abortController = new AbortController();

    // Load system info
    try {
      const sysInfo = await invoke<{
        os: string;
        arch: string;
        shell: string;
        home: string;
        user: string;
        term: string;
      }>("get_system_info");
      this.context.setSystemInfo(sysInfo);
    } catch {
      // Non-fatal — continue without system info
    }

    this.stateMachine.dispatch({ type: "START_PLANNING", goal });

    // Generate the plan
    try {
      const plan = await this.planner.createPlan(goal);
      this.stateMachine.dispatch({ type: "PLAN_READY", plan });
    } catch (err) {
      this.stateMachine.dispatch({
        type: "PLAN_FAILED",
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    // In auto mode, execute all steps immediately
    if (this.mode === "auto") {
      await this.runAllSteps();
    }
    // In safe mode, the UI handles approval before calling approveAndRun()
  }

  /**
   * Approve the current step and execute it.
   * Called by the UI in safe mode after user approves.
   */
  async approveCurrentStep(): Promise<void> {
    const snap = this.stateMachine.getSnapshot();
    if (snap.state !== "awaiting_approval" || !snap.currentStep) return;

    this.stateMachine.dispatch({ type: "APPROVE_STEP", stepId: snap.currentStep.id });
    await this.executeStep(snap.currentStep, true);
  }

  /** Reject the current step. */
  rejectCurrentStep(): void {
    const snap = this.stateMachine.getSnapshot();
    if (snap.state !== "awaiting_approval" || !snap.currentStep) return;
    this.stateMachine.dispatch({ type: "REJECT_STEP", stepId: snap.currentStep.id });
  }

  /** Cancel the current execution. */
  cancel(): void {
    this.abortController?.abort();
    this.stateMachine.dispatch({ type: "CANCEL" });
  }

  /** Reset the executor state for a new goal. */
  reset(): void {
    this.abortController?.abort();
    this.context.clear();
    this.stateMachine.dispatch({ type: "RESET" });
  }

  /** Run all steps sequentially (auto mode). */
  private async runAllSteps(): Promise<void> {
    const snap = this.stateMachine.getSnapshot();
    if (!snap.plan) return;

    // Production hardening: do not allow auto-execution.
    if (import.meta.env.PROD && this.mode === "auto") {
      this.mode = "safe";
      return;
    }

    for (let i = snap.currentStepIndex; i < snap.plan.steps.length; i++) {
      if (this.abortController?.signal.aborted) return;

      const step = snap.plan.steps[i];
      this.stateMachine.dispatch({ type: "AUTO_APPROVE" });
      await this.executeStep(step, true);

      // Check if execution failed and we're done retrying
      const current = this.stateMachine.getSnapshot();
      if (current.state === "error" || current.state === "cancelled") {
        return;
      }
    }
  }

  /** Execute a single command step via the PTY. */
  private async executeStep(step: CommandStep, approved: boolean): Promise<void> {
    if (this.abortController?.signal.aborted) return;
    if (!this.ptySessionId) {
      this.stateMachine.dispatch({
        type: "STEP_FAILED",
        record: this.makeRecord(step, -1, "No PTY session", 0, false, approved),
      });
      return;
    }

    const validationError = this.validateAiCommand(step.command);
    if (validationError) {
      this.stateMachine.dispatch({
        type: "STEP_FAILED",
        record: this.makeRecord(step, -1, validationError, 0, false, approved),
      });
      return;
    }

    // Log the command
    await this.logCommand(step, approved);
    if (this.abortController?.signal.aborted) return;

    const startTime = Date.now();
    let output = "";
    let exitCode: number | null = null;

    try {
      output = await this.runCommandInPty(step.command);
      if (this.abortController?.signal.aborted) return;
      const duration = Date.now() - startTime;

      // Verify success with AI
      const verification = await this.planner.verifySuccess(step, output);
      if (this.abortController?.signal.aborted) return;
      this.context.recordOutput(step.id, output);

      if (verification.success) {
        exitCode = 0;
        this.stateMachine.dispatch({
          type: "STEP_COMPLETE",
          record: this.makeRecord(step, exitCode, output, duration, true, approved),
        });

        // In auto mode, continue to next step
        if (this.mode === "auto") {
          const snap = this.stateMachine.getSnapshot();
          if (snap.state === "awaiting_approval") {
            this.stateMachine.dispatch({ type: "AUTO_APPROVE" });
            if (snap.currentStep) {
              await this.executeStep(snap.currentStep, true);
            }
          }
        }
      } else {
        exitCode = 1;
        this.stateMachine.dispatch({
          type: "STEP_FAILED",
          record: this.makeRecord(step, exitCode, output, duration, false, approved),
        });

        // Attempt error recovery
        await this.handleFailure(step, output, exitCode);
      }
    } catch (err) {
      if (this.abortController?.signal.aborted) return;
      const duration = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.stateMachine.dispatch({
        type: "STEP_FAILED",
        record: this.makeRecord(step, -1, errorMsg, duration, false, approved),
      });
      await this.handleFailure(step, errorMsg, -1);
    }
  }

  /** Validate AI-generated commands: enforce single-line execution to reduce ambiguity/injection. */
  private validateAiCommand(command: string): string | null {
    if (!command || !command.trim()) return "Empty command";
    if (command.length > 2000) return "Command too long";
    if (command.includes("\n") || command.includes("\r"))
      return "Multi-line commands are not allowed";
    if (command.includes("\u0000")) return "Command contains invalid characters";
    if (command.includes("__AI_TERM_DONE_")) return "Command contains reserved marker text";
    return null;
  }

  /** Handle a failed step: analyze error and potentially retry. */
  private async handleFailure(
    step: CommandStep,
    output: string,
    exitCode: number | null,
  ): Promise<void> {
    if (this.abortController?.signal.aborted) return;

    try {
      const analysis = await this.planner.analyzeError(step, output, exitCode);

      if (analysis.shouldRetry) {
        this.stateMachine.dispatch({ type: "RETRY", stepId: step.id });

        const snap = this.stateMachine.getSnapshot();
        if (snap.state === "executing") {
          // Execute the fix command
          const fixStep: CommandStep = {
            ...step,
            command: analysis.fixCommand,
            description: analysis.fixDescription,
            riskLevel: analysis.fixRiskLevel,
          };
          await this.executeStep(fixStep, true);
        }
        // If state is "error", we exceeded max retries — stop
      }
    } catch {
      // Analysis itself failed — leave in error state
    }
  }

  /**
   * Send a command to the PTY and collect its output.
   * Uses a marker-based approach to detect command completion.
   */
  private async runCommandInPty(command: string): Promise<string> {
    if (!this.ptySessionId) throw new Error("No PTY session");

    const signal = this.abortController?.signal;
    if (signal?.aborted) throw new Error("Cancelled");

    let outputCollector = "";
    let settled = false;
    let shouldUnlisten = false;
    let unlistenFn: (() => void) | null = null;

    const requestUnlisten = () => {
      shouldUnlisten = true;
      if (unlistenFn) {
        try {
          unlistenFn();
        } finally {
          unlistenFn = null;
        }
      }
    };

    const setUnlisten = (fn: () => void) => {
      if (shouldUnlisten) {
        fn();
        return;
      }
      unlistenFn = fn;
    };

    const outputPromise = new Promise<string>((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const settleResolve = (value: string) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (signal) signal.removeEventListener("abort", onAbort);
        resolve(value);
      };

      const settleReject = (error: unknown) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (signal) signal.removeEventListener("abort", onAbort);
        reject(error);
      };

      const onAbort = () => {
        settleReject(new Error("Cancelled"));
      };

      if (signal) signal.addEventListener("abort", onAbort, { once: true });

      timeoutId = setTimeout(() => {
        settleResolve(outputCollector);
      }, this.commandTimeout * 1000);

      // Use a unique marker to detect command completion
      const marker = `__AI_TERM_DONE_${Date.now()}__`;
      const markerCmd = `echo "${marker}$?"`;

      listen<{ session_id: string; data: string }>("pty-output", (event) => {
        if (event.payload.session_id !== this.ptySessionId) return;

        outputCollector += event.payload.data;

        // Check for our completion marker
        const markerIdx = outputCollector.indexOf(marker);
        if (markerIdx !== -1) {
          const cleanOutput = outputCollector.slice(0, markerIdx).trim();
          settleResolve(cleanOutput);
        }
      })
        .then((unlisten) => {
          setUnlisten(unlisten);
        })
        .catch((err) => {
          settleReject(err);
        });

      // Send the command
      invoke("write_to_pty", {
        sessionId: this.ptySessionId,
        data: `${command}\n${markerCmd}\n`,
      }).catch((err) => {
        settleReject(err);
      });
    });

    try {
      return await outputPromise;
    } finally {
      requestUnlisten();
    }
  }

  /** Log a command to the audit trail. */
  private async logCommand(step: CommandStep, approved: boolean): Promise<void> {
    try {
      await invoke("write_log", {
        command: redactSecrets(step.command),
        source: "ai",
        riskLevel: step.riskLevel,
        approved,
        exitCode: null,
        outputPreview: null,
        sessionId: this.sessionId,
      });
    } catch {
      // Logging failure is non-fatal
    }
  }

  /** Create an ExecutionRecord. */
  private makeRecord(
    step: CommandStep,
    exitCode: number | null,
    output: string,
    duration: number,
    success: boolean,
    approved: boolean,
  ): ExecutionRecord {
    return {
      id: `${step.id}-${Date.now()}`,
      timestamp: Date.now(),
      command: step.command,
      source: "ai",
      riskLevel: step.riskLevel,
      approved,
      exitCode,
      output,
      duration,
      success,
      sessionId: this.sessionId,
    };
  }
}
