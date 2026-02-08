import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GlobalPalette } from "@/components/GlobalPalette/GlobalPalette";
import type { PaletteAction } from "@/components/GlobalPalette/GlobalPalette";

describe("GlobalPalette", () => {
  const mockActions: PaletteAction[] = [
    { id: "settings", label: "Open Settings", icon: "⚙", shortcut: "⌘,", action: vi.fn() },
    { id: "history", label: "View History", icon: "📋", shortcut: "⌘H", action: vi.fn() },
    { id: "metrics", label: "Metrics Dashboard", icon: "📊", action: vi.fn() },
    { id: "new-tab", label: "New Terminal Tab", icon: "+", action: vi.fn() },
  ];

  const defaultProps = {
    onClose: vi.fn(),
    actions: mockActions,
  };

  it("renders the search input", () => {
    render(<GlobalPalette {...defaultProps} />);
    expect(screen.getByPlaceholderText("Type a command...")).toBeInTheDocument();
  });

  it("shows all actions by default", () => {
    render(<GlobalPalette {...defaultProps} />);
    expect(screen.getByText("Open Settings")).toBeInTheDocument();
    expect(screen.getByText("View History")).toBeInTheDocument();
    expect(screen.getByText("Metrics Dashboard")).toBeInTheDocument();
    expect(screen.getByText("New Terminal Tab")).toBeInTheDocument();
  });

  it("filters actions by search query", () => {
    render(<GlobalPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText("Type a command...");
    fireEvent.change(input, { target: { value: "settings" } });
    expect(screen.getByText("Open Settings")).toBeInTheDocument();
    expect(screen.queryByText("View History")).not.toBeInTheDocument();
  });

  it("shows empty state when no actions match", () => {
    render(<GlobalPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText("Type a command...");
    fireEvent.change(input, { target: { value: "zzzznothing" } });
    expect(screen.getByText("No matching commands")).toBeInTheDocument();
  });

  it("shows keyboard shortcuts when defined", () => {
    render(<GlobalPalette {...defaultProps} />);
    expect(screen.getByText("⌘,")).toBeInTheDocument();
    expect(screen.getByText("⌘H")).toBeInTheDocument();
  });

  it("executes action on click and closes", () => {
    const onClose = vi.fn();
    render(<GlobalPalette {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText("Open Settings"));
    expect(mockActions[0].action).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on overlay click", () => {
    const onClose = vi.fn();
    const { container } = render(<GlobalPalette {...defaultProps} onClose={onClose} />);
    const overlay = container.querySelector(".global-palette-overlay");
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalled();
  });

  it("handles Enter key to execute selected action", () => {
    render(<GlobalPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText("Type a command...");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockActions[0].action).toHaveBeenCalled();
  });

  it("handles Escape key to close", () => {
    const onClose = vi.fn();
    render(<GlobalPalette {...defaultProps} onClose={onClose} />);
    const input = screen.getByPlaceholderText("Type a command...");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates with arrow keys", () => {
    render(<GlobalPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText("Type a command...");

    // First item should be selected by default
    const items = screen.getAllByRole("option");
    expect(items[0]).toHaveAttribute("aria-selected", "true");

    // Arrow down
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(items[1]).toHaveAttribute("aria-selected", "true");

    // Arrow up
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(items[0]).toHaveAttribute("aria-selected", "true");
  });
});
