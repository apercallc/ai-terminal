import type { AgentState, CommandPlan, CommandStep, ExecutionRecord } from "@/types";

/**
 * Agent state machine transition events.
 */
export type AgentEvent =
  | { type: "START_PLANNING"; goal: string }
  | { type: "PLAN_READY"; plan: CommandPlan }
  | { type: "PLAN_FAILED"; error: string }
  | { type: "APPROVE_STEP"; stepId: string }
  | { type: "REJECT_STEP"; stepId: string }
  | { type: "AUTO_APPROVE" }
  | { type: "STEP_COMPLETE"; record: ExecutionRecord }
  | { type: "STEP_FAILED"; record: ExecutionRecord }
  | { type: "ANALYZING" }
  | { type: "RETRY"; stepId: string }
  | { type: "ALL_COMPLETE" }
  | { type: "CANCEL" }
  | { type: "RESET" };

/**
 * The full snapshot of agent execution state.
 */
export interface AgentSnapshot {
  state: AgentState;
  goal: string;
  plan: CommandPlan | null;
  currentStepIndex: number;
  currentStep: CommandStep | null;
  history: ExecutionRecord[];
  retryCount: number;
  error: string | null;
}

const INITIAL_SNAPSHOT: AgentSnapshot = {
  state: "idle",
  goal: "",
  plan: null,
  currentStepIndex: -1,
  currentStep: null,
  history: [],
  retryCount: 0,
  error: null,
};

type StateListener = (snapshot: AgentSnapshot) => void;

/**
 * Deterministic state machine that governs the agent lifecycle.
 *
 * States: idle → planning → awaiting_approval | executing → analyzing → retrying | complete | error
 */
export class AgentStateMachine {
  private snapshot: AgentSnapshot;
  private listeners: Set<StateListener> = new Set();
  private maxRetries: number;

  constructor(maxRetries = 3) {
    this.snapshot = { ...INITIAL_SNAPSHOT };
    this.maxRetries = maxRetries;
  }

  /** Get current state snapshot (immutable copy). */
  getSnapshot(): Readonly<AgentSnapshot> {
    return { ...this.snapshot };
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Dispatch an event to transition the state machine. */
  dispatch(event: AgentEvent): void {
    const prev = this.snapshot.state;
    this.transition(event);
    if (this.snapshot.state !== prev || event.type === "STEP_COMPLETE") {
      this.notify();
    }
  }

  private transition(event: AgentEvent): void {
    switch (event.type) {
      case "START_PLANNING":
        this.snapshot = {
          ...INITIAL_SNAPSHOT,
          state: "planning",
          goal: event.goal,
        };
        break;

      case "PLAN_READY":
        if (this.snapshot.state !== "planning") return;
        this.snapshot = {
          ...this.snapshot,
          state: "awaiting_approval",
          plan: event.plan,
          currentStepIndex: 0,
          currentStep: event.plan.steps[0] ?? null,
        };
        break;

      case "PLAN_FAILED":
        if (this.snapshot.state !== "planning") return;
        this.snapshot = {
          ...this.snapshot,
          state: "error",
          error: event.error,
        };
        break;

      case "APPROVE_STEP":
        if (this.snapshot.state !== "awaiting_approval") return;
        this.snapshot = {
          ...this.snapshot,
          state: "executing",
        };
        break;

      case "AUTO_APPROVE":
        if (this.snapshot.state !== "awaiting_approval") return;
        this.snapshot = {
          ...this.snapshot,
          state: "executing",
        };
        break;

      case "REJECT_STEP":
        if (this.snapshot.state !== "awaiting_approval") return;
        this.snapshot = {
          ...this.snapshot,
          state: "cancelled",
          error: `Step rejected by user: ${event.stepId}`,
        };
        break;

      case "STEP_COMPLETE": {
        if (this.snapshot.state !== "executing" && this.snapshot.state !== "analyzing") return;
        const newHistory = [...this.snapshot.history, event.record];
        const nextIndex = this.snapshot.currentStepIndex + 1;
        const plan = this.snapshot.plan;

        if (plan && nextIndex < plan.steps.length) {
          this.snapshot = {
            ...this.snapshot,
            state: "awaiting_approval",
            currentStepIndex: nextIndex,
            currentStep: plan.steps[nextIndex],
            history: newHistory,
            retryCount: 0,
          };
        } else {
          this.snapshot = {
            ...this.snapshot,
            state: "complete",
            currentStep: null,
            history: newHistory,
          };
        }
        break;
      }

      case "STEP_FAILED": {
        if (this.snapshot.state !== "executing") return;
        const newHistory = [...this.snapshot.history, event.record];
        this.snapshot = {
          ...this.snapshot,
          state: "analyzing",
          history: newHistory,
        };
        break;
      }

      case "ANALYZING":
        if (this.snapshot.state !== "executing") return;
        this.snapshot = {
          ...this.snapshot,
          state: "analyzing",
        };
        break;

      case "RETRY":
        if (this.snapshot.state !== "analyzing") return;
        if (this.snapshot.retryCount >= this.maxRetries) {
          this.snapshot = {
            ...this.snapshot,
            state: "error",
            error: `Max retries (${this.maxRetries}) exceeded for step`,
          };
        } else {
          this.snapshot = {
            ...this.snapshot,
            state: "executing",
            retryCount: this.snapshot.retryCount + 1,
          };
        }
        break;

      case "ALL_COMPLETE":
        this.snapshot = {
          ...this.snapshot,
          state: "complete",
        };
        break;

      case "CANCEL":
        this.snapshot = {
          ...this.snapshot,
          state: "cancelled",
          error: "Cancelled by user",
        };
        break;

      case "RESET":
        this.snapshot = { ...INITIAL_SNAPSHOT };
        break;
    }
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }
}
