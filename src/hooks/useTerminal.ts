import { useEffect, useRef, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { getRecordingManager } from "@/lib/recording/manager";
import type { Theme } from "@/types";

const DARK_THEME = {
  background: "#0d1117",
  foreground: "#c9d1d9",
  cursor: "#58a6ff",
  cursorAccent: "#0d1117",
  selectionBackground: "#264f78",
  selectionForeground: "#ffffff",
  black: "#484f58",
  red: "#ff7b72",
  green: "#3fb950",
  yellow: "#d29922",
  blue: "#58a6ff",
  magenta: "#bc8cff",
  cyan: "#39d353",
  white: "#b1bac4",
  brightBlack: "#6e7681",
  brightRed: "#ffa198",
  brightGreen: "#56d364",
  brightYellow: "#e3b341",
  brightBlue: "#79c0ff",
  brightMagenta: "#d2a8ff",
  brightCyan: "#56d364",
  brightWhite: "#f0f6fc",
};

const LIGHT_THEME = {
  background: "#ffffff",
  foreground: "#24292f",
  cursor: "#0969da",
  cursorAccent: "#ffffff",
  selectionBackground: "#0969da33",
  selectionForeground: "#24292f",
  black: "#24292f",
  red: "#cf222e",
  green: "#116329",
  yellow: "#4d2d00",
  blue: "#0969da",
  magenta: "#8250df",
  cyan: "#1b7c83",
  white: "#6e7781",
  brightBlack: "#57606a",
  brightRed: "#a40e26",
  brightGreen: "#1a7f37",
  brightYellow: "#633c01",
  brightBlue: "#218bff",
  brightMagenta: "#a475f9",
  brightCyan: "#3192aa",
  brightWhite: "#8c959f",
};

interface UseTerminalOptions {
  theme: Theme;
  scrollbackLimit: number;
}

interface UseTerminalReturn {
  /** Ref to attach to the terminal container div */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** The active PTY session ID */
  sessionId: string | null;
  /** Whether the terminal is connected */
  isConnected: boolean;
  /** Write data directly to the terminal display */
  writeToDisplay: (data: string) => void;
  /** Send user input to the PTY */
  sendInput: (data: string) => void;
  /** Clear the terminal screen */
  clearTerminal: () => void;
  /** Search the terminal content */
  search: (query: string) => boolean;
  /** Clear the search highlight */
  clearSearch: () => void;
  /** Focus the terminal */
  focus: () => void;
  /** Get the full terminal buffer content as text */
  getBufferContent: () => string;
}

export function useTerminal(options: UseTerminalOptions): UseTerminalReturn {
  const containerRef = useRef<HTMLDivElement>(null!);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const themeConfig = options.theme === "dark" ? DARK_THEME : LIGHT_THEME;

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 14,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      lineHeight: 1.2,
      scrollback: options.scrollbackLimit,
      theme: themeConfig,
      allowProposedApi: true,
      macOptionIsMeta: true,
      macOptionClickForcesSelection: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    // Spawn PTY
    const initPty = async () => {
      try {
        const cols = terminal.cols;
        const rows = terminal.rows;

        const sid = await invoke<string>("spawn_shell", { rows, cols });
        sessionIdRef.current = sid;
        setSessionId(sid);
        setIsConnected(true);

        // Forward terminal input to PTY (and record if active)
        terminal.onData((data) => {
          invoke("write_to_pty", { sessionId: sid, data }).catch(() => {
            // PTY write failed — session may have died
          });
          // Record input for terminal recording
          const rm = getRecordingManager();
          if (rm.isRecording()) {
            rm.recordInput(data);
          }
        });

        // Send resize events to PTY (and record if active)
        terminal.onResize(({ rows, cols }) => {
          invoke("resize_pty", { sessionId: sid, rows, cols }).catch(() => {
            // Non-fatal
          });
          const rm = getRecordingManager();
          if (rm.isRecording()) {
            rm.recordResize(cols, rows);
          }
        });
      } catch (err) {
        terminal.writeln(`\r\n\x1b[31mFailed to start shell: ${err}\x1b[0m\r\n`);
      }
    };

    initPty();

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;

      // Kill PTY session
      if (sessionIdRef.current) {
        invoke("kill_pty", { sessionId: sessionIdRef.current }).catch(() => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for PTY output
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      unlisten = await listen<{ session_id: string; data: string }>(
        "pty-output",
        (event) => {
          if (event.payload.session_id === sessionIdRef.current) {
            terminalRef.current?.write(event.payload.data);
            // Record output for terminal recording
            const rm = getRecordingManager();
            if (rm.isRecording()) {
              rm.recordOutput(event.payload.data);
            }
          }
        },
      );
    };

    setup();

    return () => {
      unlisten?.();
    };
  }, []);

  // Listen for PTY exit
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      unlisten = await listen<string>("pty-exit", (event) => {
        if (event.payload === sessionIdRef.current) {
          setIsConnected(false);
          terminalRef.current?.writeln(
            "\r\n\x1b[33m[Shell session ended]\x1b[0m\r\n",
          );
        }
      });
    };

    setup();

    return () => {
      unlisten?.();
    };
  }, []);

  // Update theme
  useEffect(() => {
    if (!terminalRef.current) return;
    terminalRef.current.options.theme =
      options.theme === "dark" ? DARK_THEME : LIGHT_THEME;
  }, [options.theme]);

  const writeToDisplay = useCallback((data: string) => {
    terminalRef.current?.write(data);
  }, []);

  const sendInput = useCallback((data: string) => {
    if (sessionIdRef.current) {
      invoke("write_to_pty", { sessionId: sessionIdRef.current, data }).catch(
        () => {},
      );
    }
  }, []);

  const clearTerminal = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  const search = useCallback((query: string): boolean => {
    return searchAddonRef.current?.findNext(query) ?? false;
  }, []);

  const clearSearch = useCallback(() => {
    searchAddonRef.current?.clearDecorations();
  }, []);

  const focus = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  const getBufferContent = useCallback((): string => {
    const terminal = terminalRef.current;
    if (!terminal) return "";

    const buffer = terminal.buffer.active;
    const lines: string[] = [];

    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }

    // Trim trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }

    return lines.join("\n");
  }, []);

  return {
    containerRef,
    sessionId,
    isConnected,
    writeToDisplay,
    sendInput,
    clearTerminal,
    search,
    clearSearch,
    focus,
    getBufferContent,
  };
}
