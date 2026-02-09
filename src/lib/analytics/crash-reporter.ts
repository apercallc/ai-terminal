import { invoke } from "@tauri-apps/api/core";
import { redactSecrets } from "@/lib/security/redact";

let initialized = false;
let hasReported = false;

function toSafeString(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ""}`;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function writeCrashLog(message: string, details?: string): Promise<void> {
  if (hasReported) return;
  hasReported = true;

  const safeMsg = redactSecrets(message).slice(0, 1000);
  const safeDetails = details ? redactSecrets(details).slice(0, 8000) : null;

  try {
    await invoke("write_log", {
      command: `CRASH: ${safeMsg}`,
      source: "system",
      riskLevel: "safe",
      approved: true,
      exitCode: null,
      outputPreview: safeDetails,
      sessionId: `crash-${Date.now()}`,
    });
  } catch {
    // Intentionally ignore: crash telemetry must never crash the app.
  }
}

export function initCrashReporter(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener(
    "error",
    (event) => {
      const msg = event.error ? toSafeString(event.error) : `${event.message}`;
      void writeCrashLog("Unhandled error", msg);
    },
    { capture: true },
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      const msg = toSafeString(event.reason);
      void writeCrashLog("Unhandled promise rejection", msg);
    },
    { capture: true },
  );
}
