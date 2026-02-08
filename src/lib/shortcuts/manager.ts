import type { KeyboardShortcut } from "@/types";

/**
 * Default keyboard shortcuts for the application.
 */
const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  // Terminal
  {
    id: "terminal-clear",
    action: "terminal.clear",
    label: "Clear Terminal",
    keys: ["Meta", "k"],
    category: "Terminal",
    editable: true,
  },
  {
    id: "terminal-copy",
    action: "terminal.copy",
    label: "Copy Selection",
    keys: ["Meta", "c"],
    category: "Terminal",
    editable: false,
  },
  {
    id: "terminal-paste",
    action: "terminal.paste",
    label: "Paste",
    keys: ["Meta", "v"],
    category: "Terminal",
    editable: false,
  },
  {
    id: "terminal-search",
    action: "terminal.search",
    label: "Search Terminal",
    keys: ["Meta", "f"],
    category: "Terminal",
    editable: true,
  },
  {
    id: "terminal-new-tab",
    action: "terminal.newTab",
    label: "New Tab",
    keys: ["Meta", "t"],
    category: "Terminal",
    editable: true,
  },
  {
    id: "terminal-close-tab",
    action: "terminal.closeTab",
    label: "Close Tab",
    keys: ["Meta", "w"],
    category: "Terminal",
    editable: true,
  },
  {
    id: "terminal-next-tab",
    action: "terminal.nextTab",
    label: "Next Tab",
    keys: ["Meta", "]"],
    category: "Terminal",
    editable: true,
  },
  {
    id: "terminal-prev-tab",
    action: "terminal.prevTab",
    label: "Previous Tab",
    keys: ["Meta", "["],
    category: "Terminal",
    editable: true,
  },
  {
    id: "terminal-split-h",
    action: "terminal.splitHorizontal",
    label: "Split Horizontally",
    keys: ["Meta", "d"],
    category: "Terminal",
    editable: true,
  },
  {
    id: "terminal-split-v",
    action: "terminal.splitVertical",
    label: "Split Vertically",
    keys: ["Meta", "Shift", "d"],
    category: "Terminal",
    editable: true,
  },

  // Agent
  {
    id: "agent-focus-input",
    action: "agent.focusInput",
    label: "Focus Goal Input",
    keys: ["Meta", "l"],
    category: "Agent",
    editable: true,
  },
  {
    id: "agent-cancel",
    action: "agent.cancel",
    label: "Cancel Agent",
    keys: ["Escape"],
    category: "Agent",
    editable: false,
  },
  {
    id: "agent-approve",
    action: "agent.approve",
    label: "Approve Step",
    keys: ["Meta", "Enter"],
    category: "Agent",
    editable: true,
  },

  // Application
  {
    id: "app-settings",
    action: "app.settings",
    label: "Open Settings",
    keys: ["Meta", ","],
    category: "Application",
    editable: true,
  },
  {
    id: "app-history",
    action: "app.history",
    label: "Open History",
    keys: ["Meta", "h"],
    category: "Application",
    editable: true,
  },
  {
    id: "app-bookmarks",
    action: "app.bookmarks",
    label: "Open Bookmarks",
    keys: ["Meta", "b"],
    category: "Application",
    editable: true,
  },
  {
    id: "app-templates",
    action: "app.templates",
    label: "Open Templates",
    keys: ["Meta", "Shift", "t"],
    category: "Application",
    editable: true,
  },
  {
    id: "app-recording",
    action: "app.toggleRecording",
    label: "Toggle Recording",
    keys: ["Meta", "Shift", "r"],
    category: "Application",
    editable: true,
  },
  {
    id: "app-voice",
    action: "app.toggleVoice",
    label: "Toggle Voice Input",
    keys: ["Meta", "Shift", "v"],
    category: "Application",
    editable: true,
  },
  {
    id: "app-palette",
    action: "app.palette",
    label: "Command Palette",
    keys: ["Meta", "Shift", "p"],
    category: "Application",
    editable: true,
  },
];

const SHORTCUTS_STORAGE_KEY = "ai_terminal_shortcuts";

type ShortcutHandler = () => void;

export class ShortcutManager {
  private shortcuts: KeyboardShortcut[];
  private handlers: Map<string, ShortcutHandler> = new Map();
  private enabled = true;

  constructor() {
    this.shortcuts = this.loadShortcuts();
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  /** Start listening for keyboard events. */
  attach(): void {
    window.addEventListener("keydown", this.handleKeyDown, { capture: true });
  }

  /** Stop listening for keyboard events. */
  detach(): void {
    window.removeEventListener("keydown", this.handleKeyDown, { capture: true });
  }

  /** Enable or disable shortcut processing. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Register a handler for a shortcut action. */
  register(action: string, handler: ShortcutHandler): () => void {
    this.handlers.set(action, handler);
    return () => this.handlers.delete(action);
  }

  /** Get all shortcuts. */
  getAll(): KeyboardShortcut[] {
    return [...this.shortcuts];
  }

  /** Get shortcuts by category. */
  getByCategory(category: string): KeyboardShortcut[] {
    return this.shortcuts.filter((s) => s.category === category);
  }

  /** Update a shortcut's key binding. */
  updateBinding(id: string, keys: string[]): boolean {
    const shortcut = this.shortcuts.find((s) => s.id === id);
    if (!shortcut || !shortcut.editable) return false;

    // Check for conflicts
    const conflict = this.shortcuts.find((s) => s.id !== id && this.keysMatch(s.keys, keys));
    if (conflict) return false;

    shortcut.keys = keys;
    this.saveShortcuts();
    return true;
  }

  /** Reset a specific shortcut to its default. */
  resetBinding(id: string): void {
    const defaultShortcut = DEFAULT_SHORTCUTS.find((s) => s.id === id);
    const current = this.shortcuts.find((s) => s.id === id);
    if (defaultShortcut && current) {
      current.keys = [...defaultShortcut.keys];
      this.saveShortcuts();
    }
  }

  /** Reset all shortcuts to defaults. */
  resetAll(): void {
    this.shortcuts = DEFAULT_SHORTCUTS.map((s) => ({ ...s, keys: [...s.keys] }));
    this.saveShortcuts();
  }

  /** Format keys for display. */
  formatKeys(keys: string[]): string {
    return keys
      .map((key) => {
        switch (key) {
          case "Meta":
            return "⌘";
          case "Control":
            return "⌃";
          case "Alt":
            return "⌥";
          case "Shift":
            return "⇧";
          case "Enter":
            return "↵";
          case "Escape":
            return "⎋";
          case "ArrowUp":
            return "↑";
          case "ArrowDown":
            return "↓";
          case "ArrowLeft":
            return "←";
          case "ArrowRight":
            return "→";
          case "Backspace":
            return "⌫";
          case "Delete":
            return "⌦";
          case "Tab":
            return "⇥";
          case " ":
            return "Space";
          default:
            return key.length === 1 ? key.toUpperCase() : key;
        }
      })
      .join("");
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return;

    // Don't intercept when typing in inputs (unless it's a global hotkey)
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

    for (const shortcut of this.shortcuts) {
      if (this.eventMatchesShortcut(e, shortcut)) {
        // Allow input shortcuts only if Meta/Ctrl is held
        if (isInput && !e.metaKey && !e.ctrlKey) continue;

        const handler = this.handlers.get(shortcut.action);
        if (handler) {
          e.preventDefault();
          e.stopPropagation();
          handler();
          return;
        }
      }
    }
  }

  private eventMatchesShortcut(e: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
    const keys = shortcut.keys;
    const needsMeta = keys.includes("Meta");
    const needsCtrl = keys.includes("Control");
    const needsAlt = keys.includes("Alt");
    const needsShift = keys.includes("Shift");

    if (needsMeta !== e.metaKey) return false;
    if (needsCtrl !== e.ctrlKey) return false;
    if (needsAlt !== e.altKey) return false;
    if (needsShift !== e.shiftKey) return false;

    const mainKey = keys.find((k) => !["Meta", "Control", "Alt", "Shift"].includes(k));

    if (!mainKey) return false;

    // Compare case-insensitively
    return (
      e.key.toLowerCase() === mainKey.toLowerCase() ||
      e.code.toLowerCase() === `key${mainKey.toLowerCase()}`
    );
  }

  private keysMatch(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((k, i) => k === sortedB[i]);
  }

  private loadShortcuts(): KeyboardShortcut[] {
    try {
      const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
      if (stored) {
        const parsed: KeyboardShortcut[] = JSON.parse(stored);
        // Merge with defaults to get any new shortcuts added in updates
        const merged = DEFAULT_SHORTCUTS.map((def) => {
          const saved = parsed.find((s) => s.id === def.id);
          return saved ? { ...def, keys: saved.keys } : { ...def, keys: [...def.keys] };
        });
        return merged;
      }
    } catch {
      // Fall through to defaults
    }
    return DEFAULT_SHORTCUTS.map((s) => ({ ...s, keys: [...s.keys] }));
  }

  private saveShortcuts(): void {
    try {
      localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(this.shortcuts));
    } catch {
      // Storage full or unavailable
    }
  }
}

/** Singleton instance */
let _manager: ShortcutManager | null = null;

export function getShortcutManager(): ShortcutManager {
  if (!_manager) {
    _manager = new ShortcutManager();
  }
  return _manager;
}
