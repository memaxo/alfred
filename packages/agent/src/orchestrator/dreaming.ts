import { createHash } from "node:crypto";

import { redactObject, redactSecrets } from "../utils/redaction.js";

type DreamSeverity = "low" | "medium" | "high";

export interface DreamHeuristicSeed {
  hash: string;
  label: string;
  properties: {
    rule: string;
    mistake: string;
    correction: string;
    severity: DreamSeverity;
    domain: string | null;
    confidence: number;
    source: "dreaming";
    workflowId: string;
    runId: string;
    errorMessage: string;
    context: {
      input?: string;
      state?: string;
    } | null;
    recordedAt: string;
  };
}

const TRANSIENT_ERROR_PATTERNS: RegExp[] = [
  /\btimeout\b/i,
  /\betimedout\b/i,
  /\beconnrefused\b/i,
  /\beconnreset\b/i,
  /\benotfound\b/i,
  /\bnetwork\b/i,
  /\brate\s*limit\b/i,
  /\b429\b/i,
  /\b5\d\d\b/i,
  /\btemporar(?:y|ily)\b/i,
  /\bunavailable\b/i,
  /\bservice\s+unavailable\b/i,
];

function isTransientFailure(errorMessage: string): boolean {
  for (const pattern of TRANSIENT_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return true;
    }
  }
  return false;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}…`;
}

function summarizeObject(value: unknown, maxChars: number): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  try {
    const redacted = redactObject(value);
    const json = JSON.stringify(redacted);
    if (!json) {
      return null;
    }
    return truncate(json, maxChars);
  } catch {
    return null;
  }
}

function inferSeverity(errorMessage: string): DreamSeverity {
  const msg = errorMessage.toLowerCase();
  if (msg.includes("biometric_required")) {
    return "medium";
  }
  if (msg.includes("unauthorized") || msg.includes("forbidden")) {
    return "medium";
  }
  if (msg.includes("invalid") || msg.includes("validation")) {
    return "low";
  }
  return "medium";
}

function inferConfidence(severity: DreamSeverity): number {
  switch (severity) {
    case "high": {
      return 0.9;
    }
    case "medium": {
      return 0.75;
    }
    case "low": {
      return 0.6;
    }
  }
}

function buildCorrection(workflowId: string, errorMessage: string): string {
  const msg = errorMessage.toLowerCase();
  if (msg.includes("biometric_required")) {
    return "Request passkey elevation before repo write operations (merge/push).";
  }
  if (msg.includes("session_required")) {
    return "Ensure the workflow has an authenticated session before executing tools.";
  }
  if (msg.includes("unauthorized") || msg.includes("forbidden")) {
    return "Check scopes/policy; ensure the tool token includes required scopes and claims.";
  }
  if (msg.includes("invalid") || msg.includes("validation")) {
    return "Validate inputs early; ensure schemas match expected payload shapes.";
  }
  return `Investigate ${workflowId} failure; identify root cause and apply the minimal fix, then rerun.`;
}

export function buildDreamHeuristic(args: {
  runId: string;
  workflowId: string;
  inputData?: unknown;
  stateData?: unknown;
  errorMessage?: string | null;
}):
  | { status: "skip"; reason: string }
  | { status: "emit"; seed: DreamHeuristicSeed } {
  const workflowId = args.workflowId.trim();
  if (!workflowId) {
    return { status: "skip", reason: "missing_workflow_id" };
  }

  const rawError =
    typeof args.errorMessage === "string" ? args.errorMessage : "";
  const safeError = redactSecrets(rawError).trim();
  if (!safeError) {
    return { status: "skip", reason: "missing_error_message" };
  }

  if (isTransientFailure(safeError)) {
    return { status: "skip", reason: "transient_failure" };
  }

  const inputSummary = summarizeObject(args.inputData, 600);
  const stateSummary = summarizeObject(args.stateData, 600);

  const severity = inferSeverity(safeError);
  const correction = buildCorrection(workflowId, safeError);
  const mistake = truncate(`${workflowId} failed: ${safeError}`, 400);
  const rule = truncate(`Avoid: ${mistake}. Fix: ${correction}`, 800);

  const stable = [
    "dreaming",
    args.runId,
    workflowId,
    safeError.slice(0, 240),
  ].join("|");
  const digest = createHash("sha256").update(stable).digest("hex");

  const label = truncate(`Avoid: ${safeError}`, 200);
  const recordedAt = new Date().toISOString();

  return {
    status: "emit",
    seed: {
      hash: `dream:${digest}`,
      label,
      properties: {
        rule,
        mistake,
        correction,
        severity,
        domain: "workflow",
        confidence: inferConfidence(severity),
        source: "dreaming",
        workflowId,
        runId: args.runId,
        errorMessage: safeError,
        context:
          inputSummary || stateSummary
            ? {
                input: inputSummary ?? undefined,
                state: stateSummary ?? undefined,
              }
            : null,
        recordedAt,
      },
    },
  };
}
