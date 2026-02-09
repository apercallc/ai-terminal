import { useState, useMemo, memo } from "react";
import type { ExecutionRecord } from "@/types";
import { getRiskColor, getRiskLabel } from "@/lib/safety/detector";
import "./HistoryView.css";

interface HistoryViewProps {
  history: ExecutionRecord[];
  onClose: () => void;
  onExport: () => void;
}

export function HistoryView({ history, onClose, onExport }: HistoryViewProps) {
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let items = [...history];

    if (filter === "success") items = items.filter((r) => r.success);
    if (filter === "failed") items = items.filter((r) => !r.success);

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (r) => r.command.toLowerCase().includes(q) || r.output.toLowerCase().includes(q),
      );
    }

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [history, filter, search]);

  const successCount = useMemo(() => history.filter((h) => h.success).length, [history]);
  const failedCount = useMemo(() => history.filter((h) => !h.success).length, [history]);

  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="history-panel" onClick={(e) => e.stopPropagation()}>
        <div className="history-header">
          <h2>Command History</h2>
          <div className="history-header-actions">
            <button className="history-export-btn" onClick={onExport} title="Export history">
              Export
            </button>
            <button className="settings-close" onClick={onClose} aria-label="Close history">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="history-toolbar">
          <div className="history-filters">
            <button
              className={`filter-btn ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All ({history.length})
            </button>
            <button
              className={`filter-btn ${filter === "success" ? "active" : ""}`}
              onClick={() => setFilter("success")}
            >
              ✓ Success ({successCount})
            </button>
            <button
              className={`filter-btn ${filter === "failed" ? "active" : ""}`}
              onClick={() => setFilter("failed")}
            >
              ✗ Failed ({failedCount})
            </button>
          </div>
          <input
            type="text"
            className="history-search"
            placeholder="Search commands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="history-body">
          {filtered.length === 0 ? (
            <div className="history-empty">
              {history.length === 0
                ? "No commands executed yet."
                : "No commands match your filter."}
            </div>
          ) : (
            <div className="history-list">
              {filtered.map((record) => (
                <HistoryItem key={record.id} record={record} />
              ))}
            </div>
          )}
        </div>

        <div className="history-footer">
          <span>
            {filtered.length} command{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

const HistoryItem = memo(function HistoryItem({ record }: { record: ExecutionRecord }) {
  const [expanded, setExpanded] = useState(false);

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div
      className={`history-item ${record.success ? "item-success" : "item-failed"}`}
      onClick={() => setExpanded(!expanded)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && setExpanded(!expanded)}
    >
      <div className="history-item-header">
        <span className={`history-status ${record.success ? "success" : "failed"}`}>
          {record.success ? "✓" : "✗"}
        </span>
        <code className="history-command">{record.command}</code>
        <span className="history-meta">
          <span className="history-risk" style={{ color: getRiskColor(record.riskLevel) }}>
            {getRiskLabel(record.riskLevel)}
          </span>
          <span className="history-time">{formatTime(record.timestamp)}</span>
          <span className="history-duration">{formatDuration(record.duration)}</span>
        </span>
      </div>

      {expanded && record.output && (
        <div className="history-output">
          <pre>{record.output.slice(0, 2000)}</pre>
          {record.output.length > 2000 && (
            <span className="output-truncated">
              ... output truncated ({record.output.length} chars total)
            </span>
          )}
        </div>
      )}
    </div>
  );
});
