import { appRouter } from "@alfred/api/router";
import { createCliContext } from "./context";

type PhaseCaller = Awaited<ReturnType<typeof appRouter.createCaller>>;

async function createPhaseCaller(): Promise<PhaseCaller> {
  const ctx = await createCliContext();
  return appRouter.createCaller(
    ctx as unknown as Parameters<typeof appRouter.createCaller>[0]
  );
}

export async function handlePlanCommand(args: string[]): Promise<void> {
  const help = args.includes("--help") || args.includes("-h");
  const requirement = args.find((a) => a && !a.startsWith("--")) ?? "";
  const workspace = getArgValue(args, "--workspace") ?? process.cwd();
  const runId = getArgValue(args, "--run-id") ?? undefined;

  if (help || requirement.length === 0) {
    printPlanHelp();
    return;
  }

  const caller = await createPhaseCaller();
  const res = await caller.workflow.phase.plan({
    requirement,
    workspace,
    userId: "cli",
    runId,
  });

  process.stdout.write(`runId: ${res.runId}\n`);
  process.stdout.write(`waves: ${res.waveCount}\n`);
  for (const w of res.waves) {
    process.stdout.write(
      `- ${w.id}: agents=${w.agents.length} dependsOn=${w.dependsOn.join(",")}\n`
    );
  }
}

export async function handleStatusCommand(args: string[]): Promise<void> {
  const help = args.includes("--help") || args.includes("-h");
  const runId = getArgValue(args, "--run-id") ?? "";

  if (help || runId.length === 0) {
    printStatusHelp();
    return;
  }

  const caller = await createPhaseCaller();
  const status = await caller.workflow.phase.status({ runId });

  process.stdout.write(`runId: ${status.runId}\n`);
  process.stdout.write(`status: ${status.status}\n`);
  process.stdout.write(`canResume: ${status.canResume}\n`);
  process.stdout.write(`nextStage: ${status.nextStage ?? "null"}\n`);
}

export async function handleExecuteCommand(args: string[]): Promise<void> {
  const help = args.includes("--help") || args.includes("-h");
  const runId = getArgValue(args, "--run-id") ?? "";
  const dryRun = args.includes("--dry-run") || args.includes("--dryRun");
  const waveIds = getMultiArgValue(args, "--wave");
  const skipTaskIds = getMultiArgValue(args, "--skip-task");

  if (help || runId.length === 0) {
    printExecuteHelp();
    return;
  }

  const caller = await createPhaseCaller();
  const res = await caller.workflow.phase.executeByRunId({
    runId,
    dryRun: dryRun ? true : undefined,
    waveIds: waveIds.length > 0 ? waveIds : undefined,
    skipTaskIds: skipTaskIds.length > 0 ? skipTaskIds : undefined,
  });

  process.stdout.write(`runId: ${res.runId}\n`);
  process.stdout.write(`status: ${res.status}\n`);
  process.stdout.write(`completed: ${res.completed}\n`);
}

export async function handleCompilationCommand(args: string[]): Promise<void> {
  const help = args.includes("--help") || args.includes("-h");
  const runId = getArgValue(args, "--run-id") ?? "";

  if (help || runId.length === 0) {
    printCompilationHelp();
    return;
  }

  const caller = await createPhaseCaller();
  const compilation = await caller.workflow.compilation.get({ runId });

  if (!compilation) {
    process.stdout.write(`runId: ${runId}\n`);
    process.stdout.write("compilation: null\n");
    return;
  }

  process.stdout.write(`runId: ${compilation.runId}\n`);
  process.stdout.write(`status: ${compilation.status}\n`);
  process.stdout.write(`finishedAt: ${compilation.finishedAt}\n`);
  if (typeof compilation.totalDurationMs === "number") {
    process.stdout.write(`totalDurationMs: ${compilation.totalDurationMs}\n`);
  }
  if (compilation.summaryText) {
    process.stdout.write(`summary: ${compilation.summaryText}\n`);
  }

  process.stdout.write(
    `files: created=${compilation.fileChanges.created.length} modified=${compilation.fileChanges.modified.length} deleted=${compilation.fileChanges.deleted.length}\n`
  );

  if (compilation.fileChanges.created.length > 0) {
    process.stdout.write("created:\n");
    for (const p of compilation.fileChanges.created.slice(0, 50)) {
      process.stdout.write(`- ${p}\n`);
    }
  }
  if (compilation.fileChanges.modified.length > 0) {
    process.stdout.write("modified:\n");
    for (const p of compilation.fileChanges.modified.slice(0, 50)) {
      process.stdout.write(`- ${p}\n`);
    }
  }
  if (compilation.fileChanges.deleted.length > 0) {
    process.stdout.write("deleted:\n");
    for (const p of compilation.fileChanges.deleted.slice(0, 50)) {
      process.stdout.write(`- ${p}\n`);
    }
  }

  process.stdout.write(`agents: ${compilation.agents.length}\n`);
  for (const a of compilation.agents.slice(0, 50)) {
    process.stdout.write(`- ${a.agentId} (${a.status})\n`);
    const summary =
      a.result?.summary || a.escalation || (a.stuck ? "stuck" : "");
    if (summary) {
      process.stdout.write(`  ${summary}\n`);
    }
  }
  if (compilation.agents.length > 50) {
    process.stdout.write("note: truncated agents output at 50\n");
  }
}

function getArgValue(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx === -1) {
    return null;
  }
  const next = args.at(idx + 1);
  return next && !next.startsWith("--") ? next : null;
}

function getMultiArgValue(args: string[], flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) {
      const next = args.at(i + 1);
      if (next && !next.startsWith("--")) {
        out.push(next);
      }
    }
  }
  return out;
}

function printPlanHelp(): void {
  process.stdout.write(
    `${[
      'alfred plan "<requirement>" [--workspace <path>] [--run-id <id>]',
      "",
      "Generates a plan (init→schedule) and prints runId + waves.",
    ].join("\n")}\n`
  );
}

function printExecuteHelp(): void {
  process.stdout.write(
    `${[
      "alfred execute --run-id <id> [--dry-run] [--wave <waveId> ...] [--skip-task <taskId> ...]",
      "",
      "Executes a run by runId (derives plan from snapshot).",
    ].join("\n")}\n`
  );
}

function printStatusHelp(): void {
  process.stdout.write(
    `${["alfred status --run-id <id>", "", "Shows phase status."].join("\n")}\n`
  );
}

function printCompilationHelp(): void {
  process.stdout.write(
    `${[
      "alfred work --run-id <id>",
      "alfred compilation --run-id <id>",
      "",
      "Prints the persisted work compilation for a workflow run.",
    ].join("\n")}\n`
  );
}
