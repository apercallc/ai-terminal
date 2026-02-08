import { describe, it, expect, beforeEach } from "vitest";
import { ToolManager } from "@/lib/tools/manager";

describe("ToolManager", () => {
  let manager: ToolManager;

  beforeEach(() => {
    manager = new ToolManager();
  });

  describe("built-in tools", () => {
    it("has built-in tools", () => {
      const tools = manager.getAll();
      expect(tools.length).toBeGreaterThan(0);
    });

    it("includes system-info tool", () => {
      const tools = manager.getAll();
      expect(tools.some((t) => t.id === "tool-system-info")).toBe(true);
    });

    it("built-in tools have commands", () => {
      const tools = manager.getAll();
      tools.forEach((t) => {
        expect(t.command).toBeTruthy();
      });
    });
  });

  describe("CRUD", () => {
    it("adds custom tool", () => {
      const before = manager.getAll().length;
      manager.add({
        name: "Test Tool",
        description: "A test",
        command: "echo {{msg}}",
        icon: "",
        category: "custom",
        variables: [{ name: "msg", label: "Message", type: "text" as const, defaultValue: "" }],
      });
      expect(manager.getAll().length).toBe(before + 1);
    });

    it("removes custom tool", () => {
      manager.add({
        name: "Remove Me",
        description: "",
        command: "echo hi",
        icon: "",
        category: "custom",
        variables: [],
      });
      const tool = manager.getAll().find((t) => t.name === "Remove Me");
      expect(tool).toBeDefined();
      manager.remove(tool!.id);
      expect(manager.getAll().find((t) => t.name === "Remove Me")).toBeUndefined();
    });
  });

  describe("resolveCommand", () => {
    it("resolves variables in commands", () => {
      manager.add({
        name: "Port Check",
        description: "",
        command: "lsof -i :{{port}}",
        icon: "",
        category: "custom",
        variables: [{ name: "port", label: "Port", type: "text" as const, defaultValue: "3000" }],
      });
      const tool = manager.getAll().find((t) => t.name === "Port Check");
      expect(tool).toBeDefined();
      const resolved = manager.resolveCommand(tool!, { port: "8080" });
      expect(resolved).toBe("lsof -i :8080");
    });

    it("uses default value when not provided", () => {
      manager.add({
        name: "Echo Test",
        description: "",
        command: "echo {{msg}}",
        icon: "",
        category: "custom",
        variables: [{ name: "msg", label: "Message", type: "text" as const, defaultValue: "hello" }],
      });
      const tool = manager.getAll().find((t) => t.name === "Echo Test");
      expect(tool).toBeDefined();
      const resolved = manager.resolveCommand(tool!, {});
      expect(resolved).toBe("echo hello");
    });
  });
});
