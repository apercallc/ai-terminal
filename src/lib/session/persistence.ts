import type { PersistedSession, TerminalTab, SplitLayout } from "@/types";

const SESSION_STORAGE_KEY = "ai_terminal_session";

/**
 * Manages terminal session persistence across app restarts.
 * Saves tab layout, working directories, and split configuration.
 */
export class SessionPersistence {
  /** Save the current session state. */
  save(state: {
    tabs: TerminalTab[];
    activeTabId: string;
    splitLayout: SplitLayout | null;
  }): void {
    try {
      const session: PersistedSession = {
        id: `session-${Date.now()}`,
        tabs: state.tabs.map((t) => ({
          id: t.id,
          label: t.label,
          cwd: t.cwd,
        })),
        activeTabId: state.activeTabId,
        splitLayout: state.splitLayout,
        bookmarks: [],
        savedAt: Date.now(),
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage unavailable
    }
  }

  /** Load the last saved session, if any. */
  load(): PersistedSession | null {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const session = JSON.parse(stored) as PersistedSession;
        // Don't restore sessions older than 24 hours
        if (Date.now() - session.savedAt > 24 * 60 * 60 * 1000) {
          this.clear();
          return null;
        }
        return session;
      }
    } catch {
      // Fall through
    }
    return null;
  }

  /** Clear the saved session. */
  clear(): void {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Storage unavailable
    }
  }

  /** Check if there is a session to restore. */
  hasSession(): boolean {
    return this.load() !== null;
  }
}

/** Singleton instance */
let _persistence: SessionPersistence | null = null;

export function getSessionPersistence(): SessionPersistence {
  if (!_persistence) {
    _persistence = new SessionPersistence();
  }
  return _persistence;
}
