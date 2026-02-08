/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Mock for @tauri-apps/api/core — provides the invoke function
 */

const commandResults: Map<string, any> = new Map();

export const invoke = vi.fn(async (cmd: string, args?: any) => {
  if (commandResults.has(cmd)) {
    const result = commandResults.get(cmd);
    if (typeof result === "function") return result(args);
    return result;
  }

  switch (cmd) {
    case "write_to_pty":
      return undefined;
    case "list_directory":
      return mockListDirectory(args?.path);
    default:
      return undefined;
  }
});

function mockListDirectory(path?: string): { entries: Array<{ name: string; path: string; isDir: boolean }>; path: string } {
  const resolvedPath = path === "." || !path ? "/Users/test" : path;
  // Provide mock filesystem entries
  const mockFs: Record<string, Array<{ name: string; isDir: boolean }>> = {
    "/Users/test": [
      { name: "Desktop", isDir: true },
      { name: "Documents", isDir: true },
      { name: "Downloads", isDir: true },
      { name: ".config", isDir: true },
      { name: "file.txt", isDir: false },
      { name: "notes.md", isDir: false },
    ],
    "/Users/test/Documents": [
      { name: "projects", isDir: true },
      { name: "reports", isDir: true },
      { name: "readme.md", isDir: false },
    ],
    "": [
      { name: "Desktop", isDir: true },
      { name: "Documents", isDir: true },
      { name: "Downloads", isDir: true },
      { name: ".config", isDir: true },
      { name: "file.txt", isDir: false },
      { name: "notes.md", isDir: false },
    ],
  };

  const entries = (mockFs[resolvedPath] || []).map((e) => ({
    name: e.name,
    path: `${resolvedPath}/${e.name}`,
    isDir: e.isDir,
  }));

  return { entries, path: resolvedPath };
}

export function __setCommandResult(cmd: string, result: any): void {
  commandResults.set(cmd, result);
}
