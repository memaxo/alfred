#!/usr/bin/env bun

import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { wrapEventEnvelope } from "@alfred/agent/utils/envelope";
import { eventToUiMessages } from "@alfred/agent/utils/normalize";
import { redactEventData } from "@alfred/agent/utils/redaction";
import { workflowInput } from "@alfred/agent/workflow/schema";
import type { WorkflowEventType } from "@alfred/db/schema/workflow";
import { runOrchestrator } from "@alfred/runtime/orchestrator";
import type { PersistedWorkflowEvent } from "@alfred/runtime/trajectory/atif";
import { buildAtifTrajectory } from "@alfred/runtime/trajectory/atif";
import { validateAtifTrajectory } from "@alfred/runtime/trajectory/validate";
import type { RuntimeInput } from "@alfred/runtime/types";
import { makeEventId } from "@alfred/type/id";
import type { WorkflowEvent } from "@alfred/type/plan";

type RunArgs = {
  requirement: string;
  workspace: string | null;
  outTrajectory: string | null;
  auto: "read" | "low" | "medium" | "high";
  mode: "sequential" | "parallel";
};

function usage(): string {
  return [
    "Usage:",
    "  bun scripts/workflow.ts run --requirement <text> [--workspace <dir>] [--outTrajectory <path>]",
    "",
    "Options:",
    "  --requirement <text>      Required. High-level instruction for ALFRED",
    "  --workspace <dir>         Working directory (defaults to cwd)",
    "  --outTrajectory <path>    If set, writes ATIF trajectory JSON to this path",
    "  --auto <band>             read|low|medium|high (default low)",
    "  --mode <mode>             sequential|parallel (default sequential)",
  ].join("\n");
}

function parseArgs(argv: string[]): { cmd: string | null; args: RunArgs } {
  const cmd = argv[0] ?? null;
  const out: RunArgs = {
    requirement: "",
    workspace: null,
    outTrajectory: null,
    auto: "low",
    mode: "sequential",
  };

  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a) {
      continue;
    }
    if (a === "--requirement") {
      out.requirement = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (a === "--workspace") {
      out.workspace = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (a === "--outTrajectory") {
      out.outTrajectory = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (a === "--auto") {
      const v = (argv[i + 1] ?? "").trim().toLowerCase();
      if (v === "read" || v === "low" || v === "medium" || v === "high") {
        out.auto = v;
      }
      i += 1;
      continue;
    }
    if (a === "--mode") {
      const v = (argv[i + 1] ?? "").trim().toLowerCase();
      if (v === "sequential" || v === "parallel") {
        out.mode = v;
      }
      i += 1;
    }
  }

  return { cmd, args: out };
}

async function ensureParent(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

const VALID_EVENT_TYPES = new Set<WorkflowEventType>([
  "run",
  "progress",
  "context",
  "require-scope",
  "notice",
  "error",
  "stdout",
  "stderr",
  "droid",
  "data-cache-handoff",
  "ui-message",
  "text-delta",
  "tool-call",
  "tool-result",
  "reasoning",
  "finish",
  "data-status",
  "file",
  "obligation",
  "plan-selected",
  "phase-start",
  "phase-complete",
  "phase-progress",
  "agent-start",
  "agent-complete",
  "wave-start",
  "wave-complete",
  "agent-handoff",
  "assistant",
  "report",
  "step-start",
  "step-complete",
  "step-skip",
  "step_start",
  "step_complete",
  "suspend",
  "resume",
]);

function getEventType(event: WorkflowEvent): WorkflowEventType {
  const raw = typeof event._ === "string" ? event._ : "error";
  return VALID_EVENT_TYPES.has(raw as WorkflowEventType)
    ? (raw as WorkflowEventType)
    : "error";
}

function coerceNonEmptyString(val: unknown): string | null {
  return typeof val === "string" && val.length > 0 ? val : null;
}

function coerceRecord(val: unknown): Record<string, unknown> {
  if (typeof val === "object" && val !== null && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

function normalizeWorkflowEvent(event: WorkflowEvent): WorkflowEvent {
  const redactedData = redactEventData(event);
  const record = coerceRecord(redactedData);
  const discriminant = typeof event._ === "string" ? event._ : "error";
  return {
    ...record,
    _: coerceNonEmptyString(record._) ?? discriminant,
  } as WorkflowEvent;
}

function buildPersistedEvents(args: {
  runId: string;
  workflowEvents: Array<{ event: WorkflowEvent; createdAt: string }>;
}): PersistedWorkflowEvent[] {
  const out: PersistedWorkflowEvent[] = [];
  let seq = 1;

  for (const { event, createdAt } of args.workflowEvents) {
    const normalized = normalizeWorkflowEvent(event);
    const eventType = getEventType(normalized);
    const eventData = redactEventData(normalized);
    const eventId = makeEventId({
      runId: args.runId,
      type: eventType,
      data: eventData,
    });

    out.push({
      eventId,
      eventType,
      seq,
      timestamp: new Date(createdAt),
      eventData: wrapEventEnvelope({
        id: eventId,
        type: eventType,
        resource: "user",
        data: eventData,
        createdAt,
      }),
    });
    seq += 1;

    const uiMessages = eventToUiMessages(normalized);
    if (Array.isArray(uiMessages) && uiMessages.length > 0) {
      const uiEventId = makeEventId({
        runId: args.runId,
        type: "ui-message",
        data: uiMessages,
      });
      out.push({
        eventId: uiEventId,
        eventType: "ui-message",
        seq,
        timestamp: new Date(createdAt),
        eventData: wrapEventEnvelope({
          id: uiEventId,
          type: "ui-message",
          resource: "user",
          data: uiMessages,
          createdAt,
        }),
      });
      seq += 1;
    }
  }

  return out;
}

async function writeTrajectory(args: {
  runId: string;
  requirement: string;
  workflowEvents: Array<{ event: WorkflowEvent; createdAt: string }>;
  outPath: string;
}): Promise<{ ok: boolean; errors: Array<{ path: string; message: string }> }> {
  const persisted = buildPersistedEvents({
    runId: args.runId,
    workflowEvents: args.workflowEvents,
  });

  const trajectory = buildAtifTrajectory({
    runId: args.runId,
    requirement: args.requirement,
    events: persisted,
    agent: {
      name: "alfred",
      version:
        process.env.ALFRED_VERSION ??
        process.env.ALFRED_GIT_COMMIT ??
        "unknown",
      modelName:
        process.env.AI_MODEL_ORCHESTRATOR ??
        process.env.AI_MODEL ??
        process.env.OPENAI_MODEL_PLAN ??
        "unknown",
    },
  });

  const validation = validateAtifTrajectory(trajectory);
  await ensureParent(args.outPath);
  await Bun.write(args.outPath, JSON.stringify(trajectory, null, 2));

  return validation;
}

async function runWorkflow(args: RunArgs) {
  const workspace = args.workspace ?? process.cwd();
  const runId = randomUUID();
  const payload = workflowInput.parse({
    runId,
    requirement: args.requirement,
    auto: args.auto,
    mode: args.mode,
    workspace,
    cw: workspace,
    userId: "harbor",
  });

  const session = { user: { id: payload.userId ?? "harbor" } };

  const abortController = new AbortController();
  const workflowEvents: Array<{ event: WorkflowEvent; createdAt: string }> = [];

  let runError: unknown | null = null;
  try {
    const input: RuntimeInput = {
      requirement: payload.requirement,
      auto: payload.auto,
      mode: payload.mode,
      workspace,
    };

    for await (const event of runOrchestrator(
      input,
      runId,
      abortController.signal,
      undefined,
      undefined,
      undefined,
      payload.authz,
      undefined,
      session.user.id
    )) {
      workflowEvents.push({ event, createdAt: new Date().toISOString() });
    }
  } catch (error) {
    runError = error;
  }

  let trajError: string | null = null;
  let trajOk: boolean | null = null;
  let trajErrors: Array<{ path: string; message: string }> | null = null;
  if (args.outTrajectory) {
    try {
      const validation = await writeTrajectory({
        runId,
        requirement: payload.requirement,
        workflowEvents,
        outPath: args.outTrajectory,
      });
      trajOk = validation.ok;
      trajErrors = validation.errors;
    } catch (error) {
      trajError = error instanceof Error ? error.message : String(error);
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        runId,
        trajectoryError: trajError,
        trajectoryOk: trajOk,
        trajectoryValidationErrors: trajErrors,
        eventCount: workflowEvents.length,
        error:
          runError instanceof Error
            ? runError.message
            : runError
              ? String(runError)
              : null,
      },
      null,
      2
    )}\n`
  );

  if (runError) {
    throw runError;
  }
}

async function main() {
  const { cmd, args } = parseArgs(process.argv.slice(2));
  if (cmd !== "run") {
    process.stderr.write(`${usage()}\n`);
    process.exit(2);
  }
  if (!args.requirement.trim()) {
    process.stderr.write("Missing --requirement.\n");
    process.stderr.write(`${usage()}\n`);
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) {
    process.stderr.write(
      "DATABASE_URL is required. For Harbor container runs, use sqlite, e.g. DATABASE_URL=sqlite:/tmp/alfred.db\n"
    );
    process.exit(2);
  }
  await runWorkflow(args);
}

if (import.meta.main) {
  main().catch((err) => {
    process.stderr.write(
      `workflow_cli_failed: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  });
}
