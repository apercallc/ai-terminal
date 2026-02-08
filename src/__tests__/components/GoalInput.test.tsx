import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GoalInput } from "@/components/GoalInput/GoalInput";

describe("GoalInput", () => {
  it("renders input and submit button", () => {
    render(<GoalInput onSubmit={vi.fn()} onCancel={vi.fn()} agentState="idle" disabled={false} />);

    const input = screen.getByPlaceholderText(/enter a goal/i);
    expect(input).toBeInTheDocument();
  });

  it("calls onSubmit with typed goal", () => {
    const onSubmit = vi.fn();
    render(<GoalInput onSubmit={onSubmit} onCancel={vi.fn()} agentState="idle" disabled={false} />);

    const input = screen.getByPlaceholderText(/enter a goal/i);
    fireEvent.change(input, { target: { value: "install lodash" } });
    fireEvent.submit(input.closest("form")!);

    expect(onSubmit).toHaveBeenCalledWith("install lodash");
  });

  it("does not submit empty input", () => {
    const onSubmit = vi.fn();
    render(<GoalInput onSubmit={onSubmit} onCancel={vi.fn()} agentState="idle" disabled={false} />);

    const input = screen.getByPlaceholderText(/enter a goal/i);
    fireEvent.submit(input.closest("form")!);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows stop button when running", () => {
    render(
      <GoalInput onSubmit={vi.fn()} onCancel={vi.fn()} agentState="executing" disabled={true} />,
    );

    const stopBtn = screen.getByText(/stop/i);
    expect(stopBtn).toBeInTheDocument();
  });

  it("calls onCancel when stop is clicked", () => {
    const onCancel = vi.fn();
    render(
      <GoalInput onSubmit={vi.fn()} onCancel={onCancel} agentState="executing" disabled={true} />,
    );

    const stopBtn = screen.getByText(/stop/i);
    fireEvent.click(stopBtn);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("disables input when running", () => {
    render(
      <GoalInput onSubmit={vi.fn()} onCancel={vi.fn()} agentState="executing" disabled={true} />,
    );

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });
});
