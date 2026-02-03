import { ApiClient } from "../tui/api/client";

function createClient(args: string[]): ApiClient {
  const baseUrl =
    getArgValue(args, "--base-url") ??
    process.env.ALFRED_WEB_URL ??
    "http://localhost:3000";
  return new ApiClient({ baseUrl });
}

function printApiError(error: { code: string; message: string }): void {
  process.stderr.write(`error: ${error.code}\n`);
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}

async function resolveToolAuthz(args: string[]): Promise<string | null> {
  const normalize = (value: string | null): string | null => {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    return trimmed.startsWith("Bearer ") ? trimmed : `Bearer ${trimmed}`;
  };

  const direct = normalize(
    getArgValue(args, "--authz") ?? process.env.ALFRED_TOOL_AUTHZ ?? null
  );
  if (direct) {
    return direct;
  }
  try {
    const { loadCredentials } = await import("./credentials");
    const creds = await loadCredentials();
    const tool = creds?.toolAuthz;
    if (!tool?.token) {
      return null;
    }
    if (typeof tool.expiresAt === "number") {
      // Treat near-expiry tokens as missing to avoid confusing failures.
      const skewMs = 30_000;
      if (tool.expiresAt <= Date.now() + skewMs) {
        return null;
      }
    }
    return normalize(tool.token);
  } catch {
    return null;
  }
}

const STAGES = [
  "init",
  "context",
  "plan",
  "schedule",
  "execute",
  "review",
  "learn",
  "summarize",
] as const;
type Stage = (typeof STAGES)[number];

function parseStage(value: string): Stage | null {
  return STAGES.includes(value as Stage) ? (value as Stage) : null;
}

const EXEC_KINDS = ["codex", "opencode", "droid"] as const;
type ExecKind = (typeof EXEC_KINDS)[number];

function parseExecKind(value: string): ExecKind | null {
  return EXEC_KINDS.includes(value as ExecKind) ? (value as ExecKind) : null;
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

  const client = createClient(args);
  const res = await client.phasePlan({ requirement, runId, workspace });
  if (res.error || !res.data) {
    printApiError(
      res.error ?? { code: "UNKNOWN_ERROR", message: "phase_plan_failed" }
    );
    return;
  }

  process.stdout.write(`runId: ${res.data.runId}\n`);
  process.stdout.write(`waves: ${res.data.waveCount}\n`);
  for (const w of res.data.waves) {
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

  const client = createClient(args);
  const status = await client.phaseStatus(runId);
  if (status.error || !status.data) {
    printApiError(
      status.error ?? { code: "UNKNOWN_ERROR", message: "phase_status_failed" }
    );
    return;
  }

  process.stdout.write(`runId: ${status.data.runId}\n`);
  process.stdout.write(`status: ${status.data.status}\n`);
  process.stdout.write(`canResume: ${status.data.canResume}\n`);
  process.stdout.write(`nextStage: ${status.data.nextStage ?? "null"}\n`);
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

  const client = createClient(args);
  const authz = await resolveToolAuthz(args);
  const res = await client.executeByRunId({
    authz: authz ?? undefined,
    runId,
    dryRun: dryRun ? true : undefined,
    skipTaskIds: skipTaskIds.length > 0 ? skipTaskIds : undefined,
    waveIds: waveIds.length > 0 ? waveIds : undefined,
  });
  if (res.error || !res.data) {
    printApiError(
      res.error ?? { code: "UNKNOWN_ERROR", message: "phase_execute_failed" }
    );
    return;
  }

  process.stdout.write(`runId: ${res.data.runId}\n`);
  process.stdout.write(`status: ${res.data.status}\n`);
  process.stdout.write(`completed: ${res.data.completed}\n`);
}

export async function handleCompilationCommand(args: string[]): Promise<void> {
  const help = args.includes("--help") || args.includes("-h");
  const runId = getArgValue(args, "--run-id") ?? "";

  if (help || runId.length === 0) {
    printCompilationHelp();
    return;
  }

  const client = createClient(args);
  const compilation = await client.getCompilation(runId);
  if (compilation.error) {
    printApiError(compilation.error);
    return;
  }

  if (!compilation.data) {
    process.stdout.write(`runId: ${runId}\n`);
    process.stdout.write("compilation: null\n");
    return;
  }

  const rec = compilation.data as Record<string, unknown>;
  process.stdout.write(`runId: ${String(rec.runId ?? runId)}\n`);
  process.stdout.write(`status: ${String(rec.status ?? "unknown")}\n`);
  process.stdout.write(`finishedAt: ${String(rec.finishedAt ?? "unknown")}\n`);
  if (typeof rec.totalDurationMs === "number") {
    process.stdout.write(`totalDurationMs: ${rec.totalDurationMs}\n`);
  }
  if (typeof rec.summaryText === "string" && rec.summaryText.length > 0) {
    process.stdout.write(`summary: ${rec.summaryText}\n`);
  }

  const fileChanges =
    typeof rec.fileChanges === "object" && rec.fileChanges !== null
      ? (rec.fileChanges as Record<string, unknown>)
      : {};
  const created = Array.isArray(fileChanges.created) ? fileChanges.created : [];
  const modified = Array.isArray(fileChanges.modified)
    ? fileChanges.modified
    : [];
  const deleted = Array.isArray(fileChanges.deleted) ? fileChanges.deleted : [];

  process.stdout.write(
    `files: created=${created.length} modified=${modified.length} deleted=${deleted.length}\n`
  );

  if (created.length > 0) {
    process.stdout.write("created:\n");
    for (const p of created.slice(0, 50)) {
      process.stdout.write(`- ${String(p)}\n`);
    }
  }
  if (modified.length > 0) {
    process.stdout.write("modified:\n");
    for (const p of modified.slice(0, 50)) {
      process.stdout.write(`- ${String(p)}\n`);
    }
  }
  if (deleted.length > 0) {
    process.stdout.write("deleted:\n");
    for (const p of deleted.slice(0, 50)) {
      process.stdout.write(`- ${String(p)}\n`);
    }
  }

  const agents = Array.isArray(rec.agents) ? rec.agents : [];
  process.stdout.write(`agents: ${agents.length}\n`);
  for (const a of agents.slice(0, 50)) {
    const agentRec =
      typeof a === "object" && a !== null ? (a as Record<string, unknown>) : {};
    const agentId = String(agentRec.agentId ?? "unknown");
    const status = String(agentRec.status ?? "unknown");
    process.stdout.write(`- ${agentId} (${status})\n`);
  }
  if (agents.length > 50) {
    process.stdout.write("note: truncated agents output at 50\n");
  }
}

export async function handleStepCommand(args: string[]): Promise<void> {
  const help = args.includes("--help") || args.includes("-h");
  const runId = getArgValue(args, "--run-id") ?? "";
  const untilStage = getArgValue(args, "--until") ?? "";
  const workspace = getArgValue(args, "--workspace") ?? undefined;
  const requirement = getArgValue(args, "--requirement") ?? undefined;
  const authz = await resolveToolAuthz(args);

  if (help || runId.length === 0 || untilStage.length === 0) {
    printStepHelp();
    return;
  }

  const stage = parseStage(untilStage);
  if (!stage) {
    process.stderr.write(`until_stage_invalid: ${untilStage}\n`);
    process.exitCode = 1;
    return;
  }

  const client = createClient(args);
  const res = await client.phaseStep({
    authz: authz ?? undefined,
    requirement,
    runId,
    untilStage: stage,
    workspace,
  });
  if (res.error || !res.data) {
    printApiError(
      res.error ?? { code: "UNKNOWN_ERROR", message: "phase_step_failed" }
    );
    return;
  }

  process.stdout.write(`runId: ${res.data.runId}\n`);
  process.stdout.write(`status: ${res.data.status}\n`);
  process.stdout.write(`untilStage: ${res.data.untilStage}\n`);
  process.stdout.write(
    `lastCompletedStage: ${res.data.lastCompletedStage ?? "null"}\n`
  );
  process.stdout.write(`nextStage: ${res.data.nextStage ?? "null"}\n`);
  process.stdout.write(`canResume: ${res.data.canResume}\n`);
  process.stdout.write(`durationMs: ${res.data.durationMs}\n`);
  process.stdout.write(
    `outputSummary: ${JSON.stringify(res.data.outputSummary)}\n`
  );
}

export async function handlePrepareCommand(args: string[]): Promise<void> {
  const help = args.includes("--help") || args.includes("-h");
  const runId = getArgValue(args, "--run-id") ?? "";
  const workspace = getArgValue(args, "--workspace") ?? undefined;
  const authz = (await resolveToolAuthz(args)) ?? "";

  if (help || runId.length === 0 || authz.length === 0) {
    printPrepareHelp();
    return;
  }

  const client = createClient(args);
  const res = await client.phasePrepare({ authz, runId, workspace });
  if (res.error || !res.data) {
    printApiError(
      res.error ?? { code: "UNKNOWN_ERROR", message: "phase_prepare_failed" }
    );
    return;
  }

  process.stdout.write(`runId: ${res.data.runId}\n`);
  process.stdout.write(`workspace: ${res.data.workspace}\n`);
  process.stdout.write(`dbPath: ${res.data.dbPath}\n`);
  process.stdout.write(`containerName: ${res.data.containerName}\n`);
  process.stdout.write(`containerId: ${res.data.containerId ?? "null"}\n`);
  process.stdout.write(`containerCw: ${res.data.containerCw}\n`);
  process.stdout.write(`durationMs: ${res.data.durationMs}\n`);
}

export async function handleExecutorCommand(args: string[]): Promise<void> {
  const sub = args[0] ?? "";
  const help = args.includes("--help") || args.includes("-h");
  const runId = getArgValue(args, "--run-id") ?? "";
  const kind = getArgValue(args, "--kind") ?? "";
  const dbPath =
    getArgValue(args, "--db-path") ??
    (runId ? `.agentfs/${runId}/agentfs.db` : "");

  if (help || sub.length === 0 || runId.length === 0 || kind.length === 0) {
    printExecutorHelp();
    return;
  }

  const execKind = parseExecKind(kind);
  if (!execKind) {
    process.stderr.write(`executor_kind_invalid: ${kind}\n`);
    process.exitCode = 1;
    return;
  }

  const client = createClient(args);

  if (sub === "get") {
    const res = await client.agentfsExecutorConfigGet({
      dbPath,
      kind: execKind,
      runId,
    });
    if (res.error || !res.data) {
      printApiError(
        res.error ?? { code: "UNKNOWN_ERROR", message: "executor_get_failed" }
      );
      return;
    }
    process.stdout.write(`exists: ${res.data.exists}\n`);
    process.stdout.write(`valid: ${res.data.valid}\n`);
    process.stdout.write(`config: ${JSON.stringify(res.data.config)}\n`);
    return;
  }

  if (sub === "set") {
    const configRaw = getArgValue(args, "--config");
    const configFile = getArgValue(args, "--config-file");
    const payloadText = (() => {
      if (configRaw) {
        return configRaw;
      }
      if (configFile) {
        return "";
      }
      return "";
    })();

    let config: unknown;
    if (configFile) {
      const file = Bun.file(configFile);
      if (!(await file.exists())) {
        process.stderr.write(`config_file_not_found: ${configFile}\n`);
        process.exitCode = 1;
        return;
      }
      try {
        config = JSON.parse(await file.text());
      } catch (error) {
        process.stderr.write(
          `config_json_invalid: ${
            error instanceof Error ? error.message : String(error)
          }\n`
        );
        process.exitCode = 1;
        return;
      }
    } else {
      if (!payloadText) {
        process.stderr.write("config_required\n");
        process.exitCode = 1;
        return;
      }
      try {
        config = JSON.parse(payloadText);
      } catch (error) {
        process.stderr.write(
          `config_json_invalid: ${
            error instanceof Error ? error.message : String(error)
          }\n`
        );
        process.exitCode = 1;
        return;
      }
    }

    const res = await client.agentfsExecutorConfigSet({
      config,
      dbPath,
      runId,
    });
    if (res.error || !res.data) {
      printApiError(
        res.error ?? { code: "UNKNOWN_ERROR", message: "executor_set_failed" }
      );
      return;
    }
    process.stdout.write(`exists: ${res.data.exists}\n`);
    process.stdout.write(`config: ${JSON.stringify(res.data.config)}\n`);
    return;
  }

  if (sub === "status") {
    const res = await client.agentfsExecutorStatus({
      dbPath,
      kind: execKind,
      runId,
    });
    if (res.error || !res.data) {
      printApiError(
        res.error ?? {
          code: "UNKNOWN_ERROR",
          message: "executor_status_failed",
        }
      );
      return;
    }
    process.stdout.write(`${JSON.stringify(res.data)}\n`);
    return;
  }

  if (sub === "health") {
    const res = await client.agentfsExecutorHealth({
      dbPath,
      kind: execKind,
      runId,
    });
    if (res.error || !res.data) {
      printApiError(
        res.error ?? {
          code: "UNKNOWN_ERROR",
          message: "executor_health_failed",
        }
      );
      return;
    }
    process.stdout.write(`${JSON.stringify(res.data)}\n`);
    return;
  }

  printExecutorHelp();
}

export async function handleCognitiveCommand(args: string[]): Promise<void> {
  const sub = args[0] ?? "";
  const help = args.includes("--help") || args.includes("-h");

  if (help || sub.length === 0) {
    printCognitiveHelp();
    return;
  }

  if (sub === "events") {
    const streamId = getArgValue(args, "--stream-id") ?? "default";
    const limitRaw = getArgValue(args, "--limit");
    const limit =
      limitRaw && Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 50;

    const client = createClient(args);
    const res = await client.listCognitiveEvents(streamId, limit);
    if (res.error || !res.data) {
      printApiError(
        res.error ?? {
          code: "UNKNOWN_ERROR",
          message: "cognitive_events_failed",
        }
      );
      return;
    }

    for (const e of res.data.events) {
      process.stdout.write(
        `- ${e.kind} ${typeof e.ts === "number" ? new Date(e.ts).toISOString() : "null"} (${e.id})\n`
      );
    }
    return;
  }

  printCognitiveHelp();
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
      'alfred plan "<requirement>" [--workspace <path>] [--run-id <id>] [--base-url <url>]',
      "",
      "Generates a plan (init→schedule) and prints runId + waves.",
    ].join("\n")}\n`
  );
}

function printExecuteHelp(): void {
  process.stdout.write(
    `${[
      "alfred execute --run-id <id> [--dry-run] [--wave <waveId> ...] [--skip-task <taskId> ...] [--base-url <url>]",
      "",
      "Executes a run by runId (derives plan from snapshot).",
    ].join("\n")}\n`
  );
}

function printStatusHelp(): void {
  process.stdout.write(
    `${[
      "alfred status --run-id <id> [--base-url <url>]",
      "",
      "Shows phase status.",
    ].join("\n")}\n`
  );
}

function printCompilationHelp(): void {
  process.stdout.write(
    `${[
      "alfred work --run-id <id> [--base-url <url>]",
      "alfred compilation --run-id <id> [--base-url <url>]",
      "",
      "Prints the persisted work compilation for a workflow run.",
    ].join("\n")}\n`
  );
}

function printStepHelp(): void {
  process.stdout.write(
    `${[
      "alfred step --run-id <id> --until <stage> [--requirement <text>] [--workspace <path>] [--authz <toolJwt>] [--base-url <url>]",
      "",
      "Runs/resumes the pipeline until the requested stage boundary via HTTP.",
    ].join("\n")}\n`
  );
}

function printPrepareHelp(): void {
  process.stdout.write(
    `${[
      "alfred prepare --run-id <id> --authz <toolJwt> [--workspace <path>] [--base-url <url>]",
      "",
      "Initializes the run-scoped AgentFS container + DB via HTTP.",
    ].join("\n")}\n`
  );
}

function printExecutorHelp(): void {
  process.stdout.write(
    `${[
      "alfred executor <get|set|status|health> --run-id <id> --kind <codex|opencode|droid> [--db-path <path>] [--config <json>] [--config-file <path>] [--base-url <url>]",
      "",
      "Reads/writes executor config and checks executor status/health via HTTP.",
    ].join("\n")}\n`
  );
}

function printCognitiveHelp(): void {
  process.stdout.write(
    `${[
      "alfred cognitive events --stream-id <id> [--limit <n>] [--base-url <url>]",
      "",
      "Lists recent cognitive events for a stream via HTTP.",
    ].join("\n")}\n`
  );
}
