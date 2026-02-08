import { describe, it, expect, beforeEach } from "vitest";
import { MetricsCollector } from "@/lib/analytics/metrics";

describe("MetricsCollector", () => {
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector("test-session-id");
  });

  it("starts a session with valid ID", () => {
    const session = metrics.getSessionMetrics();
    expect(session.sessionId).toBe("test-session-id");
  });

  it("records command execution", () => {
    metrics.recordCommand(true);
    const session = metrics.getSessionMetrics();
    expect(session.commandsExecuted).toBe(1);
    expect(session.commandsSucceeded).toBe(1);
  });

  it("records failed commands", () => {
    metrics.recordCommand(false);
    const session = metrics.getSessionMetrics();
    expect(session.commandsExecuted).toBe(1);
    expect(session.commandsFailed).toBe(1);
  });

  it("records retries", () => {
    metrics.recordRetry();
    metrics.recordRetry();
    const session = metrics.getSessionMetrics();
    expect(session.retriesPerformed).toBe(2);
  });

  it("records goals completed", () => {
    metrics.recordGoalComplete();
    metrics.recordGoalComplete();
    const session = metrics.getSessionMetrics();
    expect(session.goalsCompleted).toBe(2);
  });

  it("sets provider", () => {
    metrics.setProvider("anthropic");
    const session = metrics.getSessionMetrics();
    expect(session.provider).toBe("anthropic");
  });

  it("tracks session duration", () => {
    const session = metrics.getSessionMetrics();
    expect(session.totalDuration).toBeGreaterThanOrEqual(0);
  });
});
