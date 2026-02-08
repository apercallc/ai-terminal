import { invoke } from "@tauri-apps/api/core";
import type { RiskLevel } from "@/types";

/**
 * Frontend-side logger that wraps the Tauri backend audit log.
 */
export class SafetyLogger {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /** Log a command that was executed (or attempted). */
  async logCommand(options: {
    command: string;
    source: "user" | "ai" | "system";
    riskLevel: RiskLevel;
    approved: boolean;
    exitCode?: number | null;
    outputPreview?: string;
  }): Promise<void> {
    try {
      await invoke("write_log", {
        command: options.command,
        source: options.source,
        riskLevel: options.riskLevel,
        approved: options.approved,
        exitCode: options.exitCode ?? null,
        outputPreview: options.outputPreview ? options.outputPreview.slice(0, 500) : null,
        sessionId: this.sessionId,
      });
    } catch (err) {
      console.error("Failed to write audit log:", err);
    }
  }

  /** Get log entries from the backend. */
  async getEntries(options?: { date?: string; sessionId?: string; limit?: number }): Promise<
    Array<{
      id: string;
      timestamp: string;
      command: string;
      source: string;
      risk_level: string;
      approved: boolean;
      exit_code: number | null;
      output_preview: string | null;
      session_id: string;
    }>
  > {
    try {
      return await invoke("get_log_entries", {
        date: options?.date ?? null,
        sessionId: options?.sessionId ?? null,
        limit: options?.limit ?? 100,
      });
    } catch (err) {
      console.error("Failed to read audit log:", err);
      return [];
    }
  }

  /** Get available log dates. */
  async getDates(): Promise<string[]> {
    try {
      return await invoke("get_log_dates");
    } catch {
      return [];
    }
  }
}
