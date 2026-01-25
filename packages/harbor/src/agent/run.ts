import type { WorkflowEventType } from "@alfred/db/schema/workflow";
import type { PersistedWorkflowEvent } from "@alfred/runtime/trajectory/atif";
import type { RuntimeInput } from "@alfred/runtime/types";
import type { WorkflowEvent } from "@alfred/type/plan";

import { wrapEventEnvelope } from "@alfred/agent/utils/envelope";
import { eventToUiMessages } from "@alfred/agent/utils/normalize";
import { redactEventData } from "@alfred/agent/utils/redaction";
import { issueAccessToken } from "@alfred/auth/token";
import { runOrchestrator } from "@alfred/runtime/orchestrator";
import { buildAtifTrajectory } from "@alfred/runtime/trajectory/atif";
import { validateAtifTrajectory } from "@alfred/runtime/trajectory/validate";
import { makeEventId } from "@alfred/type/id";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface RunArgs {
  requirement: string;
  workspace: string;
  outTrajectory: string;
  auto: "read" | "low" | "medium" | "high";
  mode: "sequential" | "parallel";
}

function usage(): string {
  return [
    "Usage:",
    "  bun packages/harbor/src/agent/run.ts --requirement <text> --workspace <dir> --outTrajectory <path>",
    "",
    "Options:",
    "  --requirement <text>      Required. High-level instruction for ALFRED",
    "  --workspace <dir>         Required. Working directory inside container (usually /workspace)",
    "  --outTrajectory <path>    Required. Writes ATIF trajectory JSON to this path (usually /logs/verifier/trajectory.json)",
    "  --auto <band>             read|low|medium|high (default low)",
    "  --mode <mode>             sequential|parallel (default sequential)",
  ].join("\n");
}

function parseArgs(argv: string[]): RunArgs {
  const out: RunArgs = {
    requirement: "",
    workspace: "",
    outTrajectory: "",
    auto: "low",
    mode: "sequential",
  };

  for (let i = 0; i < argv.length; i += 1) {
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
      out.workspace = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (a === "--outTrajectory") {
      out.outTrajectory = argv[i + 1] ?? "";
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

  if (!(out.requirement && out.workspace && out.outTrajectory)) {
    throw new Error("missing_required_args");
  }

  return out;
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
  workflowEvents: { event: WorkflowEvent; createdAt: string }[];
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

async function ensureAgentfsImage(image: string): Promise<void> {
  const inspect = Bun.spawn(["docker", "image", "inspect", image], {
    cwd: "/alfred",
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  const inspectCode = await inspect.exited;
  if (inspectCode === 0) {
    return;
  }

  const build = Bun.spawn(
    ["docker", "build", "-f", "docker/agentfs/Dockerfile", "-t", image, "."],
    {
      cwd: "/alfred",
      stdin: "ignore",
      stdout: "inherit",
      stderr: "inherit",
    }
  );
  const buildCode = await build.exited;
  if (buildCode !== 0) {
    throw new Error(`agentfs_image_build_failed rc=${buildCode}`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  }

  const args = parseArgs(argv);
  const runId = randomUUID();

  // Ensure the nested AgentFS executor image exists on the Docker host.
  const agentfsImage = process.env.ORCH_DOCKER_IMAGE ?? "alfred-agentfs:codex";
  await ensureAgentfsImage(agentfsImage);
  process.env.ORCH_DOCKER_IMAGE = agentfsImage;

  // Harbor runs should not start the runtime MCP server by default.
  process.env.ORCH_MCP = process.env.ORCH_MCP ?? "0";

  // Ensure we can mint a tool token for this run (used by codex/docker tools).
  if (
    !(process.env.AGENT_ED25519_PRIVATE && process.env.AGENT_ED25519_PUBLIC_PEM)
  ) {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    process.env.AGENT_ED25519_PRIVATE = privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString();
    process.env.AGENT_ED25519_PUBLIC_PEM = publicKey
      .export({ format: "pem", type: "spki" })
      .toString();
  }

  const toolJwt = await issueAccessToken(
    "harbor",
    ["droid.exec", "repo.read", "repo.write", "deploy.read", "deploy.write"],
    undefined,
    { elevated: true, mfa: "passkey" }
  );
  const authz = `Bearer ${toolJwt}`;

  const input: RuntimeInput = {
    requirement: args.requirement,
    auto: args.auto,
    mode: args.mode,
    workspace: args.workspace,
    context: {
      enable: false,
    },
  };

  const workflowEvents: { event: WorkflowEvent; createdAt: string }[] = [];
  const abortController = new AbortController();

  let runError: unknown | null = null;
  try {
    for await (const event of runOrchestrator(
      input,
      runId,
      abortController.signal,
      undefined,
      undefined,
      undefined,
      authz,
      undefined,
      "harbor"
    )) {
      workflowEvents.push({ event, createdAt: new Date().toISOString() });
    }
  } catch (error) {
    runError = error;
  }

  const persisted = buildPersistedEvents({ runId, workflowEvents });
  const traj = buildAtifTrajectory({
    runId,
    requirement: args.requirement,
    events: persisted,
  });
  const v = validateAtifTrajectory(traj);
  if (!v.ok) {
    process.stderr.write(`${JSON.stringify(v.errors, null, 2)}\n`);
    process.exit(1);
  }

  await ensureParent(args.outTrajectory);
  await fs.writeFile(
    args.outTrajectory,
    `${JSON.stringify(traj, null, 2)}\n`,
    "utf8"
  );

  if (runError) {
    throw runError;
  }
}

if (import.meta.main) {
  main().catch((error) => {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`alfred_harbor_runner_failed: ${msg}\n`);
    if (msg === "missing_required_args") {
      process.stderr.write(`${usage()}\n`);
    }
    process.exit(1);
  });
}
