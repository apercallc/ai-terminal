import { describe, it, expect, beforeEach } from "vitest";
import { SessionPersistence } from "@/lib/session/persistence";

describe("SessionPersistence", () => {
  let persistence: SessionPersistence;

  beforeEach(() => {
    persistence = new SessionPersistence();
  });

  describe("save/load", () => {
    it("saves and loads session", () => {
      persistence.save({
        tabs: [
          { id: "tab-1", label: "Terminal", ptySessionId: null, isConnected: false, cwd: "~" },
        ],
        activeTabId: "tab-1",
        splitLayout: {
          direction: "horizontal",
          panes: [{ id: "pane-1", tabId: "tab-1", size: 100 }],
        },
      });
      const loaded = persistence.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.tabs).toHaveLength(1);
      expect(loaded!.activeTabId).toBe("tab-1");
    });

    it("returns null when no session saved", () => {
      const loaded = persistence.load();
      expect(loaded).toBeNull();
    });
  });

  describe("expiry", () => {
    it("returns null for expired sessions", () => {
      // Manually insert an expired session into localStorage
      // (persistence.save() always sets savedAt to Date.now(), so we bypass it)
      const expiredSession = {
        id: "session-expired",
        tabs: [{ id: "tab-1" }],
        activeTabId: "tab-1",
        splitLayout: null,
        bookmarks: [],
        savedAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      };
      localStorage.setItem("ai_terminal_session", JSON.stringify(expiredSession));
      const loaded = persistence.load();
      expect(loaded).toBeNull();
    });
  });

  describe("clear", () => {
    it("clears saved session", () => {
      persistence.save({
        tabs: [
          { id: "tab-1", label: "Terminal", ptySessionId: null, isConnected: false, cwd: "~" },
        ],
        activeTabId: "tab-1",
        splitLayout: { direction: "horizontal", panes: [{ id: "p", tabId: "tab-1", size: 100 }] },
      });
      persistence.clear();
      expect(persistence.load()).toBeNull();
    });
  });
});
