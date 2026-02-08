import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBar } from "@/components/StatusBar/StatusBar";

describe("StatusBar", () => {
  const defaultProps = {
    agentState: "idle" as const,
    currentStep: 0,
    totalSteps: 0,
    mode: "safe" as const,
    providerType: "openai" as const,
    connectionStatus: "connected" as const,
    isConnected: true,
    onSettingsClick: vi.fn(),
    onHistoryClick: vi.fn(),
    onBookmarksClick: vi.fn(),
    onTemplatesClick: vi.fn(),
    onToolsClick: vi.fn(),
    onRecordingClick: vi.fn(),
    onCollabClick: vi.fn(),
    onSSHClick: vi.fn(),
    onExportClick: vi.fn(),
    onShortcutsClick: vi.fn(),
    onPluginsClick: vi.fn(),
    onMetricsClick: vi.fn(),
    onPaletteClick: vi.fn(),
  };

  it("renders agent state", () => {
    render(<StatusBar {...defaultProps} />);
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("renders provider name", () => {
    render(<StatusBar {...defaultProps} />);
    expect(screen.getByText(/OpenAI/)).toBeInTheDocument();
  });

  it("renders safe mode indicator", () => {
    render(<StatusBar {...defaultProps} />);
    expect(screen.getByText(/Safe/)).toBeInTheDocument();
  });

  it("renders auto mode indicator", () => {
    render(<StatusBar {...defaultProps} mode="auto" />);
    expect(screen.getByText(/Auto/)).toBeInTheDocument();
  });

  it("shows step progress when executing", () => {
    render(<StatusBar {...defaultProps} agentState="executing" currentStep={1} totalSteps={3} />);
    expect(screen.getByText(/Step 2\/3/)).toBeInTheDocument();
  });

  it("shows connection status", () => {
    render(<StatusBar {...defaultProps} connectionStatus="connected" isConnected={true} />);
    const statusBar = screen.getByText(/OpenAI/).closest(".status-bar");
    expect(statusBar).toBeInTheDocument();
  });
});
