import { useState } from "react";
import type { AppSettings, ExecutionMode, ProviderType } from "@/types";
import "./Settings.css";

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onUpdateProvider: (partial: Partial<AppSettings["provider"]>) => void;
  onSaveApiKey: () => Promise<void>;
  onDeleteApiKey: () => Promise<void>;
  onTestConnection: () => Promise<boolean>;
  connectionStatus: "untested" | "testing" | "connected" | "failed";
  validationErrors: string[];
  isLoading: boolean;
  onClose: () => void;
}

const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "local", label: "Local LLM" },
];

const MODEL_OPTIONS: Record<ProviderType, string[]> = {
  openai: ["gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
  anthropic: ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307", "claude-3-opus-20240229"],
  local: ["qwen2.5-7b-instruct", "llama-3.1-8b-instruct", "mistral-7b-instruct", "codellama-7b"],
};

const DEFAULT_URLS: Record<ProviderType, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  local: "http://127.0.0.1:1234/v1",
};

export function Settings({
  settings,
  onUpdateSettings,
  onUpdateProvider,
  onSaveApiKey,
  onDeleteApiKey,
  onTestConnection,
  connectionStatus,
  validationErrors,
  isLoading,
  onClose,
}: SettingsProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleProviderChange = (type: ProviderType) => {
    onUpdateProvider({
      type,
      baseUrl: DEFAULT_URLS[type],
      model: MODEL_OPTIONS[type][0],
      apiKey: "",
    });
  };

  const handleTest = async () => {
    setTestResult(null);
    const ok = await onTestConnection();
    setTestResult(ok ? "Connection successful!" : "Connection failed. Check your settings.");
  };

  const handleSaveKey = async () => {
    await onSaveApiKey();
    setTestResult("API key saved to Keychain.");
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close settings">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
            </svg>
          </button>
        </div>

        <div className="settings-body">
          {/* Provider Selection */}
          <section className="settings-section">
            <h3>AI Provider</h3>
            <div className="settings-field">
              <label>Provider</label>
              <select
                value={settings.provider.type}
                onChange={(e) => handleProviderChange(e.target.value as ProviderType)}
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-field">
              <label>API Key</label>
              <div className="api-key-row">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={settings.provider.apiKey}
                  onChange={(e) => onUpdateProvider({ apiKey: e.target.value })}
                  placeholder={
                    settings.provider.type === "local"
                      ? "not-needed"
                      : settings.provider.type === "anthropic"
                        ? "sk-ant-xxxx"
                        : "sk-xxxx"
                  }
                />
                <button
                  className="icon-btn"
                  onClick={() => setShowApiKey(!showApiKey)}
                  title={showApiKey ? "Hide" : "Show"}
                  type="button"
                >
                  {showApiKey ? "🙈" : "👁️"}
                </button>
              </div>
              <div className="key-actions">
                <button
                  className="text-btn"
                  onClick={handleSaveKey}
                  disabled={!settings.provider.apiKey || isLoading}
                >
                  Save to Keychain
                </button>
                <button
                  className="text-btn text-btn-danger"
                  onClick={onDeleteApiKey}
                  disabled={isLoading}
                >
                  Delete from Keychain
                </button>
              </div>
            </div>

            <div className="settings-field">
              <label>Base URL</label>
              <input
                type="url"
                value={settings.provider.baseUrl}
                onChange={(e) => onUpdateProvider({ baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <div className="settings-field">
              <label>Model</label>
              <div className="model-row">
                <select
                  value={settings.provider.model}
                  onChange={(e) => onUpdateProvider({ model: e.target.value })}
                >
                  {MODEL_OPTIONS[settings.provider.type].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={settings.provider.model}
                  onChange={(e) => onUpdateProvider({ model: e.target.value })}
                  placeholder="Custom model name"
                  className="model-custom"
                />
              </div>
            </div>

            <div className="settings-field">
              <button
                className="settings-btn"
                onClick={handleTest}
                disabled={isLoading || connectionStatus === "testing"}
              >
                {connectionStatus === "testing" ? "Testing..." : "Test Connection"}
              </button>
              {testResult && (
                <span
                  className={`test-result ${connectionStatus === "connected" ? "test-success" : connectionStatus === "failed" ? "test-fail" : ""}`}
                >
                  {testResult}
                </span>
              )}
            </div>

            {validationErrors.length > 0 && (
              <div className="validation-errors">
                {validationErrors.map((err, i) => (
                  <span key={i} className="validation-error">
                    {err}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Execution Mode */}
          <section className="settings-section">
            <h3>Execution Mode</h3>
            <div className="mode-options">
              <label className={`mode-option ${settings.mode === "safe" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="mode"
                  value="safe"
                  checked={settings.mode === "safe"}
                  onChange={() => onUpdateSettings({ mode: "safe" as ExecutionMode })}
                />
                <div className="mode-content">
                  <span className="mode-icon">🛡️</span>
                  <span className="mode-label">Safe Mode</span>
                  <span className="mode-desc">Review and approve each command</span>
                </div>
              </label>
              <label className={`mode-option ${settings.mode === "auto" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="mode"
                  value="auto"
                  checked={settings.mode === "auto"}
                  onChange={() => onUpdateSettings({ mode: "auto" as ExecutionMode })}
                />
                <div className="mode-content">
                  <span className="mode-icon">⚡</span>
                  <span className="mode-label">Auto-Accept Mode</span>
                  <span className="mode-desc">Commands run automatically</span>
                </div>
              </label>
            </div>
            {settings.mode === "auto" && (
              <div className="mode-warning">
                ⚠️ Auto mode executes commands without confirmation. Use responsibly.
              </div>
            )}
          </section>

          {/* Advanced */}
          <section className="settings-section">
            <h3>Advanced</h3>
            <div className="settings-field">
              <label>Max Retries</label>
              <input
                type="number"
                min={0}
                max={10}
                value={settings.maxRetries}
                onChange={(e) => onUpdateSettings({ maxRetries: parseInt(e.target.value, 10) || 3 })}
              />
            </div>
            <div className="settings-field">
              <label>Command Timeout (seconds)</label>
              <input
                type="number"
                min={10}
                max={600}
                value={settings.commandTimeout}
                onChange={(e) =>
                  onUpdateSettings({ commandTimeout: parseInt(e.target.value, 10) || 120 })
                }
              />
            </div>
            <div className="settings-field">
              <label>Scrollback Lines</label>
              <input
                type="number"
                min={1000}
                max={100000}
                step={1000}
                value={settings.scrollbackLimit}
                onChange={(e) =>
                  onUpdateSettings({ scrollbackLimit: parseInt(e.target.value, 10) || 10000 })
                }
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
