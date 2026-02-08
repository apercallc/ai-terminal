import type { AgentState, ExecutionMode, ProviderType } from "@/types";
import "./StatusBar.css";

interface StatusBarProps {
  agentState: AgentState;
  mode: ExecutionMode;
  providerType: ProviderType;
  connectionStatus: "untested" | "testing" | "connected" | "failed";
  isConnected: boolean;
  currentStep?: number;
  totalSteps?: number;
  onSettingsClick: () => void;
  onHistoryClick: () => void;
  onBookmarksClick: () => void;
  onTemplatesClick: () => void;
  onToolsClick: () => void;
  onRecordingClick: () => void;
  onCollabClick: () => void;
  onSSHClick: () => void;
  onExportClick: () => void;
  onShortcutsClick: () => void;
  onPluginsClick: () => void;
  onMetricsClick: () => void;
  onPaletteClick: () => void;
  isRecording?: boolean;
  cwd?: string;
}

export function StatusBar({
  agentState,
  mode,
  providerType,
  connectionStatus,
  isConnected,
  currentStep,
  totalSteps,
  onSettingsClick,
  onHistoryClick,
  onBookmarksClick,
  onTemplatesClick,
  onToolsClick,
  onRecordingClick,
  onCollabClick,
  onSSHClick,
  onExportClick,
  onShortcutsClick,
  onPluginsClick,
  onMetricsClick,
  onPaletteClick,
  isRecording,
  cwd,
}: StatusBarProps) {
  const stateLabel = (() => {
    switch (agentState) {
      case "idle": return "Ready";
      case "planning": return "Planning...";
      case "awaiting_approval": return "Awaiting Approval";
      case "executing": return "Executing";
      case "analyzing": return "Analyzing";
      case "retrying": return "Retrying";
      case "complete": return "Complete";
      case "error": return "Error";
      case "cancelled": return "Cancelled";
      default: return "Unknown";
    }
  })();

  const stateClass = (() => {
    switch (agentState) {
      case "complete": return "state-success";
      case "error": case "cancelled": return "state-error";
      case "idle": return "state-idle";
      default: return "state-active";
    }
  })();

  const providerLabel = (() => {
    switch (providerType) {
      case "openai": return "OpenAI";
      case "anthropic": return "Anthropic";
      case "local": return "Local";
    }
  })();

  const connectionIcon = (() => {
    if (!isConnected) return "🔴";
    switch (connectionStatus) {
      case "connected": return "🟢";
      case "failed": return "🔴";
      case "testing": return "🟡";
      default: return "⚪";
    }
  })();

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className={`status-state ${stateClass}`}>
          {stateLabel}
        </span>
        {currentStep !== undefined && totalSteps !== undefined && totalSteps > 0 && (
          <span className="status-progress">
            Step {currentStep + 1}/{totalSteps}
          </span>
        )}
        {cwd && (
          <span className="status-cwd" title={cwd}>
            📂 {cwd.length > 40 ? "..." + cwd.slice(-37) : cwd}
          </span>
        )}
      </div>

      <div className="status-right">
        <span className="status-mode" title={mode === "safe" ? "Safe Mode: commands require approval" : "Auto Mode: commands run automatically"}>
          {mode === "safe" ? "🛡️ Safe" : "⚡ Auto"}
        </span>
        <span className="status-provider">
          {connectionIcon} {providerLabel}
        </span>
        <button className="status-btn" onClick={onBookmarksClick} aria-label="Bookmarks" title="Bookmarks">
          ★
        </button>
        <button className="status-btn" onClick={onTemplatesClick} aria-label="Templates" title="Templates">
          ⧉
        </button>
        <button className="status-btn" onClick={onToolsClick} aria-label="Tools" title="Tools">
          ⚒
        </button>
        <button className={`status-btn ${isRecording ? "recording" : ""}`} onClick={onRecordingClick} aria-label="Recording" title="Recording">
          {isRecording ? "⏺" : "⏺"}
        </button>
        <button className="status-btn" onClick={onCollabClick} aria-label="Collaborate" title="Collaborate">
          👥
        </button>
        <button className="status-btn" onClick={onSSHClick} aria-label="SSH" title="SSH Connections">
          ⇄
        </button>
        <button className="status-btn" onClick={onExportClick} aria-label="Export" title="Export Terminal">
          ↓
        </button>
        <button className="status-btn" onClick={onMetricsClick} aria-label="Metrics" title="Metrics Dashboard">
          📊
        </button>
        <button className="status-btn" onClick={onPaletteClick} aria-label="Command Palette" title="Command Palette (⌘K)">
          ⌘
        </button>
        <button className="status-btn" onClick={onPluginsClick} aria-label="Plugins" title="Plugins">
          ⚙
        </button>
        <button className="status-btn" onClick={onShortcutsClick} aria-label="Shortcuts" title="Keyboard Shortcuts">
          ⌨
        </button>
        <button
          className="status-btn"
          onClick={onHistoryClick}
          aria-label="View history"
          title="Command History"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.5 1.75V13.5h13.75a.75.75 0 010 1.5H.75a.75.75 0 01-.75-.75V1.75a.75.75 0 011.5 0zm14.28 2.53l-5.25 5.25a.75.75 0 01-1.06 0L7 7.06 4.28 9.78a.75.75 0 01-1.06-1.06l3.25-3.25a.75.75 0 011.06 0L10 7.94l4.72-4.72a.75.75 0 011.06 1.06z"/>
          </svg>
        </button>
        <button
          className="status-btn"
          onClick={onSettingsClick}
          aria-label="Settings"
          title="Settings"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M7.429 1.525a6.593 6.593 0 011.142 0c.036.003.108.036.137.146l.289 1.105c.147.56.55.967.997 1.189.174.086.341.183.501.29.417.278.97.423 1.53.27l1.102-.303c.11-.03.175.016.195.046.219.31.41.641.573.989.014.031.022.11-.059.19l-.815.806c-.411.406-.562.957-.53 1.456a4.588 4.588 0 010 .582c-.032.499.119 1.05.53 1.456l.815.806c.08.08.073.159.059.19a6.494 6.494 0 01-.573.989c-.02.03-.085.076-.195.046l-1.102-.303c-.56-.153-1.113-.008-1.53.27-.16.107-.327.204-.5.29-.449.222-.851.628-.998 1.189l-.289 1.105c-.029.11-.101.143-.137.146a6.613 6.613 0 01-1.142 0c-.036-.003-.108-.037-.137-.146l-.289-1.105c-.147-.56-.55-.967-.997-1.189a4.502 4.502 0 01-.501-.29c-.417-.278-.97-.423-1.53-.27l-1.102.303c-.11.03-.175-.016-.195-.046a6.492 6.492 0 01-.573-.989c-.014-.031-.022-.11.059-.19l.815-.806c.411-.406.562-.957.53-1.456a4.587 4.587 0 010-.582c.032-.499-.119-1.05-.53-1.456l-.815-.806c-.08-.08-.073-.159-.059-.19a6.44 6.44 0 01.573-.99c.02-.029.085-.075.195-.045l1.102.303c.56.153 1.113.008 1.53-.27.16-.107.327-.204.5-.29.449-.222.851-.628.998-1.189l.289-1.105c.029-.11.101-.143.137-.146zM8 0c-.236 0-.47.01-.701.03-.743.065-1.29.615-1.458 1.261l-.29 1.106c-.017.066-.078.158-.211.224a5.994 5.994 0 00-.668.386c-.123.082-.233.117-.3.117h-.013l-1.104-.303c-.642-.177-1.322.018-1.796.658a7.95 7.95 0 00-.7 1.216c-.267.605-.127 1.3.279 1.802l.815.806c.05.048.098.147.088.294a6.084 6.084 0 000 .772c.01.147-.038.246-.088.294l-.815.806c-.406.502-.546 1.197-.279 1.802.193.438.42.853.7 1.216.474.64 1.154.835 1.796.658l1.104-.303c.069-.019.18-.019.313.098.207.148.429.28.668.386.133.066.194.158.212.224l.289 1.106c.169.646.715 1.196 1.458 1.26a8.094 8.094 0 001.402 0c.743-.064 1.29-.614 1.458-1.26l.29-1.106c.017-.066.078-.158.211-.224a5.98 5.98 0 00.668-.386c.123-.082.233-.117.3-.117h.013l1.104.303c.642.177 1.322-.018 1.796-.658.28-.363.507-.778.7-1.216.267-.605.127-1.3-.279-1.802l-.815-.806c-.05-.048-.098-.147-.088-.294a6.1 6.1 0 000-.772c-.01-.147.039-.246.088-.294l.815-.806c.406-.502.546-1.197.279-1.802a7.948 7.948 0 00-.7-1.216c-.474-.64-1.154-.835-1.796-.658l-1.104.303c-.069.019-.18.019-.313-.098a5.99 5.99 0 00-.668-.386c-.133-.066-.194-.158-.212-.224L9.16 1.29C8.99.645 8.444.095 7.701.031A8.094 8.094 0 008 0zm0 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM4 8a4 4 0 118 0 4 4 0 01-8 0z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
