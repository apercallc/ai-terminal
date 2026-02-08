import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { ExecutionRecord, TerminalTab, SplitLayout, SplitDirection, SplitPane } from "@/types";
import { useSettings } from "@/hooks/useSettings";
import { useTheme } from "@/hooks/useTheme";
import { useAgent } from "@/hooks/useAgent";
import { TerminalView } from "@/components/Terminal/Terminal";
import { SplitTerminalView } from "@/components/SplitTerminal/SplitTerminal";
import { GoalInput } from "@/components/GoalInput/GoalInput";
import { StatusBar } from "@/components/StatusBar/StatusBar";
import { ThemeToggle } from "@/components/ThemeToggle/ThemeToggle";
import { Settings } from "@/components/Settings/Settings";
import { ApprovalModal } from "@/components/ApprovalModal/ApprovalModal";
import { HistoryView } from "@/components/HistoryView/HistoryView";
import { TabBar } from "@/components/TabBar/TabBar";
import { TemplatesPanel } from "@/components/TemplatesPanel/TemplatesPanel";
import { BookmarksPanel } from "@/components/BookmarksPanel/BookmarksPanel";
import { ShortcutsPanel } from "@/components/ShortcutsPanel/ShortcutsPanel";
import { PluginsPanel } from "@/components/PluginsPanel/PluginsPanel";
import { ToolsPanel } from "@/components/ToolsPanel/ToolsPanel";
import { CollaborativePanel } from "@/components/CollaborativePanel/CollaborativePanel";
import { RecordingControls } from "@/components/RecordingControls/RecordingControls";
import { ExportPanel } from "@/components/ExportPanel/ExportPanel";
import { SSHPanel } from "@/components/SSHPanel/SSHPanel";
import { MetricsPanel } from "@/components/MetricsPanel/MetricsPanel";
import { GlobalPalette } from "@/components/GlobalPalette/GlobalPalette";
import type { PaletteAction } from "@/components/GlobalPalette/GlobalPalette";
import { getShortcutManager } from "@/lib/shortcuts/manager";
import { getSessionPersistence } from "@/lib/session/persistence";
import { getRecordingManager } from "@/lib/recording/manager";
import { getPluginManager } from "@/lib/plugins/manager";
import "./App.css";

function createTab(label?: string): TerminalTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: label || "Terminal",
    ptySessionId: null,
    isConnected: false,
    cwd: "~",
  };
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    settings,
    provider,
    updateSettings,
    updateProvider,
    saveApiKey,
    deleteApiKey,
    testConnection,
    connectionStatus,
    validationErrors,
    isLoading: settingsLoading,
  } = useSettings();

  // Tab management
  const [tabs, setTabs] = useState<TerminalTab[]>(() => {
    const saved = getSessionPersistence().load();
    if (saved && saved.tabs.length > 0) {
      return saved.tabs.map((t) => ({
        ...t,
        ptySessionId: null,
        isConnected: false,
      }));
    }
    return [createTab()];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const saved = getSessionPersistence().load();
    return saved?.activeTabId || tabs[0]?.id || "";
  });

  // Split layout
  const [splitLayout, setSplitLayout] = useState<SplitLayout>(() => {
    const saved = getSessionPersistence().load();
    if (saved?.splitLayout) return saved.splitLayout;
    return {
      direction: "horizontal",
      panes: [{ id: "pane-main", tabId: tabs[0]?.id || "", size: 100 }],
    };
  });
  const [activePaneId, setActivePaneId] = useState("pane-main");

  // PTY & connection state per tab
  const [ptyIds, setPtyIds] = useState<Record<string, string | null>>({});
  const [isConnected, setIsConnected] = useState(false);
  const terminalWriteRef = useRef<((data: string) => void) | null>(null);

  // Panel toggles
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showCollab, setShowCollab] = useState(false);
  const [showRecording, setShowRecording] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSSH, setShowSSH] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showGlobalPalette, setShowGlobalPalette] = useState(false);

  const [executionHistory, setExecutionHistory] = useState<ExecutionRecord[]>([]);
  const executionHistoryIdsRef = useRef<Set<string>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [terminalCwd, setTerminalCwd] = useState("~");

  const activePtyId = ptyIds[activeTabId] || null;
  const terminalBufferRef = useRef<(() => string) | null>(null);

  const {
    snapshot,
    isActive,
    executeGoal,
    approveStep,
    approveAll,
    rejectStep,
    cancel,
    reset: _reset,
    metrics,
  } = useAgent({
    provider,
    mode: settings.mode,
    ptySessionId: activePtyId,
    maxRetries: settings.maxRetries,
    commandTimeout: settings.commandTimeout,
  });

  // Derive convenience values from snapshot
  const agentState = snapshot.state;
  const pendingStep = agentState === "awaiting_approval" ? snapshot.currentStep : null;
  const currentStepIndex = snapshot.currentStepIndex;
  const totalSteps = snapshot.plan?.steps.length ?? 0;
  const planSummary = snapshot.plan?.summary ?? "";

  // Plugin manager (must be before effects that use it)
  const pluginManager = useMemo(() => getPluginManager(), []);

  // Track execution history from snapshot + fire plugin hooks + record metrics
  useEffect(() => {
    if (snapshot.history.length > 0) {
      setExecutionHistory((prev) => {
        const seen = executionHistoryIdsRef.current;
        const newRecords = snapshot.history.filter((r) => !seen.has(r.id));
        if (newRecords.length > 0) {
          for (const r of newRecords) {
            seen.add(r.id);
          }
          // Record metrics and fire plugin hooks for new records
          for (const record of newRecords) {
            metrics.recordCommand(record.success);
            if (!record.success) {
              pluginManager.fireHook("onError", {
                command: record.command,
                output: record.output,
                exitCode: record.exitCode,
              });
            }
            pluginManager.fireHook("onOutput", {
              command: record.command,
              output: record.output,
              exitCode: record.exitCode,
            });
          }
          return [...prev, ...newRecords];
        }
        return prev;
      });
    }
  }, [snapshot.history, metrics, pluginManager]);

  // Fire onPlanReady plugin hook when plan becomes available
  useEffect(() => {
    if (snapshot.plan && agentState === "awaiting_approval" && currentStepIndex === 0) {
      pluginManager.fireHook("onPlanReady", { goal: snapshot.goal });
    }
  }, [snapshot.plan, agentState, currentStepIndex, pluginManager, snapshot.goal]);

  // Record retries in metrics
  useEffect(() => {
    if (snapshot.retryCount > 0 && agentState === "retrying") {
      metrics.recordRetry();
    }
  }, [snapshot.retryCount, agentState, metrics]);

  // Persist session state
  useEffect(() => {
    const persistence = getSessionPersistence();
    persistence.save({
      tabs,
      activeTabId,
      splitLayout,
    });
  }, [tabs, activeTabId, splitLayout]);

  const handleSplit = useCallback(
    (direction: SplitDirection) => {
      setSplitLayout((prev) => {
        const newPane: SplitPane = {
          id: `pane-${Date.now()}`,
          tabId: activeTabId,
          size: 100 / (prev.panes.length + 1),
        };
        const equalSize = 100 / (prev.panes.length + 1);
        return {
          direction,
          panes: [...prev.panes.map((p) => ({ ...p, size: equalSize })), newPane],
        };
      });
    },
    [activeTabId],
  );

  // Initialize keyboard shortcuts
  useEffect(() => {
    const shortcutManager = getShortcutManager();
    shortcutManager.register("terminal.newTab", () =>
      setTabs((prev) => {
        const t = createTab(`Terminal ${prev.length + 1}`);
        setActiveTabId(t.id);
        return [...prev, t];
      }),
    );
    shortcutManager.register("terminal.closeTab", () => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev;
        const idx = prev.findIndex((t) => t.id === activeTabId);
        const next = prev.filter((t) => t.id !== activeTabId);
        setActiveTabId(next[Math.min(idx, next.length - 1)].id);
        return next;
      });
    });
    shortcutManager.register("terminal.clear", () => {
      // Terminal clear handled by ref
    });
    shortcutManager.register("terminal.splitHorizontal", () => handleSplit("horizontal"));
    shortcutManager.register("terminal.splitVertical", () => handleSplit("vertical"));
    shortcutManager.register("terminal.nextTab", () => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === activeTabId);
        const nextIdx = (idx + 1) % prev.length;
        setActiveTabId(prev[nextIdx].id);
        return prev;
      });
    });
    shortcutManager.register("terminal.prevTab", () => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === activeTabId);
        const prevIdx = (idx - 1 + prev.length) % prev.length;
        setActiveTabId(prev[prevIdx].id);
        return prev;
      });
    });
    shortcutManager.register("app.settings", () => setShowSettings((v) => !v));
    shortcutManager.register("app.history", () => setShowHistory((v) => !v));
    shortcutManager.register("app.bookmarks", () => setShowBookmarks((v) => !v));
    shortcutManager.register("app.templates", () => setShowTemplates((v) => !v));
    shortcutManager.register("app.toggleRecording", () => setShowRecording((v) => !v));
    shortcutManager.register("app.toggleVoice", () => {
      // Voice toggle is handled by VoiceButton component
    });
    shortcutManager.register("agent.focusInput", () => {
      // Focus the goal input
      const input = document.querySelector<HTMLInputElement>(".goal-input");
      input?.focus();
    });
    shortcutManager.register("agent.cancel", () => {
      cancel();
    });
    shortcutManager.register("agent.approve", () => {
      if (agentState === "awaiting_approval") {
        approveStep();
      }
    });
    shortcutManager.register("app.palette", () => {
      setShowGlobalPalette((v) => !v);
    });
    shortcutManager.attach();

    return () => {
      shortcutManager.detach();
    };
  }, [activeTabId, agentState, cancel, approveStep, handleSplit]);

  // Track recording state
  useEffect(() => {
    const manager = getRecordingManager();
    const interval = setInterval(() => {
      const next = manager.isRecording();
      setIsRecording((prev) => (prev === next ? prev : next));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Poll CWD from the Rust backend
  useEffect(() => {
    if (!activePtyId) return;
    let cancelled = false;

    let invokeFn:
      | (<T>(cmd: string, args?: Record<string, unknown>) => Promise<T>)
      | null = null;
    const poll = async () => {
      try {
        if (!invokeFn) {
          const mod = await import("@tauri-apps/api/core");
          invokeFn = mod.invoke;
        }
        const cwd = await invokeFn<string>("get_cwd", { sessionId: activePtyId });
        if (!cancelled && cwd) {
          setTerminalCwd((prev) => (prev === cwd ? prev : cwd));
        }
      } catch {
        // ignore — session may have ended
      }
    };
    poll(); // initial fetch
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activePtyId]);

  const handlePtyReady = useCallback(
    (id: string) => {
      setPtyIds((prev) => ({ ...prev, [activeTabId]: id }));
    },
    [activeTabId],
  );

  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected);
  }, []);

  const handleGoalSubmit = useCallback(
    async (goal: string) => {
      if (!activePtyId) return;

      if (settings.provider.type !== "local" && !settings.provider.apiKey) {
        setShowSettings(true);
        return;
      }

      // Fire plugin hook
      const hookResult = await pluginManager.fireHook("onGoal", { goal });
      const finalGoal = hookResult?.goal || goal;

      await executeGoal(finalGoal);
    },
    [activePtyId, settings.provider, executeGoal, pluginManager],
  );

  const handleExportHistory = useCallback(() => {
    const data = JSON.stringify(executionHistory, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-terminal-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [executionHistory]);

  const handleNewTab = useCallback(() => {
    const tab = createTab(`Terminal ${tabs.length + 1}`);
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, [tabs.length]);

  const handleCloseTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev;
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        if (id === activeTabId) {
          setActiveTabId(next[Math.min(idx, next.length - 1)].id);
        }
        return next;
      });
    },
    [activeTabId],
  );

  const handleClosePane = useCallback(
    (paneId: string) => {
      setSplitLayout((prev) => {
        const remaining = prev.panes.filter((p) => p.id !== paneId);
        if (remaining.length === 0) return prev;
        const equalSize = 100 / remaining.length;
        return {
          ...prev,
          panes: remaining.map((p) => ({ ...p, size: equalSize })),
        };
      });
      if (paneId === activePaneId) {
        setSplitLayout((prev) => {
          if (prev.panes.length > 0) {
            setActivePaneId(prev.panes[0].id);
          }
          return prev;
        });
      }
    },
    [activePaneId],
  );

  const handleExecuteCommand = useCallback(
    (command: string) => {
      if (!activePtyId) return;

      void (async () => {
        let finalCommand = command;
        try {
          // Fire plugin hooks
          const ctx = await pluginManager.fireHook("beforeCommand", { command });
          finalCommand = ctx.command || command;

          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("write_to_pty", { sessionId: activePtyId, data: finalCommand + "\n" });

          // Fire afterCommand hook (no output yet, that comes from PTY)
          await pluginManager.fireHook("afterCommand", { command: finalCommand, exitCode: 0 });
        } catch (err) {
          // Avoid unhandled promise rejections from hooks or invoke()
          // (UI is resilient; errors are visible in devtools)
          // eslint-disable-next-line no-console
          console.error("Failed to execute command", err);
          try {
            await pluginManager.fireHook("afterCommand", { command: finalCommand, exitCode: 1 });
          } catch {
            // Ignore hook failures
          }
        }
      })();
    },
    [activePtyId, pluginManager],
  );

  const handleBufferReady = useCallback((getContent: () => string) => {
    terminalBufferRef.current = getContent;
  }, []);

  const getTerminalContent = useCallback(() => {
    return terminalBufferRef.current?.() || "";
  }, []);

  const paletteActions = useMemo<PaletteAction[]>(
    () => [
      { id: "new-tab", label: "New Terminal Tab", icon: "+", shortcut: "⌘T", action: handleNewTab },
      {
        id: "split-h",
        label: "Split Horizontal",
        icon: "⬌",
        shortcut: "⌘\\",
        action: () => handleSplit("horizontal"),
      },
      {
        id: "split-v",
        label: "Split Vertical",
        icon: "⬍",
        shortcut: "⌘⇧\\",
        action: () => handleSplit("vertical"),
      },
      {
        id: "settings",
        label: "Open Settings",
        icon: "⚙",
        shortcut: "⌘,",
        action: () => setShowSettings(true),
      },
      {
        id: "history",
        label: "View History",
        icon: "📋",
        shortcut: "⌘H",
        action: () => setShowHistory(true),
      },
      { id: "metrics", label: "Metrics Dashboard", icon: "📊", action: () => setShowMetrics(true) },
      {
        id: "bookmarks",
        label: "Bookmarks",
        icon: "★",
        shortcut: "⌘B",
        action: () => setShowBookmarks(true),
      },
      { id: "templates", label: "Templates", icon: "⧉", action: () => setShowTemplates(true) },
      { id: "tools", label: "Tools", icon: "⚒", action: () => setShowTools(true) },
      {
        id: "recording",
        label: "Recording Controls",
        icon: "⏺",
        action: () => setShowRecording(true),
      },
      { id: "export", label: "Export Terminal", icon: "↓", action: () => setShowExport(true) },
      { id: "plugins", label: "Plugins", icon: "🔌", action: () => setShowPlugins(true) },
      {
        id: "shortcuts",
        label: "Keyboard Shortcuts",
        icon: "⌨",
        action: () => setShowShortcuts(true),
      },
      { id: "ssh", label: "SSH Connections", icon: "⇄", action: () => setShowSSH(true) },
      { id: "collab", label: "Collaborate", icon: "👥", action: () => setShowCollab(true) },
      { id: "cancel-agent", label: "Cancel Agent", icon: "✖", shortcut: "⌘.", action: cancel },
    ],
    [handleNewTab, handleSplit, cancel],
  );

  return (
    <div className="app" data-theme={theme}>
      <div className="app-titlebar">
        <div className="titlebar-left">
          <span className="app-title">AI Terminal</span>
        </div>
        <div className="titlebar-right">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </div>

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
      />

      <div className="app-terminal">
        <SplitTerminalView
          layout={splitLayout}
          onLayoutChange={setSplitLayout}
          activePaneId={activePaneId}
          onActivatePane={setActivePaneId}
          onSplit={handleSplit}
          onClosePane={handleClosePane}
          renderTerminal={() => (
            <TerminalView
              key={activeTabId}
              theme={theme}
              scrollbackLimit={settings.scrollbackLimit}
              onSessionReady={handlePtyReady}
              onConnectionChange={handleConnectionChange}
              onBufferReady={handleBufferReady}
            />
          )}
        />
      </div>

      <div className="app-input">
        <GoalInput
          onSubmit={handleGoalSubmit}
          onCancel={cancel}
          agentState={agentState}
          disabled={isActive}
          ptySessionId={activePtyId}
        />
      </div>

      <StatusBar
        agentState={agentState}
        currentStep={currentStepIndex}
        totalSteps={totalSteps}
        mode={settings.mode}
        providerType={settings.provider.type}
        connectionStatus={connectionStatus}
        isConnected={isConnected}
        isRecording={isRecording}
        onSettingsClick={() => setShowSettings(true)}
        onHistoryClick={() => setShowHistory(true)}
        onBookmarksClick={() => setShowBookmarks(true)}
        onTemplatesClick={() => setShowTemplates(true)}
        onToolsClick={() => setShowTools(true)}
        onRecordingClick={() => setShowRecording(true)}
        onCollabClick={() => setShowCollab(true)}
        onSSHClick={() => setShowSSH(true)}
        onExportClick={() => setShowExport(true)}
        onShortcutsClick={() => setShowShortcuts(true)}
        onPluginsClick={() => setShowPlugins(true)}
        onMetricsClick={() => setShowMetrics(true)}
        onPaletteClick={() => setShowGlobalPalette(true)}
        cwd={terminalCwd}
      />

      {showSettings && (
        <Settings
          settings={settings}
          onUpdateSettings={updateSettings}
          onUpdateProvider={updateProvider}
          onSaveApiKey={saveApiKey}
          onDeleteApiKey={deleteApiKey}
          onTestConnection={testConnection}
          connectionStatus={connectionStatus}
          validationErrors={validationErrors}
          isLoading={settingsLoading}
          onClose={() => setShowSettings(false)}
        />
      )}

      {pendingStep && (
        <ApprovalModal
          step={pendingStep}
          stepIndex={currentStepIndex}
          totalSteps={totalSteps}
          planSummary={planSummary}
          onApprove={approveStep}
          onReject={rejectStep}
          onApproveAll={approveAll}
        />
      )}

      {showHistory && (
        <HistoryView
          history={executionHistory}
          onClose={() => setShowHistory(false)}
          onExport={handleExportHistory}
        />
      )}

      {showTemplates && (
        <TemplatesPanel
          onClose={() => setShowTemplates(false)}
          onExecute={(steps: string[]) => steps.forEach(handleExecuteCommand)}
        />
      )}

      {showBookmarks && (
        <BookmarksPanel onClose={() => setShowBookmarks(false)} onExecute={handleExecuteCommand} />
      )}

      {showShortcuts && <ShortcutsPanel onClose={() => setShowShortcuts(false)} />}

      {showPlugins && <PluginsPanel onClose={() => setShowPlugins(false)} />}

      {showTools && (
        <ToolsPanel onClose={() => setShowTools(false)} onExecute={handleExecuteCommand} />
      )}

      {showCollab && (
        <CollaborativePanel onClose={() => setShowCollab(false)} onExecute={handleExecuteCommand} />
      )}

      {showRecording && (
        <RecordingControls
          onClose={() => setShowRecording(false)}
          terminalWrite={(data) => terminalWriteRef.current?.(data)}
        />
      )}

      {showExport && (
        <ExportPanel onClose={() => setShowExport(false)} getTerminalContent={getTerminalContent} />
      )}

      {showSSH && <SSHPanel onClose={() => setShowSSH(false)} onConnect={handleExecuteCommand} />}

      {showMetrics && (
        <MetricsPanel onClose={() => setShowMetrics(false)} currentMetrics={metrics} />
      )}

      {showGlobalPalette && (
        <GlobalPalette onClose={() => setShowGlobalPalette(false)} actions={paletteActions} />
      )}
    </div>
  );
}
