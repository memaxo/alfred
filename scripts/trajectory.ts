#!/usr/bin/env bun

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { db } from "@alfred/db";
import * as trajectoryRepo from "@alfred/db/repo/trajectory";
import type { WorkflowStatus } from "@alfred/db/repo/workflow";
import * as workflowRepo from "@alfred/db/repo/workflow";
import type { WorkflowTrajectoryFormat } from "@alfred/db/schema/workflow";
import { buildAtifTrajectory } from "@alfred/runtime/trajectory/atif";
import { validateAtifTrajectory } from "@alfred/runtime/trajectory/validate";
import { sql } from "drizzle-orm";

type ExportArgs = {
  outDir: string;
  runIds: string[];
  userId: string | null;
  status: WorkflowStatus | null;
  limit: number;
  offset: number;
  refresh: boolean;
  writeFiles: boolean;
};

function usage(): string {
  return [
    "Usage:",
    "  bun scripts/trajectory.ts export --outDir <dir> [--runId <uuid> ...]",
    "  bun scripts/trajectory.ts export --outDir <dir> --userId <id> [--status <status>] [--limit N] [--offset N]",
    "",
    "Options:",
    "  --outDir <dir>     Directory for exported JSON files",
    "  --runId <uuid>     Export specific runId(s) (repeatable)",
    "  --userId <id>      Export runs for a userId (bulk)",
    "  --status <status>  running|suspended|completed|failed|cancelled",
    "  --limit <n>        Default 50 (bulk mode)",
    "  --offset <n>       Default 0 (bulk mode)",
    "  --refresh          Force rebuild even if cached is fresh",
    "  --no-files         Don’t write files; only upsert in DB",
  ].join("\n");
}

function parseStatus(raw: string | undefined): WorkflowStatus | null {
  if (!raw) {
    return null;
  }
  const v = raw.trim().toLowerCase();
  if (
    v === "running" ||
    v === "suspended" ||
    v === "completed" ||
    v === "failed" ||
    v === "cancelled"
  ) {
    return v;
  }
  return null;
}

function parseArgs(argv: string[]): { cmd: string | null; args: ExportArgs } {
  const cmd = argv[0] ?? null;
  const out: ExportArgs = {
    outDir: "",
    runIds: [],
    userId: null,
    status: null,
    limit: 50,
    offset: 0,
    refresh: false,
    writeFiles: true,
  };

  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a) {
      continue;
    }

    if (a === "--outDir") {
      out.outDir = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (a === "--runId") {
      const v = argv[i + 1] ?? "";
      if (v) {
        out.runIds.push(v);
      }
      i += 1;
      continue;
    }
    if (a === "--userId") {
      out.userId = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (a === "--status") {
      out.status = parseStatus(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === "--limit") {
      out.limit = Number.parseInt(argv[i + 1] ?? "", 10) || out.limit;
      i += 1;
      continue;
    }
    if (a === "--offset") {
      out.offset = Number.parseInt(argv[i + 1] ?? "", 10) || out.offset;
      i += 1;
      continue;
    }
    if (a === "--refresh") {
      out.refresh = true;
      continue;
    }
    if (a === "--no-files") {
      out.writeFiles = false;
    }
  }

  return { cmd, args: out };
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function exportOne(
  runId: string,
  opts: { outDir: string; refresh: boolean; writeFiles: boolean }
) {
  const run = await workflowRepo.getRun(runId);
  if (!run) {
    return { runId, status: "missing" as const };
  }

  const format: WorkflowTrajectoryFormat = "atif";
  const marker = await trajectoryRepo.getRunEventMarker(runId);
  const existing = await trajectoryRepo.getTrajectoryByRunId({ runId, format });

  const isFresh =
    !opts.refresh &&
    existing &&
    (existing.lastEventId ?? null) === marker.lastEventId &&
    (existing.lastSeq ?? null) === marker.lastSeq;

  let trajectory: unknown;
  if (isFresh) {
    trajectory = existing!.data as unknown;
  } else {
    const events = await workflowRepo.listEvents(runId);
    trajectory = buildAtifTrajectory({
      runId,
      requirement: typeof run.requirement === "string" ? run.requirement : null,
      events: events.map((e) => ({
        eventId: e.eventId,
        eventType: e.eventType,
        eventData: e.eventData,
        timestamp: e.timestamp ?? null,
        seq: e.seq ?? null,
      })),
    });
  }

  // If we used cached data, assume it’s already validated.
  const validation = isFresh
    ? {
        ok: Boolean(existing!.valid),
        errors: [] as Array<{ path: string; message: string }>,
      }
    : validateAtifTrajectory(trajectory as any);

  const stored = await trajectoryRepo.upsertTrajectory({
    runId,
    format,
    schemaVersion: (trajectory as any).schema_version ?? "ATIF-v1.4",
    data: trajectory,
    lastEventId: marker.lastEventId,
    lastSeq: marker.lastSeq,
    valid: validation.ok,
    errors: validation.ok ? null : validation.errors,
  });

  if (opts.writeFiles) {
    await ensureDir(opts.outDir);
    const outPath = path.join(opts.outDir, `trajectory-${runId}.json`);
    await Bun.write(outPath, JSON.stringify(stored.data, null, 2));
  }

  return {
    runId,
    status: "exported" as const,
    ok: validation.ok,
    steps: (stored.data as any)?.steps?.length ?? null,
  };
}

function pLimit(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    active -= 1;
    const fn = queue.shift();
    if (fn) {
      fn();
    }
  };
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= max) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active += 1;
    try {
      return await fn();
    } finally {
      next();
    }
  };
}

async function main() {
  const { cmd, args } = parseArgs(process.argv.slice(2));
  if (cmd !== "export") {
    process.stderr.write(`${usage()}\n`);
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) {
    process.stderr.write("DATABASE_URL is required for trajectory export.\n");
    process.exit(2);
  }

  if (!args.outDir && args.writeFiles) {
    process.stderr.write("Missing --outDir.\n");
    process.stderr.write(`${usage()}\n`);
    process.exit(2);
  }

  const runIds = args.runIds.length
    ? args.runIds
    : args.userId
      ? (
          await workflowRepo.listRuns({
            userId: args.userId,
            status: args.status ?? undefined,
            limit: args.limit,
            offset: args.offset,
          })
        ).map((r) => r.id)
      : [];

  if (runIds.length === 0) {
    process.stderr.write("No runs selected. Provide --runId or --userId.\n");
    process.stderr.write(`${usage()}\n`);
    process.exit(2);
  }

  // Ensure user exists if bulk mode is used and workflow_runs FK requires it.
  // (No-op if it already exists; safe in single-user deployments.)
  if (args.userId) {
    await db.execute(sql`
      INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
      VALUES (${args.userId}, 'Owner', ${`${args.userId}@local`}, true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);
  }

  const limit = pLimit(4);
  const results = await Promise.all(
    runIds.map((runId) =>
      limit(() =>
        exportOne(runId, {
          outDir: args.outDir,
          refresh: args.refresh,
          writeFiles: args.writeFiles,
        })
      )
    )
  );

  process.stdout.write(
    `${JSON.stringify({ count: results.length, results }, null, 2)}\n`
  );
}

if (import.meta.main) {
  main().catch((err) => {
    process.stderr.write(
      `trajectory_export_failed: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  });
}
