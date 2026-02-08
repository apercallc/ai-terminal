import type { CustomTool } from "@/types";

const TOOLS_STORAGE_KEY = "ai_terminal_custom_tools";

/**
 * Built-in tools that come with the application.
 */
const BUILTIN_TOOLS: CustomTool[] = [
  {
    id: "tool-system-info",
    name: "System Info",
    description: "Display system information (OS, CPU, memory, disk)",
    command:
      "uname -a && sw_vers && sysctl -n machdep.cpu.brand_string && df -h / && echo 'Memory:' && sysctl -n hw.memsize | awk '{print $1/1024/1024/1024 \" GB\"}'",
    icon: "💻",
    category: "System",
    variables: [],
  },
  {
    id: "tool-network-check",
    name: "Network Check",
    description: "Check network connectivity and DNS resolution",
    command:
      "ping -c 3 {{host}} && echo '---' && nslookup {{host}} && echo '---' && curl -s -o /dev/null -w '%{http_code}' https://{{host}}",
    icon: "🌐",
    category: "Network",
    variables: [{ name: "host", label: "Host", type: "text", defaultValue: "google.com" }],
  },
  {
    id: "tool-port-check",
    name: "Port Scanner",
    description: "Check if a port is open on a host",
    command: "nc -zv {{host}} {{port}} 2>&1 || echo 'Port {{port}} is closed on {{host}}'",
    icon: "🔌",
    category: "Network",
    variables: [
      { name: "host", label: "Host", type: "text", defaultValue: "localhost" },
      { name: "port", label: "Port", type: "text", defaultValue: "8080" },
    ],
  },
  {
    id: "tool-find-large-files",
    name: "Find Large Files",
    description: "Find the largest files in a directory",
    command: "find {{directory}} -type f -exec du -h {} + 2>/dev/null | sort -rh | head -{{count}}",
    icon: "📦",
    category: "Filesystem",
    variables: [
      { name: "directory", label: "Directory", type: "text", defaultValue: "." },
      { name: "count", label: "Number of Files", type: "text", defaultValue: "20" },
    ],
  },
  {
    id: "tool-process-search",
    name: "Search Processes",
    description: "Find running processes by name",
    command: "ps aux | grep -i '{{pattern}}' | grep -v grep",
    icon: "🔍",
    category: "System",
    variables: [{ name: "pattern", label: "Process Name", type: "text", defaultValue: "node" }],
  },
  {
    id: "tool-git-summary",
    name: "Git Summary",
    description: "Get a summary of the current Git repository",
    command:
      "echo '=== Branch ===' && git branch --show-current && echo '=== Status ===' && git status -s && echo '=== Recent Commits ===' && git log --oneline -5 && echo '=== Remotes ===' && git remote -v",
    icon: "📊",
    category: "Git",
    variables: [],
  },
  {
    id: "tool-docker-cleanup",
    name: "Docker Cleanup",
    description: "Remove unused Docker resources",
    command: "docker system df && echo '---' && docker {{action}}",
    icon: "🐳",
    category: "Docker",
    variables: [
      {
        name: "action",
        label: "Cleanup Action",
        type: "select",
        defaultValue: "system prune -f",
        options: ["system prune -f", "image prune -f", "container prune -f", "volume prune -f"],
      },
    ],
  },
  {
    id: "tool-ssl-check",
    name: "SSL Certificate Check",
    description: "Check SSL certificate details for a domain",
    command:
      "echo | openssl s_client -servername {{domain}} -connect {{domain}}:443 2>/dev/null | openssl x509 -noout -dates -subject -issuer",
    icon: "🔒",
    category: "Security",
    variables: [{ name: "domain", label: "Domain", type: "text", defaultValue: "example.com" }],
  },
];

/**
 * Manages custom tool definitions — reusable command templates with variables.
 */
export class ToolManager {
  private customTools: CustomTool[] = [];

  constructor() {
    this.load();
  }

  /** Get all tools (built-in + custom). */
  getAll(): CustomTool[] {
    return [...BUILTIN_TOOLS, ...this.customTools];
  }

  /** Get a tool by ID. */
  getById(id: string): CustomTool | undefined {
    return this.getAll().find((t) => t.id === id);
  }

  /** Get tools by category. */
  getByCategory(category: string): CustomTool[] {
    return this.getAll().filter((t) => t.category === category);
  }

  /** Get all categories. */
  getCategories(): string[] {
    const cats = new Set<string>();
    for (const t of this.getAll()) {
      cats.add(t.category);
    }
    return Array.from(cats).sort();
  }

  /** Search tools by name or description. */
  search(query: string): CustomTool[] {
    const q = query.toLowerCase();
    return this.getAll().filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }

  /** Add a custom tool. */
  add(tool: Omit<CustomTool, "id">): CustomTool {
    const newTool: CustomTool = {
      ...tool,
      id: `tool-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    this.customTools.push(newTool);
    this.save();
    return newTool;
  }

  /** Remove a custom tool. */
  remove(id: string): boolean {
    const idx = this.customTools.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.customTools.splice(idx, 1);
    this.save();
    return true;
  }

  /** Update a custom tool. */
  update(id: string, updates: Partial<Omit<CustomTool, "id">>): boolean {
    const tool = this.customTools.find((t) => t.id === id);
    if (!tool) return false;
    Object.assign(tool, updates);
    this.save();
    return true;
  }

  /** Resolve a tool's command by substituting variables. */
  resolveCommand(tool: CustomTool, values: Record<string, string>): string {
    let resolved = tool.command;
    for (const v of tool.variables) {
      const val = values[v.name] || v.defaultValue;
      resolved = resolved.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, "g"), val);
    }
    return resolved;
  }

  /** Export custom tools as JSON. */
  export(): string {
    return JSON.stringify(this.customTools, null, 2);
  }

  /** Import custom tools from JSON. */
  import(json: string): number {
    try {
      const imported: CustomTool[] = JSON.parse(json);
      let count = 0;
      for (const tool of imported) {
        if (tool.name && tool.command) {
          this.customTools.push({
            ...tool,
            id: `tool-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          });
          count++;
        }
      }
      if (count > 0) this.save();
      return count;
    } catch {
      return 0;
    }
  }

  private load(): void {
    try {
      const stored = localStorage.getItem(TOOLS_STORAGE_KEY);
      if (stored) {
        this.customTools = JSON.parse(stored);
      }
    } catch {
      this.customTools = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(TOOLS_STORAGE_KEY, JSON.stringify(this.customTools));
    } catch {
      // Storage full or unavailable
    }
  }
}

/** Singleton instance */
let _manager: ToolManager | null = null;

export function getToolManager(): ToolManager {
  if (!_manager) {
    _manager = new ToolManager();
  }
  return _manager;
}
