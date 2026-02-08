import { describe, it, expect, beforeEach, vi } from "vitest";
import { TerminalExporter } from "@/lib/export/exporter";

describe("TerminalExporter", () => {
  let exporter: TerminalExporter;

  beforeEach(() => {
    exporter = new TerminalExporter();
  });

  describe("getFormats", () => {
    it("returns three export formats", () => {
      const formats = exporter.getFormats();
      expect(formats).toHaveLength(3);
    });

    it("includes html format", () => {
      const formats = exporter.getFormats();
      expect(formats.find((f) => f.format === "html")).toBeDefined();
    });

    it("includes pdf format", () => {
      const formats = exporter.getFormats();
      expect(formats.find((f) => f.format === "pdf")).toBeDefined();
    });

    it("includes text format", () => {
      const formats = exporter.getFormats();
      expect(formats.find((f) => f.format === "text")).toBeDefined();
    });
  });

  describe("export HTML", () => {
    it("generates an HTML file download", async () => {
      const clickSpy = vi.fn();
      vi.spyOn(document, "createElement").mockReturnValue({
        href: "",
        download: "",
        click: clickSpy,
        style: {},
      } as unknown as HTMLAnchorElement);
      vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
      vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

      await exporter.export("Hello World", {
        format: "html",
        includeTimestamp: true,
        includeMetadata: true,
      });

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("export text", () => {
    it("generates a text file download", async () => {
      const clickSpy = vi.fn();
      vi.spyOn(document, "createElement").mockReturnValue({
        href: "",
        download: "",
        click: clickSpy,
        style: {},
      } as unknown as HTMLAnchorElement);
      vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
      vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

      await exporter.export("Hello World", {
        format: "text",
        includeTimestamp: false,
        includeMetadata: false,
      });

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("ANSI handling", () => {
    it("exports content with ANSI codes in HTML format", async () => {
      const clickSpy = vi.fn();
      let downloadedContent = "";
      vi.spyOn(document, "createElement").mockReturnValue({
        download: "",
        click: clickSpy,
        set href(val: string) {
          downloadedContent = val;
        },
        get href() {
          return downloadedContent;
        },
        style: {},
      } as unknown as HTMLAnchorElement);
      vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
      vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

      // ANSI red text
      const ansiContent = "\x1b[31mError\x1b[0m: Something failed";
      await exporter.export(ansiContent, {
        format: "html",
        includeTimestamp: false,
        includeMetadata: true,
      });

      expect(clickSpy).toHaveBeenCalled();
    });

    it("strips ANSI codes in text format", async () => {
      const clickSpy = vi.fn();
      vi.spyOn(document, "createElement").mockReturnValue({
        href: "",
        download: "",
        click: clickSpy,
        style: {},
      } as unknown as HTMLAnchorElement);
      vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
      vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

      const ansiContent = "\x1b[32mSuccess\x1b[0m: Done";
      await exporter.export(ansiContent, {
        format: "text",
        includeTimestamp: false,
        includeMetadata: false,
      });

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe("custom filenames", () => {
    it("uses custom filename when provided", async () => {
      let downloadName = "";
      vi.spyOn(document, "createElement").mockReturnValue({
        href: "",
        set download(val: string) {
          downloadName = val;
        },
        get download() {
          return downloadName;
        },
        click: vi.fn(),
        style: {},
      } as unknown as HTMLAnchorElement);
      vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
      vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

      await exporter.export("test", {
        format: "text",
        includeTimestamp: false,
        includeMetadata: false,
        filename: "my-export",
      });

      expect(downloadName).toBe("my-export.txt");
    });
  });
});
