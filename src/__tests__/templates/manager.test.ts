import { describe, it, expect, beforeEach } from "vitest";
import { TemplateManager } from "@/lib/templates/manager";

describe("TemplateManager", () => {
  let manager: TemplateManager;

  beforeEach(() => {
    manager = new TemplateManager();
  });

  describe("built-in templates", () => {
    it("has built-in templates", () => {
      const templates = manager.getAll();
      expect(templates.length).toBeGreaterThan(0);
    });

    it("includes setup-python template", () => {
      const template = manager.getById("setup-python");
      expect(template).toBeDefined();
      expect(template!.name).toContain("Python");
    });

    it("includes setup-node template", () => {
      const template = manager.getById("setup-node");
      expect(template).toBeDefined();
    });

    it("templates have steps", () => {
      const templates = manager.getAll();
      templates.forEach((t) => {
        expect(t.steps.length).toBeGreaterThan(0);
      });
    });
  });

  describe("categories", () => {
    it("returns available categories", () => {
      const categories = manager.getCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toContain("Python");
    });

    it("filters by category", () => {
      const filtered = manager.getByCategory("Python");
      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((t) => {
        expect(t.category).toBe("Python");
      });
    });
  });

  describe("custom templates", () => {
    it("adds custom template", () => {
      const before = manager.getAll().length;
      manager.addCustom({
        name: "Test Template",
        description: "A test",
        category: "custom",
        steps: ["echo test"],
        variables: [],
      });
      expect(manager.getAll().length).toBe(before + 1);
    });

    it("removes custom template", () => {
      manager.addCustom({
        name: "To Remove",
        description: "",
        category: "custom",
        steps: ["echo"],
        variables: [],
      });
      const all = manager.getAll();
      const custom = all.find((t) => t.name === "To Remove");
      expect(custom).toBeDefined();
      manager.removeCustom(custom!.id);
      expect(manager.getById(custom!.id)).toBeUndefined();
    });
  });

  describe("variable resolution", () => {
    it("resolves variables in commands", () => {
      const template = manager.getById("setup-python");
      if (template) {
        const resolved = manager.resolveSteps(template, {
          projectName: "myapp",
          packages: "flask",
        });
        expect(resolved.some((cmd: string) => cmd.includes("myapp"))).toBe(true);
      }
    });
  });

  describe("search", () => {
    it("searches templates by name", () => {
      const results = manager.search("python");
      expect(results.length).toBeGreaterThan(0);
    });

    it("returns empty for no match", () => {
      const results = manager.search("xyznonexistent");
      expect(results).toHaveLength(0);
    });
  });
});
