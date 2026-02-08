import type { MetricEvent, ProviderType, SessionMetrics } from "@/types";

/**
 * Lightweight, privacy-respecting metrics collector.
 * All data stays local — stored in localStorage.
 */
export class MetricsCollector {
  private sessionId: string;
  private events: MetricEvent[] = [];
  private sessionStart: number;
  private commandsExecuted = 0;
  private commandsSucceeded = 0;
  private commandsFailed = 0;
  private retriesPerformed = 0;
  private goalsCompleted = 0;
  private provider: ProviderType = "openai";

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.sessionStart = Date.now();
  }

  /** Set the current provider. */
  setProvider(provider: ProviderType): void {
    this.provider = provider;
  }

  /** Record a command execution. */
  recordCommand(success: boolean): void {
    this.commandsExecuted++;
    if (success) {
      this.commandsSucceeded++;
    } else {
      this.commandsFailed++;
    }
    this.emit("command_executed", success ? 1 : 0, { success: String(success) });
  }

  /** Record a retry attempt. */
  recordRetry(): void {
    this.retriesPerformed++;
    this.emit("retry_performed", 1);
  }

  /** Record a completed goal. */
  recordGoalComplete(): void {
    this.goalsCompleted++;
    this.emit("goal_completed", 1);
  }

  /** Emit a custom metric event. */
  emit(name: string, value: number, tags: Record<string, string> = {}): void {
    this.events.push({
      name,
      value,
      timestamp: Date.now(),
      tags: { ...tags, sessionId: this.sessionId },
    });
  }

  /** Get the current session summary. */
  getSessionMetrics(): SessionMetrics {
    return {
      sessionId: this.sessionId,
      commandsExecuted: this.commandsExecuted,
      commandsSucceeded: this.commandsSucceeded,
      commandsFailed: this.commandsFailed,
      retriesPerformed: this.retriesPerformed,
      totalDuration: Date.now() - this.sessionStart,
      provider: this.provider,
      goalsCompleted: this.goalsCompleted,
    };
  }

  /** Save metrics to localStorage for persistence. */
  save(): void {
    try {
      const key = `metrics_${this.sessionId}`;
      const data = {
        metrics: this.getSessionMetrics(),
        events: this.events,
      };
      localStorage.setItem(key, JSON.stringify(data));

      // Also update the list of all sessions
      const sessionsKey = "metrics_sessions";
      const sessions: string[] = JSON.parse(localStorage.getItem(sessionsKey) || "[]");
      if (!sessions.includes(this.sessionId)) {
        sessions.push(this.sessionId);
        // Keep last 100 sessions
        while (sessions.length > 100) sessions.shift();
        localStorage.setItem(sessionsKey, JSON.stringify(sessions));
      }
    } catch {
      // localStorage may not be available in all environments
    }
  }

  /** Load historical metrics from localStorage. */
  static loadHistory(): SessionMetrics[] {
    try {
      const sessionsKey = "metrics_sessions";
      const sessions: string[] = JSON.parse(localStorage.getItem(sessionsKey) || "[]");

      return sessions
        .map((sid) => {
          const raw = localStorage.getItem(`metrics_${sid}`);
          if (!raw) return null;
          const data = JSON.parse(raw);
          return data.metrics as SessionMetrics;
        })
        .filter((m): m is SessionMetrics => m !== null);
    } catch {
      return [];
    }
  }

  /** Get aggregate stats across all sessions. */
  static getAggregateStats(): {
    totalSessions: number;
    totalCommands: number;
    successRate: number;
    averageDuration: number;
    totalGoals: number;
  } {
    const history = MetricsCollector.loadHistory();
    if (history.length === 0) {
      return {
        totalSessions: 0,
        totalCommands: 0,
        successRate: 0,
        averageDuration: 0,
        totalGoals: 0,
      };
    }

    const totalCommands = history.reduce((s, m) => s + m.commandsExecuted, 0);
    const totalSucceeded = history.reduce((s, m) => s + m.commandsSucceeded, 0);
    const totalDuration = history.reduce((s, m) => s + m.totalDuration, 0);

    return {
      totalSessions: history.length,
      totalCommands,
      successRate: totalCommands > 0 ? totalSucceeded / totalCommands : 0,
      averageDuration: totalDuration / history.length,
      totalGoals: history.reduce((s, m) => s + m.goalsCompleted, 0),
    };
  }
}
