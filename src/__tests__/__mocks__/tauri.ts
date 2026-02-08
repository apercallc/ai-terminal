/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Mock for @tauri-apps/api — used by vitest via alias in vitest.config.ts
 */

const listeners: Map<string, Set<(event: any) => void>> = new Map();

export const event = {
  listen: vi.fn(async (eventName: string, handler: (event: any) => void) => {
    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName)!.add(handler);
    return () => {
      listeners.get(eventName)?.delete(handler);
    };
  }),
  emit: vi.fn(async (eventName: string, payload?: any) => {
    const handlers = listeners.get(eventName);
    if (handlers) {
      for (const h of handlers) {
        h({ event: eventName, payload });
      }
    }
  }),
  once: vi.fn(async (eventName: string, handler: (event: any) => void) => {
    const wrappedHandler = (event: any) => {
      handler(event);
      listeners.get(eventName)?.delete(wrappedHandler);
    };
    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName)!.add(wrappedHandler);
    return () => {
      listeners.get(eventName)?.delete(wrappedHandler);
    };
  }),
  TauriEvent: {
    WINDOW_RESIZED: "tauri://resize",
    WINDOW_MOVED: "tauri://move",
    WINDOW_CLOSE_REQUESTED: "tauri://close-requested",
    WINDOW_CREATED: "tauri://window-created",
    WINDOW_DESTROYED: "tauri://destroyed",
  },
  __emitMockEvent: (eventName: string, payload: any) => {
    const handlers = listeners.get(eventName);
    if (handlers) {
      for (const h of handlers) {
        h({ event: eventName, payload });
      }
    }
  },
  __clearListeners: () => {
    listeners.clear();
  },
};

const commandResults: Map<string, any> = new Map();

export const core = {
  invoke: vi.fn(async (cmd: string, args?: any) => {
    if (commandResults.has(cmd)) {
      const result = commandResults.get(cmd);
      if (typeof result === "function") return result(args);
      return result;
    }

    // Default responses for known commands
    switch (cmd) {
      case "spawn_shell":
        return "mock-pty-id";
      case "write_to_pty":
        return undefined;
      case "resize_pty":
        return undefined;
      case "kill_pty":
        return undefined;
      case "get_cwd":
        return "/Users/test/projects";
      case "get_system_info":
        return {
          os: "macOS",
          arch: "aarch64",
          shell: "/bin/zsh",
          home: "/Users/test",
          hostname: "test-mac",
        };
      case "store_api_key":
        return undefined;
      case "get_api_key":
        return "sk-test-mock-key";
      case "delete_api_key":
        return undefined;
      case "write_log":
        return undefined;
      case "get_log_entries":
        return [];
      case "get_log_dates":
        return [];
      default:
        return undefined;
    }
  }),
  __setCommandResult: (cmd: string, result: any) => {
    commandResults.set(cmd, result);
  },
  __clearCommandResults: () => {
    commandResults.clear();
  },
};

export const window = {
  getCurrentWindow: vi.fn(() => ({
    setTitle: vi.fn(async () => {}),
    setSize: vi.fn(async () => {}),
    setPosition: vi.fn(async () => {}),
    center: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    show: vi.fn(async () => {}),
    hide: vi.fn(async () => {}),
    maximize: vi.fn(async () => {}),
    minimize: vi.fn(async () => {}),
    unmaximize: vi.fn(async () => {}),
    isMaximized: vi.fn(async () => false),
    isMinimized: vi.fn(async () => false),
    isVisible: vi.fn(async () => true),
    setFullscreen: vi.fn(async () => {}),
    isFullscreen: vi.fn(async () => false),
  })),
  Window: vi.fn(),
};

export const path = {
  appDataDir: vi.fn(async () => "/Users/test/Library/Application Support/com.aiterminal.app"),
  appConfigDir: vi.fn(async () => "/Users/test/Library/Application Support/com.aiterminal.app"),
  homeDir: vi.fn(async () => "/Users/test"),
  desktopDir: vi.fn(async () => "/Users/test/Desktop"),
  sep: "/",
};

export default {
  event,
  core,
  window,
  path,
};
