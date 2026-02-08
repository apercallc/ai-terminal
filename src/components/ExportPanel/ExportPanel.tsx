import { useState } from "react";
import type { ExportFormat } from "@/types";
import { TerminalExporter } from "@/lib/export/exporter";
import "./ExportPanel.css";

interface ExportPanelProps {
  onClose: () => void;
  getTerminalContent: () => string;
}

export function ExportPanel({ onClose, getTerminalContent }: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>("html");
  const [includeTimestamps, setIncludeTimestamps] = useState(false);
  const [includeAnsi, setIncludeAnsi] = useState(true);
  const [title, setTitle] = useState("Terminal Session");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const content = getTerminalContent();
      const exporter = new TerminalExporter();

      await exporter.export(content, {
        format,
        includeTimestamp: includeTimestamps,
        includeMetadata: includeAnsi,
        filename: title,
      });

      onClose();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="export-overlay" onClick={onClose}>
      <div className="export-panel" onClick={(e) => e.stopPropagation()}>
        <div className="export-header">
          <h2>Export Terminal</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"
              />
            </svg>
          </button>
        </div>

        <div className="export-body">
          <div className="settings-field">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title"
            />
          </div>

          <div className="settings-field">
            <label>Format</label>
            <div className="export-formats">
              <button
                className={`export-format-btn ${format === "html" ? "active" : ""}`}
                onClick={() => setFormat("html")}
              >
                <span className="format-icon">🌐</span>
                <span className="format-label">HTML</span>
                <span className="format-desc">With colors & styling</span>
              </button>
              <button
                className={`export-format-btn ${format === "text" ? "active" : ""}`}
                onClick={() => setFormat("text")}
              >
                <span className="format-icon">📄</span>
                <span className="format-label">Text</span>
                <span className="format-desc">Plain text output</span>
              </button>
              <button
                className={`export-format-btn ${format === "pdf" ? "active" : ""}`}
                onClick={() => setFormat("pdf")}
              >
                <span className="format-icon">📑</span>
                <span className="format-label">PDF</span>
                <span className="format-desc">via Print dialog</span>
              </button>
            </div>
          </div>

          <div className="export-options">
            <label className="export-checkbox">
              <input
                type="checkbox"
                checked={includeAnsi}
                onChange={(e) => setIncludeAnsi(e.target.checked)}
              />
              <span>Include ANSI colors (HTML only)</span>
            </label>
            <label className="export-checkbox">
              <input
                type="checkbox"
                checked={includeTimestamps}
                onChange={(e) => setIncludeTimestamps(e.target.checked)}
              />
              <span>Include timestamps</span>
            </label>
          </div>
        </div>

        <div className="export-footer">
          <button className="text-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="settings-btn" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting…" : `Export as ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
