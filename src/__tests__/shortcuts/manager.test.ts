import { describe, it, expect, beforeEach, vi } from "vitest";
import { ShortcutManager } from "@/lib/shortcuts/manager";

describe("ShortcutManager", () => {
  let manager: ShortcutManager;

  beforeEach(() => {
    localStorage.clear();
    manager = new ShortcutManager();
  });

  describe("default shortcuts", () => {
    it("has default shortcuts", () => {
      const shortcuts = manager.getAll();
      expect(shortcuts.length).toBeGreaterThan(0);
    });

    it("includes new-tab shortcut", () => {
      const shortcuts = manager.getAll();
      expect(shortcuts.some((s) => s.id === "terminal-new-tab")).toBe(true);
    });

    it("includes settings shortcut", () => {
      const shortcuts = manager.getAll();
      expect(shortcuts.some((s) => s.id === "app-settings")).toBe(true);
    });
  });

  describe("updateBinding", () => {
    it("updates shortcut key binding", () => {
      const result = manager.updateBinding("terminal-new-tab", ["Control", "n"]);
      expect(result).toBe(true);
      const shortcut = manager.getAll().find((s) => s.id === "terminal-new-tab");
      expect(shortcut?.keys).toEqual(["Control", "n"]);
    });

    it("rejects updates for non-editable shortcuts", () => {
      const result = manager.updateBinding("terminal-copy", ["Meta", "Shift", "c"]);
      expect(result).toBe(false);
    });
  });

  describe("register", () => {
    it("registers action handlers", () => {
      const handler = vi.fn();
      const cleanup = manager.register("terminal.newTab", handler);
      expect(handler).not.toHaveBeenCalled();
      cleanup();
    });
  });

  describe("reset", () => {
    it("resets to defaults", () => {
      manager.updateBinding("terminal-new-tab", ["Control", "n"]);
      manager.resetAll();
      const shortcut = manager.getAll().find((s) => s.id === "terminal-new-tab");
      expect(shortcut?.keys).toEqual(["Meta", "t"]);
    });
  });

  describe("formatKeys", () => {
    it("formats mac shortcuts with symbols", () => {
      const formatted = manager.formatKeys(["Meta", "t"]);
      expect(formatted).toContain("⌘");
    });
  });
});
