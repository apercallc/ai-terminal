/* ──────────────────────────────────────────────────────────
 * Shared application types
 * ────────────────────────────────────────────────────────── */

/** LLM provider identifiers */
export type ProviderType = "openai" | "anthropic" | "local";

/** Execution mode */
export type ExecutionMode = "safe" | "auto";

/** Agent execution state */
export type AgentState =
  | "idle"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "analyzing"
  | "retrying"
  | "complete"
  | "error"
  | "cancelled";

/** Risk level for a shell command */
export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

/** UI theme */
export type Theme = "dark" | "light";

/* ── Settings ─────────────────────────────────────────── */

export interface ProviderSettings {
  type: ProviderType;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AppSettings {
  provider: ProviderSettings;
  mode: ExecutionMode;
  theme: Theme;
  maxRetries: number;
  commandTimeout: number; // seconds
  scrollbackLimit: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: {
    type: "openai",
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4",
  },
  mode: "safe",
  theme: "dark",
  maxRetries: 3,
  commandTimeout: 120,
  scrollbackLimit: 10000,
};

/* ── Command plan ────────────────────────────────────── */

export interface CommandStep {
  id: string;
  command: string;
  description: string;
  riskLevel: RiskLevel;
  expectedOutcome: string;
  rollback?: string;
}

export interface CommandPlan {
  goal: string;
  steps: CommandStep[];
  summary: string;
}

/* ── Execution history ───────────────────────────────── */

export interface ExecutionRecord {
  id: string;
  timestamp: number;
  command: string;
  source: "user" | "ai" | "system";
  riskLevel: RiskLevel;
  approved: boolean;
  exitCode: number | null;
  output: string;
  duration: number; // ms
  success: boolean;
  sessionId: string;
}

/* ── Agent context ───────────────────────────────────── */

export interface SystemInfo {
  os: string;
  arch: string;
  shell: string;
  home: string;
  user: string;
  term: string;
}

export interface ConversationMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/* ── LLM types ───────────────────────────────────────── */

export interface LLMRequest {
  messages: ConversationMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

/* ── Analytics ───────────────────────────────────────── */

export interface MetricEvent {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
}

export interface SessionMetrics {
  sessionId: string;
  commandsExecuted: number;
  commandsSucceeded: number;
  commandsFailed: number;
  retriesPerformed: number;
  totalDuration: number;
  provider: ProviderType;
  goalsCompleted: number;
}

/* ── Command Suggestions ─────────────────────────────── */

export interface CommandSuggestion {
  id: string;
  command: string;
  description: string;
  category: string;
  frequency: number;
  icon?: "folder" | "file" | "command";
}

export interface DirectoryEntry {
  name: string;
  path: string;
  isDir: boolean;
}

/* ── Command Templates ───────────────────────────────── */

export interface CommandTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: string[];
  variables: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  label: string;
  defaultValue: string;
  placeholder: string;
}

/* ── Keyboard Shortcuts ──────────────────────────────── */

export interface KeyboardShortcut {
  id: string;
  action: string;
  label: string;
  keys: string[];
  category: string;
  editable: boolean;
}

/* ── Bookmarks ───────────────────────────────────────── */

export interface CommandBookmark {
  id: string;
  command: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: number;
}

/* ── Terminal Tabs ───────────────────────────────────── */

export interface TerminalTab {
  id: string;
  label: string;
  ptySessionId: string | null;
  isConnected: boolean;
  cwd: string;
}

/* ── Split Terminal ──────────────────────────────────── */

export type SplitDirection = "horizontal" | "vertical";

export interface SplitPane {
  id: string;
  tabId: string;
  size: number; // percentage 0-100
}

export interface SplitLayout {
  direction: SplitDirection;
  panes: SplitPane[];
}

/* ── Session Persistence ─────────────────────────────── */

export interface PersistedSession {
  id: string;
  tabs: Array<{
    id: string;
    label: string;
    cwd: string;
  }>;
  activeTabId: string;
  splitLayout: SplitLayout | null;
  bookmarks: CommandBookmark[];
  savedAt: number;
}

/* ── Plugin System ───────────────────────────────────── */

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  hooks: PluginHook[];
}

export type PluginHookType =
  | "beforeCommand"
  | "afterCommand"
  | "onOutput"
  | "onGoal"
  | "onPlanReady"
  | "onError";

export interface PluginHook {
  type: PluginHookType;
  handler: string; // function name
}

export interface PluginContext {
  command?: string;
  output?: string;
  goal?: string;
  exitCode?: number | null;
}

/* ── Custom Tool Definitions ─────────────────────────── */

export interface CustomTool {
  id: string;
  name: string;
  description: string;
  command: string;
  icon: string;
  category: string;
  variables: ToolVariable[];
  keybinding?: string;
}

export interface ToolVariable {
  name: string;
  label: string;
  type: "text" | "select" | "boolean";
  defaultValue: string;
  options?: string[];
}

/* ── Collaborative Mode ──────────────────────────────── */

export interface CollaborativeSession {
  id: string;
  hostId: string;
  participants: CollaborativeParticipant[];
  createdAt: number;
  isHost: boolean;
}

export interface CollaborativeParticipant {
  id: string;
  name: string;
  role: "host" | "viewer" | "operator";
  connectedAt: number;
  isActive: boolean;
}

export interface CollaborativeMessage {
  id: string;
  participantId: string;
  participantName: string;
  type: "command" | "output" | "chat" | "system";
  content: string;
  timestamp: number;
}

/* ── Terminal Recording ──────────────────────────────── */

export interface TerminalRecording {
  id: string;
  name: string;
  startTime: number;
  endTime: number | null;
  events: RecordingEvent[];
  metadata: {
    shell: string;
    cols: number;
    rows: number;
    cwd: string;
  };
}

export interface RecordingEvent {
  timestamp: number; // ms offset from start
  type: "input" | "output" | "resize";
  data: string;
}

/* ── Voice Input ─────────────────────────────────────── */

export interface VoiceInputState {
  isListening: boolean;
  transcript: string;
  confidence: number;
  error: string | null;
  isSupported: boolean;
}

/* ── Terminal Export ──────────────────────────────────── */

export type ExportFormat = "html" | "pdf" | "text";

export interface ExportOptions {
  format: ExportFormat;
  includeTimestamp: boolean;
  includeMetadata: boolean;
  filename?: string;
}

/* ── SSH Remote Execution ────────────────────────────── */

export interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "key";
  privateKeyPath?: string;
  lastConnected: number | null;
  isConnected: boolean;
}

export interface SSHSession {
  connectionId: string;
  sessionId: string;
  isActive: boolean;
}
