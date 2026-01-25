#!/usr/bin/env bun

import type { AppRouter } from "@alfred/api/routers/index";

import {
  createTRPCClient,
  httpBatchLink,
  splitLink,
  unstable_httpSubscriptionLink,
} from "@trpc/client";
import { Buffer } from "node:buffer";

interface Args {
  baseUrl: string;
  concurrency: number;
  requests: number;
  auto: "read" | "low" | "medium" | "high";
  projectId?: string;
  requirePrefix: string;
  cookie?: string;
  testUserId: string;
  testScopes: string[];
  timeoutMs: number;
  streamTimeoutMs: number;
  verifyPersisted: boolean;
}

type StreamOutcome = "completed" | "failed" | "suspended";

interface StreamMetrics {
  outcome: StreamOutcome;
  runId: string | null;
  timeToFirstMs: number | null;
  timeToCompleteMs: number | null;
  eventCounts: Record<string, number>;
  error?: string;
}

interface RunResult {
  ok: number;
  failed: number;
  timeToFirstMs: number[];
  timeToCompleteMs: number[];
  eventCounts: Record<string, number>;
  errors: string[];
  durationMs: number;
}

function parseIntArg(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseListArg(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function parseAuto(value: string | undefined): Args["auto"] {
  switch (value) {
    case "read":
    case "low":
    case "medium":
    case "high": {
      return value;
    }
    default: {
      return "low";
    }
  }
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return value === "1" || value.toLowerCase() === "true";
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    if (idx === -1) {
      return;
    }
    return argv[idx + 1];
  };

  const baseUrl =
    get("--base-url") ??
    process.env.ALFRED_LOADTEST_BASE_URL ??
    "http://localhost:3000";

  const concurrency = parseIntArg(
    get("--concurrency") ?? process.env.ALFRED_LOADTEST_CONCURRENCY,
    10
  );
  const requests = parseIntArg(
    get("--requests") ?? process.env.ALFRED_LOADTEST_REQUESTS,
    50
  );
  const timeoutMs = parseIntArg(
    get("--timeout-ms") ?? process.env.ALFRED_LOADTEST_TIMEOUT_MS,
    180_000
  );
  const streamTimeoutMs = parseIntArg(
    get("--stream-timeout-ms") ?? process.env.ALFRED_LOADTEST_STREAM_TIMEOUT_MS,
    120_000
  );

  const cookie = get("--cookie") ?? process.env.ALFRED_LOADTEST_COOKIE;

  const testUserId =
    get("--test-user-id") ??
    process.env.ALFRED_LOADTEST_TEST_USER_ID ??
    "loadtest-user";
  const testScopes = parseListArg(
    get("--test-scopes") ??
      process.env.ALFRED_LOADTEST_TEST_SCOPES ??
      "workflow.plan,workflow.stream,workflow.resume,workflow.read"
  );

  const verifyPersisted = parseBoolean(
    get("--verify-persisted") ?? process.env.ALFRED_LOADTEST_VERIFY_PERSISTED
  );

  return {
    baseUrl,
    concurrency: Math.max(1, concurrency),
    requests: Math.max(1, requests),
    timeoutMs: Math.max(1000, timeoutMs),
    streamTimeoutMs: Math.max(1000, streamTimeoutMs),
    auto: parseAuto(get("--auto") ?? process.env.ALFRED_LOADTEST_AUTO),
    projectId: get("--project-id") ?? process.env.ALFRED_LOADTEST_PROJECT_ID,
    requirePrefix:
      get("--require-prefix") ??
      process.env.ALFRED_LOADTEST_REQUIRE_PREFIX ??
      "loadtest",
    cookie,
    testUserId,
    testScopes,
    verifyPersisted,
  };
}

function usage(): string {
  return [
    "ALFRED load test: workflow.streamPipeline",
    "",
    "Prereqs (dev-only auth bypass):",
    "- Start the web server with TEST_MODE=1 (or VITE_TEST_MODE=1).",
    "  Example: TEST_MODE=1 bun run dev:web",
    "",
    "Usage:",
    "  bun scripts/load-workflow-stream.ts --base-url http://localhost:3000 --concurrency 10 --requests 25",
    "",
    "Options:",
    "  --base-url           Base URL (default: http://localhost:3000)",
    "  --concurrency        Concurrent in-flight streams (default: 10)",
    "  --requests           Total workflow.streamPipeline runs (default: 50)",
    "  --timeout-ms         Hard process timeout (default: 180000)",
    "  --stream-timeout-ms  Per-run stream timeout (default: 120000)",
    "  --auto               read|low|medium|high (default: low)",
    "  --project-id         Optional projectId",
    "  --require-prefix     Requirement prefix (default: loadtest)",
    "  --verify-persisted   true|false (default: false)",
    "",
    "Auth:",
    "  --cookie             Use real auth cookie instead of test session header",
    "  --test-user-id       Test user id (default: loadtest-user)",
    "  --test-scopes        Comma list (default: workflow.plan,workflow.stream,workflow.resume,workflow.read)",
  ].join("\n");
}

function makeTestSessionHeader(args: {
  userId: string;
  scopes: string[];
}): string {
  const now = new Date().toISOString();
  const payload = {
    user: {
      id: args.userId,
      email: `${args.userId}@test.local`,
      name: "Load Test",
      roles: ["owner"],
      scopes: args.scopes,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    },
    session: {
      id: `sess-${args.userId}`,
      userId: args.userId,
      token: `token-${args.userId}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: "alfred-loadtest",
    },
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const v of values) {
    sum += v;
  }
  return sum / values.length;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(p * (sorted.length - 1)))
  );
  return sorted[idx] ?? 0;
}

function mergeCounts(
  target: Record<string, number>,
  source: Record<string, number>
) {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function createClient(baseUrl: string, headers: () => Record<string, string>) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/trpc`;
  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (op) => op.type === "subscription",
        true: unstable_httpSubscriptionLink({
          url,
          headers,
        }),
        false: httpBatchLink({
          url,
          headers,
        }),
      }),
    ],
  });
}

function runStream(
  client: ReturnType<typeof createClient>,
  input: {
    requirement: string;
    auto: Args["auto"];
    projectId?: string;
    runId?: string;
  },
  timeoutMs: number,
  verifyPersisted: boolean
): Promise<StreamMetrics> {
  const startedAt = performance.now();
  let firstEventAt: number | null = null;
  let completedAt: number | null = null;
  const eventCounts: Record<string, number> = {};
  let resolved = false;
  let runId: string | null = input.runId ?? null;

  return new Promise<StreamMetrics>((resolve) => {
    const finalize = async (
      outcome: StreamOutcome,
      error?: string
    ): Promise<void> => {
      if (resolved) {
        return;
      }
      resolved = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      if (subscription) {
        subscription.unsubscribe();
      }
      const timeToFirstMs = firstEventAt ? firstEventAt - startedAt : null;
      const timeToCompleteMs = completedAt ? completedAt - startedAt : null;
      let persistedError: string | undefined;
      if (verifyPersisted && runId) {
        try {
          const events = await client.workflow.events.query({ runId });
          if (!Array.isArray(events) || events.length === 0) {
            persistedError = "persisted_events_missing";
          }
        } catch (error) {
          persistedError =
            error instanceof Error
              ? error.message
              : String(error ?? "unknown_error");
        }
      }
      resolve({
        outcome: persistedError ? "failed" : outcome,
        runId,
        timeToFirstMs,
        timeToCompleteMs,
        eventCounts,
        error: persistedError ?? error,
      });
    };

    const timeout = setTimeout(() => {
      void finalize("failed", "stream_timeout");
    }, timeoutMs);

    const subscription = client.workflow.streamPipeline.subscribe(
      {
        requirement: input.requirement,
        auto: input.auto,
        projectId: input.projectId,
        runId: input.runId,
      },
      {
        onData: (event) => {
          const now = performance.now();
          if (!firstEventAt) {
            firstEventAt = now;
          }
          const eventType =
            event && typeof event === "object" && "type" in event
              ? String((event as { type?: unknown }).type)
              : "unknown";
          eventCounts[eventType] = (eventCounts[eventType] ?? 0) + 1;
          if (
            !runId &&
            event &&
            typeof event === "object" &&
            "runId" in event
          ) {
            const id = (event as { runId?: unknown }).runId;
            if (typeof id === "string") {
              runId = id;
            }
          }
          if (eventType === "pipeline:complete") {
            completedAt = now;
            void finalize("completed");
          }
          if (eventType === "pipeline:suspend") {
            completedAt = now;
            void finalize("suspended");
          }
          if (eventType === "pipeline:failed") {
            completedAt = now;
            const message =
              typeof (event as { error?: unknown }).error === "string"
                ? (event as { error?: string }).error
                : "stream_error";
            void finalize("failed", message);
          }
        },
        onError: (err) => {
          completedAt = performance.now();
          void finalize(
            "failed",
            err instanceof Error ? err.message : String(err ?? "unknown_error")
          );
        },
        onComplete: () => {
          completedAt = performance.now();
          void finalize("completed");
        },
      }
    );
  });
}

async function runLoadTest(args: Args): Promise<RunResult> {
  const testSessionHeader = makeTestSessionHeader({
    userId: args.testUserId,
    scopes: args.testScopes,
  });

  const headersForRequest = () => {
    const out: Record<string, string> = {};
    if (args.cookie) {
      out.cookie = args.cookie;
      return out;
    }
    out["x-alfred-test-session"] = testSessionHeader;
    return out;
  };

  const client = createClient(args.baseUrl, headersForRequest);

  const startedAt = performance.now();
  const runErrors: string[] = [];

  let next = 0;
  const timeToFirstMs: number[] = [];
  const timeToCompleteMs: number[] = [];
  const eventCounts: Record<string, number> = {};
  let ok = 0;
  let failed = 0;

  const worker = async () => {
    while (true) {
      const idx = next;
      if (idx >= args.requests) {
        break;
      }
      next += 1;

      const requirement = `${args.requirePrefix} #${idx}`;
      const runId = crypto.randomUUID();

      const streamResult = await runStream(
        client,
        {
          requirement,
          auto: args.auto,
          projectId: args.projectId,
          runId,
        },
        args.streamTimeoutMs,
        args.verifyPersisted
      );

      if (streamResult.timeToFirstMs !== null) {
        timeToFirstMs.push(streamResult.timeToFirstMs);
      }
      if (streamResult.timeToCompleteMs !== null) {
        timeToCompleteMs.push(streamResult.timeToCompleteMs);
      }
      mergeCounts(eventCounts, streamResult.eventCounts);

      if (streamResult.outcome === "completed") {
        ok += 1;
      } else {
        failed += 1;
        if (streamResult.error && runErrors.length < 25) {
          runErrors.push(streamResult.error);
        }
      }
    }
  };

  await Promise.all(Array.from({ length: args.concurrency }, () => worker()));

  const durationMs = performance.now() - startedAt;

  return {
    ok,
    failed,
    timeToFirstMs,
    timeToCompleteMs,
    eventCounts,
    errors: runErrors,
    durationMs,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    return;
  }

  const args = parseArgs(argv);
  const timeout = setTimeout(() => {
    console.error(
      `\n[FATAL] load test timed out after ${args.timeoutMs}ms (increase --timeout-ms)`
    );
    setTimeout(() => process.exit(124), 10);
  }, args.timeoutMs);
  timeout.unref?.();

  const result = await runLoadTest(args).finally(() => clearTimeout(timeout));

  const total = result.ok + result.failed;
  const seconds = result.durationMs / 1000;
  const rps = seconds > 0 ? total / seconds : 0;
  const firstAvg = mean(result.timeToFirstMs);
  const firstP50 = percentile(result.timeToFirstMs, 0.5);
  const firstP95 = percentile(result.timeToFirstMs, 0.95);
  const firstP99 = percentile(result.timeToFirstMs, 0.99);
  const completeAvg = mean(result.timeToCompleteMs);
  const completeP50 = percentile(result.timeToCompleteMs, 0.5);
  const completeP95 = percentile(result.timeToCompleteMs, 0.95);
  const completeP99 = percentile(result.timeToCompleteMs, 0.99);

  console.log("");
  console.log("workflow.streamPipeline load test results");
  console.log(`- baseUrl: ${args.baseUrl}`);
  console.log(`- concurrency: ${args.concurrency}`);
  console.log(`- requests: ${args.requests}`);
  console.log(`- auto: ${args.auto}`);
  console.log(`- verifyPersisted: ${args.verifyPersisted}`);
  console.log(`- ok: ${result.ok}`);
  console.log(`- failed: ${result.failed}`);
  console.log(`- durationMs: ${Math.round(result.durationMs)}`);
  console.log(`- rps: ${rps.toFixed(2)}`);
  console.log(
    `- timeToFirstMs: avg=${firstAvg.toFixed(1)} p50=${firstP50.toFixed(
      1
    )} p95=${firstP95.toFixed(1)} p99=${firstP99.toFixed(1)}`
  );
  console.log(
    `- timeToCompleteMs: avg=${completeAvg.toFixed(1)} p50=${completeP50.toFixed(
      1
    )} p95=${completeP95.toFixed(1)} p99=${completeP99.toFixed(1)}`
  );

  const eventTypes = Object.keys(result.eventCounts).sort();
  if (eventTypes.length > 0) {
    console.log("");
    console.log("event counts:");
    for (const type of eventTypes) {
      console.log(`- ${type}: ${result.eventCounts[type]}`);
    }
  }

  if (result.errors.length > 0) {
    console.log("");
    console.log("sample errors (first 25):");
    for (const e of result.errors) {
      console.log(`- ${e}`);
    }
  }

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  void main();
}
