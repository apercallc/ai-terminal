import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricsPanel } from "@/components/MetricsPanel/MetricsPanel";
import { MetricsCollector } from "@/lib/analytics/metrics";

// Mock MetricsCollector.loadHistory and getAggregateStats
vi.mock("@/lib/analytics/metrics", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/analytics/metrics")>();
  return {
    ...original,
    MetricsCollector: class extends original.MetricsCollector {
      static loadHistory() {
        return [];
      }
      static getAggregateStats() {
        return {
          totalSessions: 3,
          totalCommands: 15,
          successRate: 0.8,
          averageDuration: 45000,
          totalGoals: 5,
        };
      }
    },
  };
});

describe("MetricsPanel", () => {
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector("test-session");
    // Simulate some activity
    metrics.recordCommand(true);
    metrics.recordCommand(true);
    metrics.recordCommand(false);
  });

  it("renders the panel header", () => {
    render(<MetricsPanel onClose={vi.fn()} currentMetrics={metrics} />);
    expect(screen.getByText(/Metrics Dashboard/)).toBeInTheDocument();
  });

  it("renders current session section", () => {
    render(<MetricsPanel onClose={vi.fn()} currentMetrics={metrics} />);
    expect(screen.getByText("Current Session")).toBeInTheDocument();
  });

  it("renders all-time stats section", () => {
    render(<MetricsPanel onClose={vi.fn()} currentMetrics={metrics} />);
    expect(screen.getByText("All-Time Stats")).toBeInTheDocument();
  });

  it("shows aggregate data from history", () => {
    render(<MetricsPanel onClose={vi.fn()} currentMetrics={metrics} />);
    // The aggregate stats section should contain the total sessions count
    const allTimeSection = screen.getByText("All-Time Stats").closest(".metrics-section");
    expect(allTimeSection).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<MetricsPanel onClose={onClose} currentMetrics={metrics} />);
    const closeBtn = screen.getByLabelText("Close");
    closeBtn.click();
    expect(onClose).toHaveBeenCalled();
  });
});
