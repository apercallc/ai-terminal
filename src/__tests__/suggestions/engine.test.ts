import { describe, it, expect, beforeEach } from "vitest";
import { SuggestionEngine } from "@/lib/suggestions/engine";
import type { DirectoryEntry } from "@/types";

describe("SuggestionEngine", () => {
  let engine: SuggestionEngine;

  beforeEach(() => {
    engine = new SuggestionEngine();
  });

  describe("getSuggestions", () => {
    it("returns suggestions matching prefix", () => {
      const results = engine.getSuggestions("ls", 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((s) => s.command.startsWith("ls"))).toBe(true);
    });

    it("returns empty for no match", () => {
      const results = engine.getSuggestions("xyznonexistent", 5);
      expect(results).toHaveLength(0);
    });

    it("limits results count", () => {
      const results = engine.getSuggestions("g", 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("matches git commands", () => {
      const results = engine.getSuggestions("git", 10);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((s) => s.command.toLowerCase().includes("git"))).toBe(true);
    });

    it("matches npm commands", () => {
      const results = engine.getSuggestions("npm", 10);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("recordCommand", () => {
    it("tracks command frequency", () => {
      engine.recordCommand("ls -la");
      engine.recordCommand("ls -la");
      engine.recordCommand("ls -la");
      const results = engine.getSuggestions("ls", 10);
      const lsLa = results.find((s) => s.command === "ls -la");
      expect(lsLa).toBeDefined();
      expect(lsLa!.frequency).toBe(3);
    });

    it("boosts frequently used commands in ranking", () => {
      engine.recordCommand("ls -la");
      engine.recordCommand("ls -la");
      engine.recordCommand("ls -la");
      const results = engine.getSuggestions("ls", 10);
      // The frequently used command should appear near the top
      const idx = results.findIndex((s) => s.command === "ls -la");
      expect(idx).toBeLessThan(3);
    });
  });

  describe("fuzzy matching", () => {
    it("matches partial input", () => {
      const results = engine.getSuggestions("doc", 10);
      expect(results.some((s) => s.command.includes("docker"))).toBe(true);
    });
  });

  describe("parsePathInput", () => {
    it("returns null for plain commands without space", () => {
      expect(engine.parsePathInput("cd")).toBeNull();
      expect(engine.parsePathInput("ls")).toBeNull();
    });

    it("returns null for non-path commands", () => {
      expect(engine.parsePathInput("git status")).toBeNull();
      expect(engine.parsePathInput("npm install")).toBeNull();
    });

    it("parses cd with no path (list cwd)", () => {
      const result = engine.parsePathInput("cd ");
      expect(result).not.toBeNull();
      expect(result!.baseCommand).toBe("cd");
      expect(result!.dirToList).toBe(".");
      expect(result!.prefix).toBe("");
    });

    it("parses cd with partial name", () => {
      const result = engine.parsePathInput("cd Doc");
      expect(result).not.toBeNull();
      expect(result!.baseCommand).toBe("cd");
      expect(result!.dirToList).toBe(".");
      expect(result!.prefix).toBe("Doc");
    });

    it("parses cd with directory path", () => {
      const result = engine.parsePathInput("cd Documents/");
      expect(result).not.toBeNull();
      expect(result!.baseCommand).toBe("cd");
      expect(result!.dirToList).toBe("Documents/");
      expect(result!.prefix).toBe("");
    });

    it("parses cd with path and partial name", () => {
      const result = engine.parsePathInput("cd Documents/pro");
      expect(result).not.toBeNull();
      expect(result!.baseCommand).toBe("cd");
      expect(result!.dirToList).toBe("Documents/");
      expect(result!.prefix).toBe("pro");
    });

    it("parses absolute paths", () => {
      const result = engine.parsePathInput("cat /etc/hos");
      expect(result).not.toBeNull();
      expect(result!.baseCommand).toBe("cat");
      expect(result!.dirToList).toBe("/etc/");
      expect(result!.prefix).toBe("hos");
    });

    it("parses ls, cat, vim, and other path commands", () => {
      for (const cmd of ["ls", "cat", "vim", "nano", "less", "head", "tail", "open", "code"]) {
        const result = engine.parsePathInput(`${cmd} test`);
        expect(result).not.toBeNull();
        expect(result!.baseCommand).toBe(cmd);
      }
    });
  });

  describe("buildPathSuggestions", () => {
    const mockEntries: DirectoryEntry[] = [
      { name: "Desktop", path: "/home/user/Desktop", isDir: true },
      { name: "Documents", path: "/home/user/Documents", isDir: true },
      { name: "Downloads", path: "/home/user/Downloads", isDir: true },
      { name: ".config", path: "/home/user/.config", isDir: true },
      { name: "file.txt", path: "/home/user/file.txt", isDir: false },
      { name: "notes.md", path: "/home/user/notes.md", isDir: false },
    ];

    it("returns all non-hidden entries when no prefix", () => {
      const results = engine.buildPathSuggestions(mockEntries, "ls", "", "", false);
      expect(results.length).toBe(5); // Excludes .config
      expect(results.some((s) => s.command.includes(".config"))).toBe(false);
    });

    it("shows hidden files when prefix starts with dot", () => {
      const results = engine.buildPathSuggestions(mockEntries, "ls", "", ".", true);
      expect(results.some((s) => s.command.includes(".config"))).toBe(true);
    });

    it("filters by prefix", () => {
      const results = engine.buildPathSuggestions(mockEntries, "cd", "", "Do", false);
      expect(results.length).toBe(2); // Documents, Downloads
      expect(results.every((s) => s.command.startsWith("cd Do"))).toBe(true);
    });

    it("cd shows only directories", () => {
      const results = engine.buildPathSuggestions(mockEntries, "cd", "", "", false);
      expect(results.every((s) => s.icon === "folder")).toBe(true);
      expect(results.some((s) => s.command.includes("file.txt"))).toBe(false);
    });

    it("ls shows both files and directories", () => {
      const results = engine.buildPathSuggestions(mockEntries, "ls", "", "", false);
      expect(results.some((s) => s.icon === "folder")).toBe(true);
      expect(results.some((s) => s.icon === "file")).toBe(true);
    });

    it("appends / to directory suggestions", () => {
      const results = engine.buildPathSuggestions(mockEntries, "cd", "", "Des", false);
      expect(results[0].command).toBe("cd Desktop/");
    });

    it("includes dir prefix in command", () => {
      const subEntries: DirectoryEntry[] = [
        { name: "projects", path: "/home/user/Documents/projects", isDir: true },
      ];
      const results = engine.buildPathSuggestions(subEntries, "cd", "Documents/", "", false);
      expect(results[0].command).toBe("cd Documents/projects/");
    });

    it("limits results to maxResults", () => {
      const results = engine.buildPathSuggestions(mockEntries, "ls", "", "", false, 2);
      expect(results.length).toBe(2);
    });

    it("sets correct icon for folders and files", () => {
      const results = engine.buildPathSuggestions(mockEntries, "ls", "", "", false);
      const folder = results.find((s) => s.command.includes("Desktop"));
      const file = results.find((s) => s.command.includes("file.txt"));
      expect(folder?.icon).toBe("folder");
      expect(file?.icon).toBe("file");
    });

    it("provides file type descriptions", () => {
      const results = engine.buildPathSuggestions(mockEntries, "cat", "", "", false);
      const md = results.find((s) => s.command.includes("notes.md"));
      expect(md?.description).toBe("Markdown file");
    });
  });
});
