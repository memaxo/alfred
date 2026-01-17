#!/usr/bin/env bun

import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { orchestrateWorkflowStream } from "@alfred/agent/workflow/orchestrator";
import { workflowInput } from "@alfred/agent/workflow/schema";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { buildAtifTrajectory } from "@alfred/runtime/trajectory/atif";
import { validateAtifTrajectory } from "@alfred/runtime/trajectory/validate";
import { RuntimeContext } from "@alfred/type/runtime-context";

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

async function writeTrajectory(args: {
  runId: string;
  requirement: string | null;
  outPath: string;
}): Promise<{ ok: boolean; steps: number }> {
  const rows = await workflowRepo.listEvents(args.runId);
  const events = rows.map((e) => ({
    eventId: e.eventId,
    eventType: e.eventType,
    eventData: e.eventData,
    timestamp: e.timestamp ?? null,
    seq: e.seq ?? null,
  }));

  const traj = buildAtifTrajectory({
    runId: args.runId,
    requirement: args.requirement,
    events,
  });
  const v = validateAtifTrajectory(traj);
  await ensureParent(args.outPath);
  await Bun.write(args.outPath, JSON.stringify(traj, null, 2));
  return { ok: v.ok, steps: traj.steps.length };
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
  const runtimeContext = new RuntimeContext<Record<string, unknown>>([
    ["requestId", randomUUID()],
    ["receivedAt", new Date().toISOString()],
    ["method", "cli"],
    ["url", "cli://workflow"],
    ["ip", null],
    ["forwardedFor", []],
    ["userId", session.user.id],
    ["userRoles", ["owner"]],
    ["userScopes", ["*"]],
    ["scanContext", null],
  ]);

  await workflowRepo.createRun({
    id: runId,
    userId: session.user.id,
    workflowId: "plan",
    status: "running",
    requirement: args.requirement,
    inputData: payload,
  });

  let resolveDone: (() => void) | null = null;
  let rejectDone: ((err: unknown) => void) | null = null;
  let runError: unknown | null = null;
  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const stop = await orchestrateWorkflowStream(payload, session, {
    triggerPreferenceRefresh: () => {},
    context: { runtimeContext },
    emitError: (error) => {
      runError = error;
      rejectDone?.(error);
    },
    emitNext: (_event) => {},
    emitComplete: () => {
      resolveDone?.();
    },
  });

  try {
    await done;
  } catch (error) {
    if (!runError) {
      runError = error;
    }
  } finally {
    stop();
  }

  let traj: { ok: boolean; steps: number } | null = null;
  let trajError: string | null = null;
  if (args.outTrajectory) {
    try {
      traj = await writeTrajectory({
        runId,
        requirement: args.requirement,
        outPath: args.outTrajectory,
      });
    } catch (error) {
      trajError = error instanceof Error ? error.message : String(error);
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        runId,
        trajectory: traj,
        trajectoryError: trajError,
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
