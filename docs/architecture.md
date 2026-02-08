# Architecture

## Overview

AI Terminal is a native macOS application built with **Tauri v2** (Rust backend + React frontend). It combines a fully functional terminal emulator with an AI agent that can plan and execute shell commands to accomplish user goals.

## System Architecture

```
┌──────────────────────────────────────────────┐
│                  macOS App                    │
│  ┌─────────────────────────────────────────┐  │
│  │         React Frontend (WebView)        │  │
│  │                                         │  │
│  │  ┌───────────┐  ┌────────────────────┐  │  │
│  │  │  xterm.js │  │   AI Agent Engine  │  │  │
│  │  │  Terminal  │  │                    │  │  │
│  │  │           │  │  Planner → LLM API │  │  │
│  │  │           │  │  Executor → PTY    │  │  │
│  │  │           │  │  State Machine     │  │  │
│  │  └─────┬─────┘  └────────┬───────────┘  │  │
│  │        │                  │              │  │
│  │        │    Tauri IPC     │              │  │
│  │        └──────┬───────────┘              │  │
│  └───────────────┼──────────────────────────┘  │
│                  │                             │
│  ┌───────────────┼──────────────────────────┐  │
│  │         Rust Backend                     │  │
│  │                                          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │ PTY Mgr  │ │ Keychain │ │  Logger  │  │  │
│  │  │ (pty.rs) │ │(.rs)     │ │ (.rs)    │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘  │  │
│  └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

## Frontend Architecture

### Component Hierarchy

```
App
├── TitleBar (draggable title + ThemeToggle)
├── Terminal (xterm.js wrapper via useTerminal hook)
├── GoalInput (user goal text input)
├── StatusBar (state, mode, provider, settings/history buttons)
├── Settings (modal overlay — provider config, mode, advanced)
├── ApprovalModal (command review in safe mode)
└── HistoryView (command execution history)
```

### State Management

The app uses React hooks and lifting state up — no Redux or other state library.

| Hook | Responsibility |
|------|---------------|
| `useTerminal` | xterm.js lifecycle, PTY connection, resize |
| `useAgent` | Agent state machine, goal execution, approval flow |
| `useSettings` | Settings persistence, Keychain API key management |
| `useTheme` | Dark/light theme toggle with localStorage |

### Agent System

The AI agent follows a **state machine pattern**:

```
idle → planning → awaiting_approval → executing → analyzing
                        ↑                              │
                        └──────── NEXT_STEP ───────────┘
                                                       │
                                              ┌────────┼────────┐
                                              ↓        ↓        ↓
                                          complete   error   retrying
                                                              │
                                                              └──→ planning
```

**Key components:**

1. **AgentContext** — Manages conversation history with token budgeting. Automatically prunes old messages when approaching the token limit (12,000).

2. **AgentPlanner** — Sends the conversation to the LLM and parses the structured JSON response into a `CommandPlan` with steps, risk levels, and rollback commands.

3. **AgentExecutor** — Orchestrates PTY command execution. Uses marker-based completion detection (`__AI_TERM_DONE_<timestamp>__`) to know when a command finishes. Handles retry logic with the planner for error recovery.

4. **AgentStateMachine** — Deterministic state transitions with listener pattern for UI reactivity.

### LLM Provider Layer

All providers implement the `LLMProvider` interface:

```typescript
interface LLMProvider {
  name: string;
  model: string;
  complete(messages): Promise<LLMResponse>;
  stream(messages): AsyncGenerator<StreamChunk>;
  testConnection(): Promise<boolean>;
}
```

Implemented providers:
- **OpenAI** — GPT-4 family, standard Bearer token auth
- **Anthropic** — Claude family, x-api-key auth, Messages API
- **Local** — OpenAI-compatible (LM Studio, Ollama, etc.)

### Safety System

Every command goes through the safety detector before execution:

- **25+ regex patterns** across 5 risk levels (safe → critical)
- **Blacklist** for truly dangerous commands (rm -rf /, fork bombs, mkfs, etc.)
- Risk analysis feeds into the ApprovalModal UI
- All commands are audit-logged with risk level, approval status, and outcome

## Rust Backend

### PTY Manager (`pty.rs`)

- Uses `portable-pty` crate for cross-platform PTY support
- Sessions stored in `Mutex<HashMap<String, Arc<Mutex<PtySession>>>>`
- Spawns a reader thread per session that emits `pty-output` events to the frontend
- Child process wait thread emits `pty-exit` events
- Supports resize, write, kill operations

### Keychain (`keychain.rs`)

- Uses `security-framework` crate for macOS Keychain access
- Service name: `com.aiterminal.app`
- Stores/retrieves/deletes API keys with account-based namespacing

### Logger (`logger.rs`)

- JSONL audit log format with daily rotation
- Stored in `~/Library/Application Support/com.aiterminal.app/logs/`
- Each entry includes: command, source, risk level, approval status, exit code, output preview

## Data Flow

### Goal Execution Flow

1. User types a goal in GoalInput
2. `useAgent.executeGoal()` called
3. State machine: idle → planning
4. AgentContext builds conversation with system prompt
5. AgentPlanner sends to LLM, receives JSON command plan
6. State machine: planning → awaiting_approval
7. ApprovalModal shown (in safe mode)
8. User approves → state machine: awaiting_approval → executing
9. AgentExecutor writes command to PTY with completion marker
10. Listens for marker in PTY output to detect completion
11. State machine: executing → analyzing
12. AgentPlanner.verifySuccess checks if command succeeded
13. If more steps: analyzing → awaiting_approval (next step)
14. If error: analyzing → retrying → planning (new fix plan)
15. If done: analyzing → complete

### Settings Persistence

- Non-sensitive settings → localStorage
- API keys → macOS Keychain (via Tauri IPC → Rust → security-framework)
- Theme preference → localStorage + `data-theme` attribute

## Build & Release

- **Dev**: `npm run tauri dev` (Vite HMR + Tauri WebView)
- **Build**: `npm run tauri build` (produces .app + .dmg)
- **CI**: GitHub Actions runs lint, tests, Rust checks, build
- **Release**: Tag-triggered workflow creates GitHub Release with DMG
