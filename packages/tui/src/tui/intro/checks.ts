/**
 * ALFRED TUI System Status Checks
 *
 * Displays system readiness checks during intro sequence.
 */

import { colors, icons } from "../theme";
import { dim, fg } from "../typography";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CheckStatus =
  | "pending"
  | "running"
  | "success"
  | "warning"
  | "error";

export interface SystemCheck {
  id: string;
  label: string;
  status: CheckStatus;
  message?: string;
  duration?: number;
}

export interface CheckResult {
  status: "success" | "warning" | "error";
  message?: string;
}

export type CheckFn = () => Promise<CheckResult>;

// ─── Check Definitions ───────────────────────────────────────────────────────

export interface CheckDefinition {
  id: string;
  label: string;
  check: CheckFn;
}

// ─── Default Checks ──────────────────────────────────────────────────────────

export function createDefaultChecks(): CheckDefinition[] {
  return [
    {
      id: "cognitive",
      label: "Cognitive engine",
      check: async () => {
        // Check if cognitive state is accessible
        try {
          // Simulated check - in production, this would call the cognitive API
          await new Promise((resolve) => setTimeout(resolve, 100));
          return { status: "success", message: "online" };
        } catch {
          return { status: "warning", message: "degraded" };
        }
      },
    },
    {
      id: "knowledge",
      label: "Knowledge graph",
      check: async () => {
        try {
          // Simulated check - would query knowledge stats
          await new Promise((resolve) => setTimeout(resolve, 150));
          const factCount = 1234; // Would come from API
          return {
            status: "success",
            message: `${factCount.toLocaleString()} facts`,
          };
        } catch {
          return { status: "error", message: "unavailable" };
        }
      },
    },
    {
      id: "voice",
      label: "Voice pipeline",
      check: async () => {
        try {
          // Simulated check - would check voice pool status
          await new Promise((resolve) => setTimeout(resolve, 80));
          return { status: "success", message: "standby" };
        } catch {
          return { status: "warning", message: "not loaded" };
        }
      },
    },
    {
      id: "autonomy",
      label: "Autonomy level",
      check: async () => {
        try {
          // Simulated check - would get current autonomy
          await new Promise((resolve) => setTimeout(resolve, 50));
          const autonomy = 0.72; // Would come from cognitive state
          return { status: "success", message: autonomy.toFixed(2) };
        } catch {
          return { status: "warning", message: "unknown" };
        }
      },
    },
  ];
}

// ─── Check Runner ────────────────────────────────────────────────────────────

export async function runChecks(
  definitions: CheckDefinition[],
  onUpdate: (checks: SystemCheck[]) => void
): Promise<SystemCheck[]> {
  const checks: SystemCheck[] = definitions.map((def) => ({
    id: def.id,
    label: def.label,
    status: "pending" as CheckStatus,
  }));

  onUpdate([...checks]);

  for (let i = 0; i < definitions.length; i++) {
    const def = definitions[i];
    if (!def) {
      continue;
    }

    // Mark as running
    const currentCheck = checks[i];
    if (currentCheck) {
      checks[i] = { ...currentCheck, status: "running" };
    }
    onUpdate([...checks]);

    const startTime = Date.now();
    try {
      const result = await def.check();
      const duration = Date.now() - startTime;
      const updatedCheck = checks[i];
      if (updatedCheck) {
        checks[i] = {
          ...updatedCheck,
          status: result.status,
          message: result.message,
          duration,
        };
      }
    } catch {
      const failedCheck = checks[i];
      if (failedCheck) {
        checks[i] = {
          ...failedCheck,
          status: "error",
          message: "failed",
          duration: Date.now() - startTime,
        };
      }
    }
    onUpdate([...checks]);
  }

  return checks;
}

// ─── Check Rendering ─────────────────────────────────────────────────────────

const spinnerFrames = icons.spinner;
let spinnerIndex = 0;

export function getSpinnerFrame(): string {
  const frame = spinnerFrames[spinnerIndex % spinnerFrames.length];
  spinnerIndex++;
  return frame ?? "⠋";
}

export function resetSpinner(): void {
  spinnerIndex = 0;
}

export function renderCheck(check: SystemCheck): string {
  const primary = fg(colors.primary);
  const success = fg(colors.success);
  const warning = fg(colors.warning);
  const error = fg(colors.error);
  const muted = fg(colors.muted);

  let statusIcon: string;
  let messageColor: (text: string) => string;

  switch (check.status) {
    case "pending": {
      statusIcon = muted(icons.pending);
      messageColor = muted;
      break;
    }
    case "running": {
      statusIcon = primary(getSpinnerFrame());
      messageColor = muted;
      break;
    }
    case "success": {
      statusIcon = success(icons.success);
      messageColor = success;
      break;
    }
    case "warning": {
      statusIcon = warning(icons.warning);
      messageColor = warning;
      break;
    }
    case "error": {
      statusIcon = error(icons.error);
      messageColor = error;
      break;
    }
  }

  const label = check.label.padEnd(20, ".");
  const message = check.message ?? "";
  const dots = ".".repeat(Math.max(0, 15 - message.length));

  return `  ${statusIcon} ${muted(label)}${dim(dots)} ${messageColor(message)}`;
}

export function renderChecks(checks: SystemCheck[]): string[] {
  return checks.map(renderCheck);
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export function getChecksSummary(checks: SystemCheck[]): {
  total: number;
  success: number;
  warnings: number;
  errors: number;
  allPassed: boolean;
} {
  const success = checks.filter((c) => c.status === "success").length;
  const warnings = checks.filter((c) => c.status === "warning").length;
  const errors = checks.filter((c) => c.status === "error").length;

  return {
    total: checks.length,
    success,
    warnings,
    errors,
    allPassed: errors === 0,
  };
}

export function renderChecksSummary(checks: SystemCheck[]): string {
  const summary = getChecksSummary(checks);
  const success = fg(colors.success);
  const warning = fg(colors.warning);
  const error = fg(colors.error);

  if (summary.errors > 0) {
    return error(`  ${summary.errors} system(s) unavailable`);
  }
  if (summary.warnings > 0) {
    return warning(
      `  All systems operational (${summary.warnings} warning(s))`
    );
  }
  return success("  All systems operational");
}
