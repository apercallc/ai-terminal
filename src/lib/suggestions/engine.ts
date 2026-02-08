import type { CommandSuggestion, DirectoryEntry } from "@/types";

/**
 * Command suggestion engine that provides autocomplete based on
 * command history frequency, built-in commands, and fuzzy matching.
 */

const BUILTIN_COMMANDS: CommandSuggestion[] = [
  { id: "ls", command: "ls", description: "List directory contents", category: "filesystem", frequency: 0 },
  { id: "cd", command: "cd", description: "Change directory", category: "filesystem", frequency: 0 },
  { id: "pwd", command: "pwd", description: "Print working directory", category: "filesystem", frequency: 0 },
  { id: "mkdir", command: "mkdir", description: "Create a directory", category: "filesystem", frequency: 0 },
  { id: "rm", command: "rm", description: "Remove files or directories", category: "filesystem", frequency: 0 },
  { id: "cp", command: "cp", description: "Copy files or directories", category: "filesystem", frequency: 0 },
  { id: "mv", command: "mv", description: "Move or rename files", category: "filesystem", frequency: 0 },
  { id: "cat", command: "cat", description: "Concatenate and display file contents", category: "filesystem", frequency: 0 },
  { id: "grep", command: "grep", description: "Search text patterns in files", category: "search", frequency: 0 },
  { id: "find", command: "find", description: "Search for files in a directory hierarchy", category: "search", frequency: 0 },
  { id: "echo", command: "echo", description: "Display a line of text", category: "utility", frequency: 0 },
  { id: "chmod", command: "chmod", description: "Change file permissions", category: "permissions", frequency: 0 },
  { id: "chown", command: "chown", description: "Change file owner and group", category: "permissions", frequency: 0 },
  { id: "curl", command: "curl", description: "Transfer data from or to a server", category: "network", frequency: 0 },
  { id: "wget", command: "wget", description: "Download files from the web", category: "network", frequency: 0 },
  { id: "ssh", command: "ssh", description: "OpenSSH remote login client", category: "network", frequency: 0 },
  { id: "git-status", command: "git status", description: "Show working tree status", category: "git", frequency: 0 },
  { id: "git-add", command: "git add .", description: "Add all changes to staging", category: "git", frequency: 0 },
  { id: "git-commit", command: "git commit -m", description: "Record changes to the repository", category: "git", frequency: 0 },
  { id: "git-push", command: "git push", description: "Push changes to remote", category: "git", frequency: 0 },
  { id: "git-pull", command: "git pull", description: "Fetch and merge remote changes", category: "git", frequency: 0 },
  { id: "git-log", command: "git log --oneline -10", description: "Show recent commit history", category: "git", frequency: 0 },
  { id: "git-branch", command: "git branch", description: "List or create branches", category: "git", frequency: 0 },
  { id: "git-checkout", command: "git checkout", description: "Switch branches or restore files", category: "git", frequency: 0 },
  { id: "npm-install", command: "npm install", description: "Install npm packages", category: "node", frequency: 0 },
  { id: "npm-start", command: "npm start", description: "Start npm project", category: "node", frequency: 0 },
  { id: "npm-test", command: "npm test", description: "Run project tests", category: "node", frequency: 0 },
  { id: "npm-run-build", command: "npm run build", description: "Build the project", category: "node", frequency: 0 },
  { id: "yarn-install", command: "yarn install", description: "Install yarn packages", category: "node", frequency: 0 },
  { id: "brew-install", command: "brew install", description: "Install a Homebrew formula", category: "brew", frequency: 0 },
  { id: "brew-update", command: "brew update", description: "Update Homebrew", category: "brew", frequency: 0 },
  { id: "brew-upgrade", command: "brew upgrade", description: "Upgrade installed formulae", category: "brew", frequency: 0 },
  { id: "pip-install", command: "pip install", description: "Install Python packages", category: "python", frequency: 0 },
  { id: "python3", command: "python3", description: "Run Python 3 interpreter", category: "python", frequency: 0 },
  { id: "docker-ps", command: "docker ps", description: "List running containers", category: "docker", frequency: 0 },
  { id: "docker-build", command: "docker build -t", description: "Build a Docker image", category: "docker", frequency: 0 },
  { id: "docker-run", command: "docker run", description: "Create and start a container", category: "docker", frequency: 0 },
  { id: "docker-compose-up", command: "docker compose up -d", description: "Start services in background", category: "docker", frequency: 0 },
  { id: "ps-aux", command: "ps aux", description: "List all running processes", category: "system", frequency: 0 },
  { id: "top", command: "top", description: "Display system resource usage", category: "system", frequency: 0 },
  { id: "df-h", command: "df -h", description: "Show disk space usage", category: "system", frequency: 0 },
  { id: "du-sh", command: "du -sh *", description: "Show directory sizes", category: "system", frequency: 0 },
  { id: "kill", command: "kill", description: "Send signal to a process", category: "system", frequency: 0 },
  { id: "tail-f", command: "tail -f", description: "Follow file contents in real-time", category: "utility", frequency: 0 },
  { id: "head", command: "head", description: "Display first lines of a file", category: "utility", frequency: 0 },
  { id: "wc", command: "wc -l", description: "Count lines in a file", category: "utility", frequency: 0 },
  { id: "sort", command: "sort", description: "Sort lines of text", category: "utility", frequency: 0 },
  { id: "uniq", command: "uniq", description: "Report or omit repeated lines", category: "utility", frequency: 0 },
  { id: "tar-create", command: "tar -czf", description: "Create a compressed archive", category: "utility", frequency: 0 },
  { id: "tar-extract", command: "tar -xzf", description: "Extract a compressed archive", category: "utility", frequency: 0 },
];

const HISTORY_STORAGE_KEY = "ai_terminal_cmd_history";
const MAX_HISTORY = 200;

export class SuggestionEngine {
  private history: CommandSuggestion[] = [];

  constructor() {
    this.loadHistory();
  }

  /** Record a command execution to improve future suggestions. */
  recordCommand(command: string): void {
    const trimmed = command.trim();
    if (!trimmed || trimmed.length < 2) return;

    const existing = this.history.find((h) => h.command === trimmed);
    if (existing) {
      existing.frequency++;
    } else {
      this.history.push({
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        command: trimmed,
        description: "Previously used command",
        category: "history",
        frequency: 1,
      });
    }

    // Trim oldest low-frequency entries
    if (this.history.length > MAX_HISTORY) {
      this.history.sort((a, b) => b.frequency - a.frequency);
      this.history = this.history.slice(0, MAX_HISTORY);
    }

    this.saveHistory();
  }

  /** Get suggestions for a partial input string. */
  getSuggestions(input: string, maxResults = 8): CommandSuggestion[] {
    const query = input.trim().toLowerCase();
    if (!query) return [];

    const allCommands = [...this.history, ...BUILTIN_COMMANDS];
    const seen = new Set<string>();
    const results: Array<{ suggestion: CommandSuggestion; score: number }> = [];

    for (const suggestion of allCommands) {
      if (seen.has(suggestion.command)) continue;
      seen.add(suggestion.command);

      const score = this.calculateScore(query, suggestion);
      if (score > 0) {
        results.push({ suggestion, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxResults).map((r) => r.suggestion);
  }

  /** Get all categories of built-in commands. */
  getCategories(): string[] {
    const cats = new Set<string>();
    for (const cmd of BUILTIN_COMMANDS) {
      cats.add(cmd.category);
    }
    return Array.from(cats).sort();
  }

  /** Get commands by category. */
  getByCategory(category: string): CommandSuggestion[] {
    return BUILTIN_COMMANDS.filter((c) => c.category === category);
  }

  private calculateScore(query: string, suggestion: CommandSuggestion): number {
    const cmd = suggestion.command.toLowerCase();
    const desc = suggestion.description.toLowerCase();

    // Exact prefix match is highest priority
    if (cmd.startsWith(query)) {
      return 100 + suggestion.frequency * 10;
    }

    // Word boundary match
    const words = cmd.split(/[\s-_]/);
    if (words.some((w) => w.startsWith(query))) {
      return 80 + suggestion.frequency * 10;
    }

    // Contains match
    if (cmd.includes(query)) {
      return 60 + suggestion.frequency * 10;
    }

    // Description match
    if (desc.includes(query)) {
      return 40 + suggestion.frequency * 5;
    }

    // Fuzzy match — all query chars appear in order
    if (this.fuzzyMatch(query, cmd)) {
      return 20 + suggestion.frequency * 5;
    }

    return 0;
  }

  private fuzzyMatch(query: string, target: string): boolean {
    let qi = 0;
    for (let ti = 0; ti < target.length && qi < query.length; ti++) {
      if (query[qi] === target[ti]) qi++;
    }
    return qi === query.length;
  }

  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch {
      this.history = [];
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.history));
    } catch {
      // Storage full or unavailable
    }
  }

  /**
   * Commands that accept filesystem paths as arguments.
   * When the user types one of these followed by a space, switch to path completion.
   */
  static PATH_COMMANDS = new Set([
    "cd", "ls", "cat", "less", "more", "head", "tail", "vim", "vi", "nano",
    "code", "open", "mkdir", "rmdir", "rm", "cp", "mv", "touch", "chmod",
    "chown", "stat", "file", "source", ".",
  ]);

  /**
   * Check if the current input should trigger path-based completions.
   * Returns the base command and the partial path typed so far, or null.
   */
  parsePathInput(input: string): { baseCommand: string; partialPath: string; dirToList: string; prefix: string } | null {
    // Don't trim — we need to detect trailing space (e.g. "cd ")
    const spaceIdx = input.indexOf(" ");
    if (spaceIdx === -1) return null;

    const baseCommand = input.slice(0, spaceIdx).trim();
    if (!baseCommand || !SuggestionEngine.PATH_COMMANDS.has(baseCommand)) return null;

    const pathPart = input.slice(spaceIdx + 1);
    // Figure out the directory to list and the prefix to filter by
    const lastSlash = pathPart.lastIndexOf("/");
    if (lastSlash === -1) {
      // No slash — list cwd, filter by entire pathPart
      return { baseCommand, partialPath: pathPart, dirToList: ".", prefix: pathPart };
    }

    const dirPart = pathPart.slice(0, lastSlash + 1); // includes trailing /
    const filterPart = pathPart.slice(lastSlash + 1);
    return { baseCommand, partialPath: pathPart, dirToList: dirPart || "/", prefix: filterPart };
  }

  /**
   * Generate path-based suggestions from directory listing results.
   * Should be called with the result of the Tauri `list_directory` command.
   */
  buildPathSuggestions(
    entries: DirectoryEntry[],
    baseCommand: string,
    dirToList: string,
    prefix: string,
    showHidden: boolean,
    maxResults = 12,
  ): CommandSuggestion[] {
    const lowerPrefix = prefix.toLowerCase();
    const filtered = entries.filter((entry) => {
      // Filter hidden files unless prefix starts with dot
      if (!showHidden && entry.name.startsWith(".") && !prefix.startsWith(".")) {
        return false;
      }
      // For cd, only show directories
      if (baseCommand === "cd" && !entry.isDir) {
        return false;
      }
      // Match prefix
      if (lowerPrefix && !entry.name.toLowerCase().startsWith(lowerPrefix)) {
        return false;
      }
      return true;
    });

    // Build the command path part
    const pathPrefix = dirToList === "." ? "" : dirToList;

    return filtered.slice(0, maxResults).map((entry) => {
      const entryPath = pathPrefix + entry.name + (entry.isDir ? "/" : "");
      return {
        id: `path-${entry.path}`,
        command: `${baseCommand} ${entryPath}`,
        description: entry.isDir ? "Directory" : this.getFileDescription(entry.name),
        category: entry.isDir ? "folder" : "file",
        frequency: 0,
        icon: entry.isDir ? "folder" as const : "file" as const,
      };
    });
  }

  private getFileDescription(name: string): string {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    const descriptions: Record<string, string> = {
      ts: "TypeScript file", tsx: "TypeScript React", js: "JavaScript file", jsx: "React component",
      py: "Python file", rs: "Rust file", go: "Go file", rb: "Ruby file",
      json: "JSON file", yaml: "YAML file", yml: "YAML file", toml: "TOML file",
      md: "Markdown file", txt: "Text file", csv: "CSV file",
      html: "HTML file", css: "CSS file", scss: "SCSS file",
      sh: "Shell script", zsh: "Zsh script", bash: "Bash script",
      png: "PNG image", jpg: "JPEG image", svg: "SVG image", gif: "GIF image",
      zip: "ZIP archive", tar: "TAR archive", gz: "Gzip archive",
      lock: "Lock file", log: "Log file",
    };
    return descriptions[ext] || "File";
  }
}

/** Singleton instance */
let _engine: SuggestionEngine | null = null;

export function getSuggestionEngine(): SuggestionEngine {
  if (!_engine) {
    _engine = new SuggestionEngine();
  }
  return _engine;
}
