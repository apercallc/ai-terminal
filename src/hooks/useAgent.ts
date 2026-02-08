import { useState, useEffect, useCallback, useRef } from "react";
import { AgentExecutor } from "@/lib/agent/executor";
import type { AgentSnapshot } from "@/lib/agent/state-machine";
import type { LLMProvider } from "@/lib/llm/provider";
import type { ExecutionMode } from "@/types";
import { MetricsCollector } from "@/lib/analytics/metrics";

interface UseAgentOptions {
  provider: LLMProvider | null;
  mode: ExecutionMode;
  ptySessionId: string | null;
  maxRetries: number;
  commandTimeout: number;
}

interface UseAgentReturn {
  /** Current agent state snapshot */
  snapshot: AgentSnapshot;
  /** Whether the agent is actively working */
  isActive: boolean;
  /** Start executing a goal */
  executeGoal: (goal: string) => Promise<void>;
  /** Approve the current step (safe mode) */
  approveStep: () => Promise<void>;
  /** Approve all remaining steps (switches to auto mode) */
  approveAll: () => Promise<void>;
  /** Reject the current step */
  rejectStep: () => void;
  /** Cancel the current execution */
  cancel: () => void;
  /** Reset for a new goal */
  reset: () => void;
  /** Session metrics */
  metrics: MetricsCollector;
}

export function useAgent(options: UseAgentOptions): UseAgentReturn {
  const sessionIdRef = useRef(`session-${Date.now()}`);
  const executorRef = useRef<AgentExecutor | null>(null);
  const metricsRef = useRef(new MetricsCollector(sessionIdRef.current));

  const [snapshot, setSnapshot] = useState<AgentSnapshot>({
    state: "idle",
    goal: "",
    plan: null,
    currentStepIndex: -1,
    currentStep: null,
    history: [],
    retryCount: 0,
    error: null,
  });

  // Initialize executor when provider changes
  useEffect(() => {
    if (!options.provider) return;

    if (executorRef.current) {
      executorRef.current.setProvider(options.provider);
      executorRef.current.setMode(options.mode);
    } else {
      const executor = new AgentExecutor(options.provider, {
        sessionId: sessionIdRef.current,
        maxRetries: options.maxRetries,
        commandTimeout: options.commandTimeout,
      });
      executor.setMode(options.mode);
      executorRef.current = executor;

      // Subscribe to state changes
      executor.getStateMachine().subscribe((snap) => {
        setSnapshot(snap);

        // Track metrics
        if (snap.state === "complete") {
          metricsRef.current.recordGoalComplete();
          metricsRef.current.save();
        }
      });
    }
  }, [options.provider, options.mode, options.maxRetries, options.commandTimeout]);

  // Update PTY session
  useEffect(() => {
    if (options.ptySessionId && executorRef.current) {
      executorRef.current.setPtySession(options.ptySessionId);
    }
  }, [options.ptySessionId]);

  // Update mode
  useEffect(() => {
    executorRef.current?.setMode(options.mode);
  }, [options.mode]);

  const executeGoal = useCallback(async (goal: string) => {
    if (!executorRef.current) return;
    await executorRef.current.executeGoal(goal);
  }, []);

  const approveStep = useCallback(async () => {
    if (!executorRef.current) return;
    await executorRef.current.approveCurrentStep();
  }, []);

  const approveAll = useCallback(async () => {
    if (!executorRef.current) return;
    executorRef.current.setMode("auto");
    await executorRef.current.approveCurrentStep();
  }, []);

  const rejectStep = useCallback(() => {
    executorRef.current?.rejectCurrentStep();
  }, []);

  const cancel = useCallback(() => {
    executorRef.current?.cancel();
  }, []);

  const reset = useCallback(() => {
    executorRef.current?.reset();
  }, []);

  const isActive = ["planning", "executing", "analyzing", "retrying", "awaiting_approval"].includes(
    snapshot.state,
  );

  return {
    snapshot,
    isActive,
    executeGoal,
    approveStep,
    approveAll,
    rejectStep,
    cancel,
    reset,
    metrics: metricsRef.current,
  };
}
