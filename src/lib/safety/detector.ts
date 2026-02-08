import type { RiskLevel } from "@/types";

/**
 * Patterns that indicate potentially dangerous commands.
 * Each pattern maps a regex to a risk level and description.
 */
interface DangerPattern {
  pattern: RegExp;
  riskLevel: RiskLevel;
  reason: string;
}

const DANGER_PATTERNS: DangerPattern[] = [
  // Critical — system-destroying
  {
    pattern: /\brm\s+(-rf?|--recursive)\s+\/(?:\s|$)/,
    riskLevel: "critical",
    reason: "Recursive deletion of root filesystem",
  },
  { pattern: /\bmkfs\b/, riskLevel: "critical", reason: "Formatting a filesystem" },
  {
    pattern: /\bdd\b.*\bof=\/dev\//,
    riskLevel: "critical",
    reason: "Writing directly to a device",
  },
  { pattern: />\s*\/dev\/sda/, riskLevel: "critical", reason: "Overwriting disk device" },
  { pattern: /:(){ :|:& };:/, riskLevel: "critical", reason: "Fork bomb detected" },

  // High — destructive or privilege-escalating
  {
    pattern: /\brm\s+(-rf?|--recursive)\s+~/,
    riskLevel: "high",
    reason: "Recursive deletion in home directory",
  },
  {
    pattern: /\brm\s+(-rf?|--recursive)\s+\*/,
    riskLevel: "high",
    reason: "Recursive wildcard deletion",
  },
  {
    pattern: /\bchmod\s+(-R\s+)?777\b/,
    riskLevel: "high",
    reason: "Setting world-writable permissions",
  },
  {
    pattern: /\bchown\s+-R\s+root\b/,
    riskLevel: "high",
    reason: "Changing ownership to root recursively",
  },
  {
    pattern: /\bcurl\b.*\|\s*(sudo\s+)?(ba)?sh\b/,
    riskLevel: "high",
    reason: "Piping remote script to shell",
  },
  {
    pattern: /\bwget\b.*\|\s*(sudo\s+)?(ba)?sh\b/,
    riskLevel: "high",
    reason: "Piping remote script to shell",
  },
  { pattern: /\bsudo\s+rm\b/, riskLevel: "high", reason: "Deleting files as root" },
  { pattern: /\bsudo\s+.*\s+--force\b/, riskLevel: "high", reason: "Forced operation as root" },
  { pattern: /\bkillall\b/, riskLevel: "high", reason: "Killing all processes by name" },
  {
    pattern: /\bsystemctl\s+(stop|disable|mask)\b/,
    riskLevel: "high",
    reason: "Stopping or disabling system services",
  },
  { pattern: /\blaunchctl\s+unload\b/, riskLevel: "high", reason: "Unloading system services" },

  // Medium — modifying system state
  { pattern: /\bsudo\b/, riskLevel: "medium", reason: "Running with elevated privileges" },
  { pattern: /\brm\s+-r\b/, riskLevel: "medium", reason: "Recursive file deletion" },
  { pattern: /\brm\s+/, riskLevel: "medium", reason: "Deleting files" },
  {
    pattern: /\bnpm\s+install\s+-g\b/,
    riskLevel: "medium",
    reason: "Global npm package installation",
  },
  { pattern: /\bbrew\s+install\b/, riskLevel: "medium", reason: "Installing a Homebrew package" },
  {
    pattern: /\bapt\s+(install|remove)\b/,
    riskLevel: "medium",
    reason: "System package modification",
  },
  { pattern: /\bpip\s+install\b/, riskLevel: "medium", reason: "Installing Python packages" },
  { pattern: /\bchmod\b/, riskLevel: "medium", reason: "Changing file permissions" },
  { pattern: /\bchown\b/, riskLevel: "medium", reason: "Changing file ownership" },
  { pattern: /\bmv\b.*\//, riskLevel: "medium", reason: "Moving files" },

  // Low — generally safe but worth noting
  { pattern: /\bcp\s+-r\b/, riskLevel: "low", reason: "Recursive file copy" },
  { pattern: /\bmkdir\b/, riskLevel: "low", reason: "Creating directories" },
  { pattern: /\btouch\b/, riskLevel: "low", reason: "Creating or updating files" },
  { pattern: /\bgit\s+(push|reset|rebase)\b/, riskLevel: "low", reason: "Git write operation" },
  { pattern: /\bnpm\s+(run|start|test)\b/, riskLevel: "low", reason: "Running npm script" },
];

/** Commands that should never be executed automatically. */
const BLACKLIST_PATTERNS: RegExp[] = [
  /\brm\s+(-rf?|--recursive)\s+\/(?:\s|$)/,
  /:(){ :|:& };:/,
  /\bdd\b.*\bof=\/dev\/sd[a-z]\b/,
  /\bmkfs\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bhalt\b/,
  /\binit\s+0\b/,
];

/**
 * Analyze a command and return its risk assessment.
 */
export function analyzeCommand(command: string): {
  riskLevel: RiskLevel;
  reasons: string[];
  isBlacklisted: boolean;
} {
  const reasons: string[] = [];
  let highestRisk: RiskLevel = "safe";
  const riskOrder: RiskLevel[] = ["safe", "low", "medium", "high", "critical"];

  // Check blacklist first
  const isBlacklisted = BLACKLIST_PATTERNS.some((p) => p.test(command));
  if (isBlacklisted) {
    return {
      riskLevel: "critical",
      reasons: ["This command is blacklisted for safety"],
      isBlacklisted: true,
    };
  }

  for (const { pattern, riskLevel, reason } of DANGER_PATTERNS) {
    if (pattern.test(command)) {
      reasons.push(reason);
      if (riskOrder.indexOf(riskLevel) > riskOrder.indexOf(highestRisk)) {
        highestRisk = riskLevel;
      }
    }
  }

  return {
    riskLevel: highestRisk,
    reasons: reasons.length > 0 ? reasons : ["No known risks detected"],
    isBlacklisted: false,
  };
}

/**
 * Get the display color for a risk level.
 */
export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "safe":
      return "#3fb950";
    case "low":
      return "#58a6ff";
    case "medium":
      return "#d29922";
    case "high":
      return "#f85149";
    case "critical":
      return "#ff0000";
    default:
      return "#8b949e";
  }
}

/**
 * Get a human-readable label for a risk level.
 */
export function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case "safe":
      return "Safe";
    case "low":
      return "Low Risk";
    case "medium":
      return "Medium Risk";
    case "high":
      return "High Risk";
    case "critical":
      return "Critical";
    default:
      return "Unknown";
  }
}
