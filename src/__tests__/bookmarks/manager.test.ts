import { describe, it, expect, beforeEach } from "vitest";
import { BookmarkManager } from "@/lib/bookmarks/manager";

describe("BookmarkManager", () => {
  let manager: BookmarkManager;

  beforeEach(() => {
    manager = new BookmarkManager();
  });

  describe("add", () => {
    it("adds a bookmark", () => {
      manager.add({ command: "ls -la", name: "List files", description: "", tags: ["file"] });
      expect(manager.getAll()).toHaveLength(1);
      expect(manager.getAll()[0].command).toBe("ls -la");
    });

    it("assigns unique ids", () => {
      manager.add({ command: "ls", name: "LS", description: "", tags: [] });
      manager.add({ command: "pwd", name: "PWD", description: "", tags: [] });
      const ids = manager.getAll().map((b) => b.id);
      expect(new Set(ids).size).toBe(2);
    });
  });

  describe("remove", () => {
    it("removes a bookmark by id", () => {
      manager.add({ command: "ls", name: "LS", description: "", tags: [] });
      const id = manager.getAll()[0].id;
      manager.remove(id);
      expect(manager.getAll()).toHaveLength(0);
    });
  });

  describe("search", () => {
    it("searches bookmarks by query", () => {
      manager.add({ command: "git status", name: "Git Status", description: "Check repo", tags: ["git"] });
      manager.add({ command: "npm test", name: "Run tests", description: "test suite", tags: ["npm"] });
      const results = manager.search("git");
      expect(results.length).toBe(1);
      expect(results[0].command).toBe("git status");
    });
  });

  describe("tags", () => {
    it("returns all unique tags", () => {
      manager.add({ command: "ls", name: "LS", description: "", tags: ["file", "unix"] });
      manager.add({ command: "pwd", name: "PWD", description: "", tags: ["unix", "nav"] });
      const tags = manager.getTags();
      expect(tags).toContain("file");
      expect(tags).toContain("unix");
      expect(tags).toContain("nav");
    });

    it("filters by tag", () => {
      manager.add({ command: "ls", name: "LS", description: "", tags: ["file"] });
      manager.add({ command: "pwd", name: "PWD", description: "", tags: ["nav"] });
      const results = manager.getByTag("file");
      expect(results).toHaveLength(1);
      expect(results[0].command).toBe("ls");
    });
  });

  describe("export/import", () => {
    it("exports as JSON", () => {
      manager.add({ command: "ls", name: "LS", description: "", tags: [] });
      const exported = manager.export();
      expect(() => JSON.parse(exported)).not.toThrow();
    });

    it("imports from JSON", () => {
      manager.add({ command: "ls", name: "LS", description: "", tags: [] });
      const exported = manager.export();
      const newManager = new BookmarkManager();
      newManager.import(exported);
      expect(newManager.getAll().length).toBeGreaterThanOrEqual(1);
    });
  });
});
