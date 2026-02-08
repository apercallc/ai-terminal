import { describe, it, expect, beforeEach } from "vitest";
import { PluginManager } from "@/lib/plugins/manager";

describe("PluginManager", () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  describe("built-in plugins", () => {
    it("starts with empty plugin list", () => {
      const plugins = manager.getAll();
      expect(plugins.length).toBe(0);
    });

    it("can register built-in output logger", () => {
      const { manifest, handlers } = PluginManager.createOutputLoggerPlugin();
      manager.register(manifest, handlers);
      const plugins = manager.getAll();
      expect(plugins.length).toBe(1);
      expect(plugins[0].id).toBe("builtin-output-logger");
    });
  });

  describe("register/unregister", () => {
    it("registers a custom plugin", () => {
      const before = manager.getAll().length;
      manager.register(
        {
          id: "test-plugin",
          name: "Test Plugin",
          version: "1.0.0",
          description: "A test plugin",
          author: "test",
          enabled: true,
          hooks: [],
        },
        {},
      );
      expect(manager.getAll().length).toBe(before + 1);
    });

    it("unregisters a custom plugin", () => {
      manager.register(
        {
          id: "temp-plugin",
          name: "Temp",
          version: "1.0.0",
          description: "",
          author: "test",
          enabled: true,
          hooks: [],
        },
        {},
      );
      manager.unregister("temp-plugin");
      expect(manager.getAll().find((p) => p.id === "temp-plugin")).toBeUndefined();
    });
  });

  describe("enable/disable", () => {
    it("disables a plugin", () => {
      manager.register(
        {
          id: "toggle-test",
          name: "Toggle Test",
          version: "1.0.0",
          description: "",
          author: "test",
          enabled: true,
          hooks: [],
        },
        {},
      );
      manager.setEnabled("toggle-test", false);
      const plugin = manager.getAll().find((p) => p.id === "toggle-test");
      expect(plugin?.enabled).toBe(false);
    });

    it("enables a plugin", () => {
      manager.register(
        {
          id: "toggle-test-2",
          name: "Toggle Test 2",
          version: "1.0.0",
          description: "",
          author: "test",
          enabled: false,
          hooks: [],
        },
        {},
      );
      manager.setEnabled("toggle-test-2", true);
      const plugin = manager.getAll().find((p) => p.id === "toggle-test-2");
      expect(plugin?.enabled).toBe(true);
    });
  });

  describe("fireHook", () => {
    it("fires hooks and returns data", async () => {
      const result = await manager.fireHook("beforeCommand", { command: "ls" });
      expect(result).toBeDefined();
    });

    it("passes data through hooks", async () => {
      const result = await manager.fireHook("onGoal", { goal: "test goal" });
      expect(result).toBeDefined();
    });
  });
});
