import type { ExportFormat, ExportOptions } from "@/types";

/**
 * Terminal content exporter — supports HTML, PDF, and plain text formats.
 */
export class TerminalExporter {
  /**
   * Export terminal content to the specified format.
   * Triggers a browser download of the exported file.
   */
  async export(
    content: string,
    options: ExportOptions,
  ): Promise<void> {
    const filename = options.filename ||
      `terminal-export-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}`;

    switch (options.format) {
      case "html":
        this.exportHtml(content, filename, options);
        break;
      case "pdf":
        await this.exportPdf(content, filename, options);
        break;
      case "text":
        this.exportText(content, filename, options);
        break;
    }
  }

  /** Get supported export formats with descriptions. */
  getFormats(): Array<{ format: ExportFormat; label: string; description: string }> {
    return [
      { format: "html", label: "HTML", description: "Rich HTML with ANSI color rendering" },
      { format: "pdf", label: "PDF", description: "Printable PDF document" },
      { format: "text", label: "Plain Text", description: "Raw text without formatting" },
    ];
  }

  private exportHtml(content: string, filename: string, options: ExportOptions): void {
    const ansiToHtml = this.convertAnsiToHtml(content);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terminal Export${options.includeTimestamp ? ` — ${new Date().toLocaleString()}` : ""}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0d1117;
      color: #c9d1d9;
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace;
      font-size: 14px;
      line-height: 1.5;
      padding: 20px;
    }
    .header {
      padding: 12px 16px;
      margin-bottom: 16px;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      font-size: 12px;
      color: #8b949e;
    }
    .header h1 {
      font-size: 16px;
      color: #e6edf3;
      margin-bottom: 8px;
    }
    .terminal-content {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 16px;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-x: auto;
    }
    .bold { font-weight: bold; }
    .dim { opacity: 0.7; }
    .italic { font-style: italic; }
    .underline { text-decoration: underline; }
    .fg-black { color: #484f58; }
    .fg-red { color: #ff7b72; }
    .fg-green { color: #3fb950; }
    .fg-yellow { color: #d29922; }
    .fg-blue { color: #58a6ff; }
    .fg-magenta { color: #bc8cff; }
    .fg-cyan { color: #39d353; }
    .fg-white { color: #b1bac4; }
    .fg-bright-black { color: #6e7681; }
    .fg-bright-red { color: #ffa198; }
    .fg-bright-green { color: #56d364; }
    .fg-bright-yellow { color: #e3b341; }
    .fg-bright-blue { color: #79c0ff; }
    .fg-bright-magenta { color: #d2a8ff; }
    .fg-bright-cyan { color: #56d364; }
    .fg-bright-white { color: #f0f6fc; }
    @media print {
      body { background: white; color: black; }
      .terminal-content { background: #f6f8fa; border-color: #d0d7de; }
    }
  </style>
</head>
<body>
  ${options.includeMetadata ? `
  <div class="header">
    <h1>AI Terminal Export</h1>
    ${options.includeTimestamp ? `<div>Exported: ${new Date().toLocaleString()}</div>` : ""}
    <div>Lines: ${content.split("\n").length}</div>
  </div>` : ""}
  <div class="terminal-content">${ansiToHtml}</div>
</body>
</html>`;

    this.downloadFile(html, `${filename}.html`, "text/html");
  }

  private async exportPdf(content: string, filename: string, options: ExportOptions): Promise<void> {
    // Create the HTML content in a hidden iframe, then print to PDF
    const ansiToHtml = this.convertAnsiToHtml(content);

    const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    @page { margin: 20mm; size: A4; }
    body {
      font-family: 'SF Mono', 'Courier New', Courier, monospace;
      font-size: 10px;
      line-height: 1.4;
      color: #24292f;
    }
    .header {
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #d0d7de;
      font-size: 9px;
      color: #656d76;
    }
    .header h1 { font-size: 14px; color: #1f2328; margin-bottom: 4px; }
    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 0;
    }
    .bold { font-weight: bold; }
    .fg-red { color: #cf222e; }
    .fg-green { color: #116329; }
    .fg-yellow { color: #4d2d00; }
    .fg-blue { color: #0969da; }
    .fg-magenta { color: #8250df; }
    .fg-cyan { color: #1b7c83; }
  </style>
</head>
<body>
  ${options.includeMetadata ? `
  <div class="header">
    <h1>AI Terminal Export</h1>
    ${options.includeTimestamp ? `<div>Exported: ${new Date().toLocaleString()}</div>` : ""}
    <div>Lines: ${content.split("\n").length}</div>
  </div>` : ""}
  <pre>${ansiToHtml}</pre>
</body>
</html>`;

    // Open print dialog for PDF saving
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } else {
      // Fallback: download as HTML
      this.downloadFile(html, `${filename}.html`, "text/html");
    }
  }

  private exportText(content: string, filename: string, options: ExportOptions): void {
    // Strip ANSI codes
    const stripped = this.stripAnsi(content);

    let text = "";
    if (options.includeMetadata) {
      text += "AI Terminal Export\n";
      if (options.includeTimestamp) {
        text += `Exported: ${new Date().toLocaleString()}\n`;
      }
      text += `Lines: ${stripped.split("\n").length}\n`;
      text += "─".repeat(60) + "\n\n";
    }
    text += stripped;

    this.downloadFile(text, `${filename}.txt`, "text/plain");
  }

  /** Convert ANSI escape codes to HTML spans. */
  private convertAnsiToHtml(text: string): string {
    // Escape HTML entities
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // ANSI color code map
    const colorMap: Record<string, string> = {
      "30": "fg-black", "31": "fg-red", "32": "fg-green", "33": "fg-yellow",
      "34": "fg-blue", "35": "fg-magenta", "36": "fg-cyan", "37": "fg-white",
      "90": "fg-bright-black", "91": "fg-bright-red", "92": "fg-bright-green",
      "93": "fg-bright-yellow", "94": "fg-bright-blue", "95": "fg-bright-magenta",
      "96": "fg-bright-cyan", "97": "fg-bright-white",
    };

    // Replace ANSI codes with spans
    // eslint-disable-next-line no-control-regex
    html = html.replace(/\x1b\[(\d+(?:;\d+)*)m/g, (_, codes: string) => {
      const codeList = codes.split(";");
      const classes: string[] = [];

      for (const code of codeList) {
        if (code === "0") return "</span>";
        if (code === "1") classes.push("bold");
        if (code === "2") classes.push("dim");
        if (code === "3") classes.push("italic");
        if (code === "4") classes.push("underline");
        if (colorMap[code]) classes.push(colorMap[code]);
      }

      return classes.length > 0 ? `<span class="${classes.join(" ")}">` : "";
    });

    // Remove remaining ANSI codes
    // eslint-disable-next-line no-control-regex
    html = html.replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, "");

    return html;
  }

  /** Strip all ANSI escape codes from text. */
  private stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, "");
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

/** Singleton instance */
let _exporter: TerminalExporter | null = null;

export function getTerminalExporter(): TerminalExporter {
  if (!_exporter) {
    _exporter = new TerminalExporter();
  }
  return _exporter;
}
