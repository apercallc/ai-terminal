import { describe, it, expect } from "vitest";
import { AgentStateMachine } from "@/lib/agent/state-machine";
import type { CommandPlan, ExecutionRecord } from "@/types";

const mockPlan: CommandPlan = {
  goal: "test goal",
  summary: "test summary",
  steps: [
    {
      id: "s1",
      command: "echo hi",
      description: "say hi",
      riskLevel: "safe",
      expectedOutcome: "hi",
    },
    {
      id: "s2",
      command: "echo done",
      description: "done",
      riskLevel: "low",
      expectedOutcome: "done",
    },
  ],
};

const mockRecord: ExecutionRecord = {
  id: "rec-1",
  timestamp: Date.now(),
  command: "echo hi",
  source: "ai",
  riskLevel: "safe",
  approved: true,
  exitCode: 0,
  output: "hi",
  duration: 100,
  success: true,
  sessionId: "test-session",
};

describe("AgentStateMachine", () => {
  it("starts in idle state", () => {
    const sm = new AgentStateMachine();
    expect(sm.getSnapshot().state).toBe("idle");
  });

  it("transitions from idle to planning on START_PLANNING", () => {
    const sm = new AgentStateMachine();
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    expect(sm.getSnapshot().state).toBe("planning");
  });

  it("transitions from planning to awaiting_approval on PLAN_READY", () => {
    const sm = new AgentStateMachine();
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    sm.dispatch({ type: "PLAN_READY", plan: mockPlan });
    expect(sm.getSnapshot().state).toBe("awaiting_approval");
  });

  it("transitions from awaiting_approval to executing on APPROVE_STEP", () => {
    const sm = new AgentStateMachine();
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    sm.dispatch({ type: "PLAN_READY", plan: mockPlan });
    sm.dispatch({ type: "APPROVE_STEP", stepId: "s1" });
    expect(sm.getSnapshot().state).toBe("executing");
  });

  it("transitions from executing to analyzing on STEP_FAILED", () => {
    const sm = new AgentStateMachine();
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    sm.dispatch({ type: "PLAN_READY", plan: mockPlan });
    sm.dispatch({ type: "APPROVE_STEP", stepId: "s1" });
    sm.dispatch({ type: "STEP_FAILED", record: { ...mockRecord, success: false } });
    expect(sm.getSnapshot().state).toBe("analyzing");
  });

  it("transitions to next step via STEP_COMPLETE when steps remain", () => {
    const sm = new AgentStateMachine();
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    sm.dispatch({ type: "PLAN_READY", plan: mockPlan });
    sm.dispatch({ type: "APPROVE_STEP", stepId: "s1" });
    sm.dispatch({ type: "STEP_COMPLETE", record: mockRecord });
    const snap = sm.getSnapshot();
    expect(snap.state).toBe("awaiting_approval");
    expect(snap.currentStepIndex).toBe(1);
  });

  it("transitions to complete via STEP_COMPLETE on final step", () => {
    const sm = new AgentStateMachine();
    const singleStepPlan: CommandPlan = {
      ...mockPlan,
      steps: [mockPlan.steps[0]],
    };
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    sm.dispatch({ type: "PLAN_READY", plan: singleStepPlan });
    sm.dispatch({ type: "APPROVE_STEP", stepId: "s1" });
    sm.dispatch({ type: "STEP_COMPLETE", record: mockRecord });
    expect(sm.getSnapshot().state).toBe("complete");
  });

  it("transitions from analyzing to executing on RETRY", () => {
    const sm = new AgentStateMachine();
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    sm.dispatch({ type: "PLAN_READY", plan: mockPlan });
    sm.dispatch({ type: "APPROVE_STEP", stepId: "s1" });
    sm.dispatch({ type: "STEP_FAILED", record: { ...mockRecord, success: false } });
    sm.dispatch({ type: "RETRY", stepId: "s1" });
    const snap = sm.getSnapshot();
    expect(snap.state).toBe("executing");
    expect(snap.retryCount).toBe(1);
  });

  it("transitions to error when max retries exceeded", () => {
    const sm = new AgentStateMachine(2);
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    sm.dispatch({ type: "PLAN_READY", plan: mockPlan });
    sm.dispatch({ type: "APPROVE_STEP", stepId: "s1" });
    // Fail + retry 1
    sm.dispatch({ type: "STEP_FAILED", record: { ...mockRecord, success: false } });
    sm.dispatch({ type: "RETRY", stepId: "s1" });
    // Fail + retry 2
    sm.dispatch({ type: "STEP_FAILED", record: { ...mockRecord, success: false } });
    sm.dispatch({ type: "RETRY", stepId: "s1" });
    // Fail + retry 3 — exceeds max of 2
    sm.dispatch({ type: "STEP_FAILED", record: { ...mockRecord, success: false } });
    sm.dispatch({ type: "RETRY", stepId: "s1" });
    expect(sm.getSnapshot().state).toBe("error");
  });

  it("transitions to cancelled on CANCEL from any running state", () => {
    const sm = new AgentStateMachine();
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    sm.dispatch({ type: "CANCEL" });
    expect(sm.getSnapshot().state).toBe("cancelled");
  });

  it("transitions to error on PLAN_FAILED", () => {
    const sm = new AgentStateMachine();
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    sm.dispatch({ type: "PLAN_FAILED", error: "API error" });
    expect(sm.getSnapshot().state).toBe("error");
  });

  it("resets state on RESET", () => {
    const sm = new AgentStateMachine();
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    sm.dispatch({ type: "PLAN_READY", plan: mockPlan });
    sm.dispatch({ type: "APPROVE_STEP", stepId: "s1" });
    sm.dispatch({ type: "STEP_FAILED", record: { ...mockRecord, success: false } });
    sm.dispatch({ type: "RETRY", stepId: "s1" });
    expect(sm.getSnapshot().retryCount).toBe(1);
    sm.dispatch({ type: "RESET" });
    expect(sm.getSnapshot().state).toBe("idle");
    expect(sm.getSnapshot().retryCount).toBe(0);
  });

  it("notifies subscribers on state change", () => {
    const sm = new AgentStateMachine();
    const states: string[] = [];
    sm.subscribe((s) => states.push(s.state));
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    sm.dispatch({ type: "PLAN_READY", plan: mockPlan });
    expect(states).toEqual(["planning", "awaiting_approval"]);
  });

  it("unsubscribe stops notifications", () => {
    const sm = new AgentStateMachine();
    const states: string[] = [];
    const unsub = sm.subscribe((s) => states.push(s.state));
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    unsub();
    sm.dispatch({ type: "PLAN_READY", plan: mockPlan });
    expect(states).toEqual(["planning"]);
  });

  it("returns immutable snapshots", () => {
    const sm = new AgentStateMachine();
    const s1 = sm.getSnapshot();
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    const s2 = sm.getSnapshot();
    expect(s1.state).toBe("idle");
    expect(s2.state).toBe("planning");
    expect(s1).not.toBe(s2);
  });

  it("AUTO_APPROVE transitions from awaiting_approval to executing", () => {
    const sm = new AgentStateMachine();
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    sm.dispatch({ type: "PLAN_READY", plan: mockPlan });
    sm.dispatch({ type: "AUTO_APPROVE" });
    expect(sm.getSnapshot().state).toBe("executing");
  });

  it("REJECT_STEP transitions to cancelled", () => {
    const sm = new AgentStateMachine();
    sm.dispatch({ type: "START_PLANNING", goal: "test" });
    sm.dispatch({ type: "PLAN_READY", plan: mockPlan });
    sm.dispatch({ type: "REJECT_STEP", stepId: "s1" });
    expect(sm.getSnapshot().state).toBe("cancelled");
  });
});
