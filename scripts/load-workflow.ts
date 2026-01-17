#!/usr/bin/env bun

import { Buffer } from "node:buffer";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@alfred/api/routers/index";

type Args = {
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
};

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
    case "high":
      return value;
    default:
      return "low";
  }
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
    100
  );
  const timeoutMs = parseIntArg(
    get("--timeout-ms") ?? process.env.ALFRED_LOADTEST_TIMEOUT_MS,
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

  return {
    baseUrl,
    concurrency: Math.max(1, concurrency),
    requests: Math.max(1, requests),
    timeoutMs: Math.max(1_000, timeoutMs),
    auto: parseAuto(get("--auto") ?? process.env.ALFRED_LOADTEST_AUTO),
    projectId: get("--project-id") ?? process.env.ALFRED_LOADTEST_PROJECT_ID,
    requirePrefix:
      get("--require-prefix") ??
      process.env.ALFRED_LOADTEST_REQUIRE_PREFIX ??
      "loadtest",
    cookie,
    testUserId,
    testScopes,
  };
}

function usage(): string {
  return [
    "ALFRED load test: workflow.start",
    "",
    "Prereqs (dev-only auth bypass):",
    "- Start the web server with TEST_MODE=1 (or VITE_TEST_MODE=1).",
    "  Example: TEST_MODE=1 bun run dev:web",
    "",
    "Usage:",
    "  bun scripts/load-workflow.ts --base-url http://localhost:3000 --concurrency 25 --requests 200",
    "",
    "Options:",
    "  --base-url        Base URL (default: http://localhost:3000)",
    "  --concurrency     Concurrent in-flight mutations (default: 10)",
    "  --requests        Total workflow.start calls (default: 100)",
    "  --timeout-ms      Hard process timeout (default: 120000)",
    "  --auto            read|low|medium|high (default: low)",
    "  --project-id      Optional projectId",
    "  --require-prefix  Requirement prefix (default: loadtest)",
    "",
    "Auth:",
    "  --cookie          Use real auth cookie instead of test session header",
    "  --test-user-id    Test user id (default: loadtest-user)",
    "  --test-scopes     Comma list (default: workflow.plan,workflow.stream,workflow.resume,workflow.read)",
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

type RunResult = {
  ok: number;
  failed: number;
  latenciesMs: number[];
  errors: string[];
  durationMs: number;
};

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

  const client = createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${args.baseUrl.replace(/\/$/, "")}/api/trpc`,
        headers: headersForRequest,
      }),
    ],
  });

  const startedAt = performance.now();
  const runErrors: string[] = [];

  let next = 0;
  const latenciesByWorker: number[][] = Array.from(
    { length: args.concurrency },
    () => []
  );
  let ok = 0;
  let failed = 0;

  const worker = async (workerId: number) => {
    const bucket = latenciesByWorker[workerId] ?? [];
    while (true) {
      const idx = next;
      if (idx >= args.requests) {
        break;
      }
      next += 1;

      const requirement = `${args.requirePrefix} #${idx}`;
      const start = performance.now();
      try {
        await client.workflow.start.mutate({
          requirement,
          auto: args.auto,
          projectId: args.projectId,
        });
        ok += 1;
      } catch (error) {
        failed += 1;
        const msg =
          error instanceof Error ? error.message : `unknown_error:${String(error)}`;
        if (runErrors.length < 25) {
          runErrors.push(msg);
        }
      } finally {
        bucket.push(performance.now() - start);
      }
    }
  };

  await Promise.all(
    Array.from({ length: args.concurrency }, (_, i) => worker(i))
  );

  const durationMs = performance.now() - startedAt;
  const latenciesMs = latenciesByWorker.flat();

  return { ok, failed, latenciesMs, errors: runErrors, durationMs };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    return;
  }

  const args = parseArgs(argv);
  const timeout = setTimeout(() => {
    // eslint-disable-next-line no-console
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
  const avg = mean(result.latenciesMs);
  const p50 = percentile(result.latenciesMs, 0.5);
  const p95 = percentile(result.latenciesMs, 0.95);
  const p99 = percentile(result.latenciesMs, 0.99);
  const max = percentile(result.latenciesMs, 1);

  console.log("");
  console.log("workflow.start load test results");
  console.log(`- baseUrl: ${args.baseUrl}`);
  console.log(`- concurrency: ${args.concurrency}`);
  console.log(`- requests: ${args.requests}`);
  console.log(`- auto: ${args.auto}`);
  console.log(`- ok: ${result.ok}`);
  console.log(`- failed: ${result.failed}`);
  console.log(`- durationMs: ${Math.round(result.durationMs)}`);
  console.log(`- rps: ${rps.toFixed(2)}`);
  console.log(
    `- latencyMs: avg=${avg.toFixed(1)} p50=${p50.toFixed(1)} p95=${p95.toFixed(
      1
    )} p99=${p99.toFixed(1)} max=${max.toFixed(1)}`
  );

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

