import type { PluginManifest, PluginHookType, PluginContext } from "@/types";

const PLUGINS_STORAGE_KEY = "ai_terminal_plugins";

type PluginHandler = (ctx: PluginContext) => PluginContext | void | Promise<PluginContext | void>;

/**
 * Plugin system that allows extending the terminal with custom behavior.
 * Plugins register hooks that fire at various points in command lifecycle.
 */
export class PluginManager {
  private plugins: PluginManifest[] = [];
  private hooks: Map<PluginHookType, Map<string, PluginHandler>> = new Map();

  constructor() {
    this.load();
  }

  /** Get all registered plugins. */
  getAll(): PluginManifest[] {
    return [...this.plugins];
  }

  /** Get a plugin by ID. */
  getById(id: string): PluginManifest | undefined {
    return this.plugins.find((p) => p.id === id);
  }

  /** Register a plugin with its hooks. */
  register(manifest: PluginManifest, handlers: Record<string, PluginHandler>): void {
    // Remove any existing plugin with same ID
    this.unregister(manifest.id);

    this.plugins.push(manifest);

    for (const hook of manifest.hooks) {
      const handler = handlers[hook.handler];
      if (handler) {
        if (!this.hooks.has(hook.type)) {
          this.hooks.set(hook.type, new Map());
        }
        this.hooks.get(hook.type)!.set(`${manifest.id}:${hook.handler}`, handler);
      }
    }

    this.save();
  }

  /** Unregister a plugin. */
  unregister(id: string): void {
    const plugin = this.plugins.find((p) => p.id === id);
    if (!plugin) return;

    // Remove hooks
    for (const hook of plugin.hooks) {
      const hookMap = this.hooks.get(hook.type);
      if (hookMap) {
        hookMap.delete(`${id}:${hook.handler}`);
      }
    }

    this.plugins = this.plugins.filter((p) => p.id !== id);
    this.save();
  }

  /** Enable or disable a plugin. */
  setEnabled(id: string, enabled: boolean): void {
    const plugin = this.plugins.find((p) => p.id === id);
    if (plugin) {
      plugin.enabled = enabled;
      this.save();
    }
  }

  /** Fire all handlers for a given hook type. Returns the (possibly modified) context. */
  async fireHook(type: PluginHookType, context: PluginContext): Promise<PluginContext> {
    const hookMap = this.hooks.get(type);
    if (!hookMap) return context;

    let ctx = { ...context };

    for (const [key, handler] of hookMap) {
      const pluginId = key.split(":")[0];
      const plugin = this.plugins.find((p) => p.id === pluginId);
      if (!plugin?.enabled) continue;

      try {
        const result = await handler(ctx);
        if (result) {
          ctx = { ...ctx, ...result };
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Plugin ${pluginId} hook ${type} error:`, err);
      }
    }

    return ctx;
  }

  /** Create a built-in output logger plugin. */
  static createOutputLoggerPlugin(): {
    manifest: PluginManifest;
    handlers: Record<string, PluginHandler>;
  } {
    return {
      manifest: {
        id: "builtin-output-logger",
        name: "Output Logger",
        version: "1.0.0",
        description: "Logs all command output to the console for debugging",
        author: "AI Terminal",
        enabled: false,
        hooks: [{ type: "afterCommand", handler: "logOutput" }],
      },
      handlers: {
        logOutput: (ctx: PluginContext) => {
          if (ctx.command && ctx.output) {
            // eslint-disable-next-line no-console
            console.log(`[Plugin:OutputLogger] ${ctx.command} → exit ${ctx.exitCode}`);
            // eslint-disable-next-line no-console
            console.log(ctx.output.slice(0, 500));
          }
        },
      },
    };
  }

  /** Create a command stats plugin. */
  static createCommandStatsPlugin(): {
    manifest: PluginManifest;
    handlers: Record<string, PluginHandler>;
  } {
    const stats = { total: 0, success: 0, failed: 0 };

    return {
      manifest: {
        id: "builtin-command-stats",
        name: "Command Statistics",
        version: "1.0.0",
        description: "Tracks command execution statistics in the current session",
        author: "AI Terminal",
        enabled: true,
        hooks: [{ type: "afterCommand", handler: "trackStats" }],
      },
      handlers: {
        trackStats: (ctx: PluginContext) => {
          stats.total++;
          if (ctx.exitCode === 0) stats.success++;
          else stats.failed++;
          // eslint-disable-next-line no-console
          console.debug(
            `[Plugin:Stats] Total: ${stats.total}, Success: ${stats.success}, Failed: ${stats.failed}`,
          );
        },
      },
    };
  }

  /** Create a command timer plugin. */
  static createTimerPlugin(): {
    manifest: PluginManifest;
    handlers: Record<string, PluginHandler>;
  } {
    let startTime = 0;

    return {
      manifest: {
        id: "builtin-timer",
        name: "Command Timer",
        version: "1.0.0",
        description: "Measures and displays command execution time",
        author: "AI Terminal",
        enabled: false,
        hooks: [
          { type: "beforeCommand", handler: "startTimer" },
          { type: "afterCommand", handler: "endTimer" },
        ],
      },
      handlers: {
        startTimer: () => {
          startTime = Date.now();
        },
        endTimer: (ctx: PluginContext) => {
          const duration = Date.now() - startTime;
          // eslint-disable-next-line no-console
          console.log(`[Plugin:Timer] ${ctx.command} took ${duration}ms`);
        },
      },
    };
  }

  private load(): void {
    try {
      const stored = localStorage.getItem(PLUGINS_STORAGE_KEY);
      if (stored) {
        this.plugins = JSON.parse(stored);
      }
    } catch {
      this.plugins = [];
    }
  }

  private save(): void {
    try {
      // Only save manifests, not handler functions
      const toStore = this.plugins.map((p) => ({
        ...p,
        hooks: p.hooks.map((h) => ({ type: h.type, handler: h.handler })),
      }));
      localStorage.setItem(PLUGINS_STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // Storage full or unavailable
    }
  }
}

/** Singleton instance */
let _manager: PluginManager | null = null;

export function getPluginManager(): PluginManager {
  if (!_manager) {
    _manager = new PluginManager();

    // Register built-in plugins
    const outputLogger = PluginManager.createOutputLoggerPlugin();
    _manager.register(outputLogger.manifest, outputLogger.handlers);

    const stats = PluginManager.createCommandStatsPlugin();
    _manager.register(stats.manifest, stats.handlers);

    const timer = PluginManager.createTimerPlugin();
    _manager.register(timer.manifest, timer.handlers);
  }
  return _manager;
}
