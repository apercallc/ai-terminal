import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "@/components/ThemeToggle/ThemeToggle";

describe("ThemeToggle", () => {
  it("renders toggle button", () => {
    render(<ThemeToggle theme="dark" onToggle={vi.fn()} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeInTheDocument();
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<ThemeToggle theme="dark" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows sun icon in dark mode", () => {
    render(<ThemeToggle theme="dark" onToggle={vi.fn()} />);
    const btn = screen.getByTitle(/switch to light/i);
    expect(btn).toBeInTheDocument();
  });

  it("shows moon icon in light mode", () => {
    render(<ThemeToggle theme="light" onToggle={vi.fn()} />);
    const btn = screen.getByTitle(/switch to dark/i);
    expect(btn).toBeInTheDocument();
  });
});
