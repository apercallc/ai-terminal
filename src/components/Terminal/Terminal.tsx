import React, { useEffect, memo } from "react";
import type { Theme } from "@/types";
import { useTerminal } from "@/hooks/useTerminal";
import "./Terminal.css";

interface TerminalProps {
  theme: Theme;
  scrollbackLimit: number;
  onSessionReady: (sessionId: string) => void;
  onConnectionChange: (connected: boolean) => void;
  onBufferReady?: (getContent: () => string) => void;
  onCwdChange?: (cwd: string) => void;
}

export const TerminalView = memo(function TerminalView({
  theme,
  scrollbackLimit,
  onSessionReady,
  onConnectionChange,
  onBufferReady,
  onCwdChange: _onCwdChange,
}: TerminalProps) {
  const { containerRef, sessionId, isConnected, focus, getBufferContent } = useTerminal({
    theme,
    scrollbackLimit,
  });

  useEffect(() => {
    if (sessionId) {
      onSessionReady(sessionId);
    }
  }, [sessionId, onSessionReady]);

  useEffect(() => {
    onConnectionChange(isConnected);
  }, [isConnected, onConnectionChange]);

  useEffect(() => {
    if (onBufferReady) {
      onBufferReady(getBufferContent);
    }
  }, [onBufferReady, getBufferContent]);

  return (
    <div
      className="terminal-container"
      onClick={() => focus()}
      role="textbox"
      tabIndex={0}
      aria-label="Terminal"
    >
      <div ref={containerRef as React.RefObject<HTMLDivElement>} className="terminal-viewport" />
      {!isConnected && sessionId && (
        <div className="terminal-disconnected">
          <span>Shell session ended</span>
        </div>
      )}
    </div>
  );
});
