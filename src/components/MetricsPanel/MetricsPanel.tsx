import { useState, useEffect } from "react";
import type { SessionMetrics } from "@/types";
import { MetricsCollector } from "@/lib/analytics/metrics";
import "./MetricsPanel.css";

interface MetricsPanelProps {
  onClose: () => void;
  currentMetrics: MetricsCollector;
}

export function MetricsPanel({ onClose, currentMetrics }: MetricsPanelProps) {
  const [history, setHistory] = useState<SessionMetrics[]>([]);
  const [aggregate, setAggregate] = useState({
    totalSessions: 0,
    totalCommands: 0,
    successRate: 0,
    averageDuration: 0,
    totalGoals: 0,
  });

  useEffect(() => {
    setHistory(MetricsCollector.loadHistory());
    setAggregate(MetricsCollector.getAggregateStats());
  }, []);

  const current = currentMetrics.getSessionMetrics();

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const successPercent = aggregate.totalCommands > 0
    ? Math.round(aggregate.successRate * 100)
    : 0;
  const failPercent = 100 - successPercent;

  // Count sessions per provider
  const providerCounts = history.reduce<Record<string, number>>((acc, s) => {
    acc[s.provider] = (acc[s.provider] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="metrics-overlay" onClick={onClose}>
      <div className="metrics-panel" onClick={(e) => e.stopPropagation()}>
        <div className="metrics-header">
          <h3>📊 Metrics Dashboard</h3>
          <button className="metrics-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="metrics-body">
          {/* Current Session */}
          <div className="metrics-section">
            <div className="metrics-section-title">Current Session</div>
            <div className="metrics-stats-grid">
              <div className="metrics-stat-card">
                <div className="metrics-stat-value accent">{current.commandsExecuted}</div>
                <div className="metrics-stat-label">Commands</div>
              </div>
              <div className="metrics-stat-card">
                <div className="metrics-stat-value success">{current.commandsSucceeded}</div>
                <div className="metrics-stat-label">Succeeded</div>
              </div>
              <div className="metrics-stat-card">
                <div className="metrics-stat-value danger">{current.commandsFailed}</div>
                <div className="metrics-stat-label">Failed</div>
              </div>
              <div className="metrics-stat-card">
                <div className="metrics-stat-value">{current.goalsCompleted}</div>
                <div className="metrics-stat-label">Goals Done</div>
              </div>
              <div className="metrics-stat-card">
                <div className="metrics-stat-value">{current.retriesPerformed}</div>
                <div className="metrics-stat-label">Retries</div>
              </div>
              <div className="metrics-stat-card">
                <div className="metrics-stat-value">{formatDuration(current.totalDuration)}</div>
                <div className="metrics-stat-label">Duration</div>
              </div>
            </div>
          </div>

          {/* Aggregate Stats */}
          {aggregate.totalSessions > 0 && (
            <>
              <div className="metrics-section">
                <div className="metrics-section-title">All-Time Stats</div>
                <div className="metrics-stats-grid">
                  <div className="metrics-stat-card">
                    <div className="metrics-stat-value accent">{aggregate.totalSessions}</div>
                    <div className="metrics-stat-label">Sessions</div>
                  </div>
                  <div className="metrics-stat-card">
                    <div className="metrics-stat-value">{aggregate.totalCommands}</div>
                    <div className="metrics-stat-label">Total Commands</div>
                  </div>
                  <div className="metrics-stat-card">
                    <div className="metrics-stat-value success">{aggregate.totalGoals}</div>
                    <div className="metrics-stat-label">Total Goals</div>
                  </div>
                </div>
              </div>

              <div className="metrics-section">
                <div className="metrics-section-title">Success Rate</div>
                <div className="metrics-bar-container">
                  {successPercent > 0 && (
                    <div
                      className="metrics-bar-fill success"
                      style={{ width: `${successPercent}%` }}
                    >
                      {successPercent}%
                    </div>
                  )}
                  {failPercent > 0 && aggregate.totalCommands > 0 && (
                    <div
                      className="metrics-bar-fill danger"
                      style={{ width: `${failPercent}%` }}
                    >
                      {failPercent > 5 ? `${failPercent}%` : ""}
                    </div>
                  )}
                </div>
              </div>

              {/* Provider Breakdown */}
              {Object.keys(providerCounts).length > 0 && (
                <div className="metrics-section">
                  <div className="metrics-section-title">Provider Usage</div>
                  <div className="metrics-provider-list">
                    {Object.entries(providerCounts).map(([provider, count]) => (
                      <div key={provider} className="metrics-provider-badge">
                        <span>{provider === "openai" ? "OpenAI" : provider === "anthropic" ? "Anthropic" : "Local"}</span>
                        <span className="metrics-provider-count">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Sessions */}
              <div className="metrics-section">
                <div className="metrics-section-title">Recent Sessions</div>
                <div className="metrics-session-list">
                  {history.slice(-10).reverse().map((session) => (
                    <div key={session.sessionId} className="metrics-session-row">
                      <span className="metrics-session-id">
                        {session.sessionId.replace("session-", "").slice(0, 13)}
                      </span>
                      <div className="metrics-session-stats">
                        <span>✓ {session.commandsSucceeded}</span>
                        <span>✗ {session.commandsFailed}</span>
                        <span>🎯 {session.goalsCompleted}</span>
                        <span>{formatDuration(session.totalDuration)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {aggregate.totalSessions === 0 && (
            <div className="metrics-empty">
              No historical data yet. Metrics are saved after each session.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
