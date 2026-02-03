import { createTestSession, serializeTestSession } from "@alfred/test-kit/auth";
import { READ_SCOPES } from "@alfred/type";
import { describe, expect, it } from "bun:test";
import { Buffer } from "node:buffer";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import path from "node:path";

import {
  cleanupTestDir,
  createRepoTestDir,
  isDockerAvailable,
  isImageAvailable,
  runCmd,
} from "../../../agent/test/utils/infra";

const IMAGE = "alfred-agentfs:codex";

function encodeTestSessionHeader(payload: string): string {
  return Buffer.from(payload, "utf8").toString("base64");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapTrpc<T>(raw: unknown): T {
  if (Array.isArray(raw)) {
    const first = raw[0];
    return unwrapTrpc(first) as T;
  }
  if (isRecord(raw) && isRecord(raw.result)) {
    const { data } = raw.result as Record<string, unknown>;
    if (isRecord(data) && "json" in data) {
      return (data as { json: T }).json;
    }
    return data as T;
  }
  return raw as T;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `http_${res.status} ${res.statusText} ${url} :: ${text.slice(0, 5000)}`
    );
  }
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`non_json_response ${url} :: ${text.slice(0, 5000)}`);
  }
}

async function trpcQuery<T>(args: {
  baseUrl: string;
  path: string;
  input: unknown;
  headers: Headers;
}): Promise<T> {
  const url = `${args.baseUrl}/api/trpc/${args.path}?input=${encodeURIComponent(
    JSON.stringify(args.input)
  )}`;
  const raw = await fetchJson(url, { headers: args.headers });
  return unwrapTrpc<T>(raw);
}

async function trpcMutation<T>(args: {
  baseUrl: string;
  path: string;
  input: unknown;
  headers: Headers;
}): Promise<T> {
  const url = `${args.baseUrl}/api/trpc/${args.path}`;
  const raw = await fetchJson(url, {
    body: JSON.stringify(args.input),
    headers: args.headers,
    method: "POST",
  });
  return unwrapTrpc<T>(raw);
}

function hasProviderKey(): boolean {
  return Boolean(
    (process.env.CODEX_API_KEY && process.env.CODEX_API_KEY.length > 0) ||
    (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 0)
  );
}

describe("HTTP + Docker (opt-in) — schedule → prepare → execute", () => {
  const runOptIn = process.env.RUN_HTTP_DOCKER_TESTS === "1";
  const dockerOk = runOptIn ? isDockerAvailable() : false;
  const imageOk = runOptIn && dockerOk ? isImageAvailable(IMAGE) : false;
  const providerOk = runOptIn ? hasProviderKey() : false;

  it.skipIf(!(runOptIn && dockerOk && imageOk && providerOk))(
    "steps a workflow via HTTP and observes AgentFS + cognitive artifacts",
    async () => {
      const restoreEnvKeys = [
        "AGENT_ED25519_PRIVATE",
        "AGENT_ED25519_PUBLIC_PEM",
        "DATABASE_URL",
        "DISABLE_METRICS_HOOKS",
        "DISABLE_TRPC_METRICS",
        "TEST_MODE",
        "VITE_TEST_MODE",
      ] as const;
      const originalEnv = Object.fromEntries(
        restoreEnvKeys.map((k) => [k, process.env[k]])
      ) as Record<string, string | undefined>;
      const originalCwd = process.cwd();

      let server: {
        stop: (closeConnections?: boolean) => void;
        port: number;
      } | null = null;
      let workspaceDir: string | null = null;
      let containerName: string | null = null;

      try {
        // Ensure HTTP test-session bypass is enabled.
        process.env.TEST_MODE = "1";
        process.env.VITE_TEST_MODE = "true";
        process.env.DISABLE_TRPC_METRICS = "1";
        process.env.DISABLE_METRICS_HOOKS = "1";
        process.env.DATABASE_URL = "sqlite::memory:";

        // Create a minimal, isolated workspace under the repo allow-prefix.
        workspaceDir = createRepoTestDir("http-docker-phase");
        await Bun.write(path.join(workspaceDir, "README.md"), "seed\n");
        process.chdir(workspaceDir);

        // Generate ephemeral tool-token signing keys for this test process.
        const { privateKey, publicKey } = generateKeyPairSync("ed25519");
        process.env.AGENT_ED25519_PRIVATE = privateKey
          .export({ format: "pem", type: "pkcs8" })
          .toString();
        process.env.AGENT_ED25519_PUBLIC_PEM = publicKey
          .export({ format: "pem", type: "spki" })
          .toString();

        const [
          { fetchRequestHandler },
          { appRouter },
          { createContext },
          { issueAccessToken },
          { structuredPlanSchema },
        ] = await Promise.all([
          import("@trpc/server/adapters/fetch"),
          import("../../src/routers"),
          import("../../src/context"),
          import("@alfred/auth/token"),
          import("@alfred/plan/schema"),
        ]);

        const userId = "http-docker-test-user";
        const runId = randomUUID();

        const session = createTestSession({
          id: userId,
          email: "http-docker-test-user@test.local",
          name: "HTTP Docker Test User",
          roles: ["owner"],
          scopes: [READ_SCOPES.AGENTFS],
        });

        const sessionHeader = encodeTestSessionHeader(
          serializeTestSession(session)
        );
        const headers = new Headers();
        headers.set("content-type", "application/json");
        headers.set("x-alfred-test-session", sessionHeader);

        const toolJwt = await issueAccessToken(
          userId,
          ["droid.exec", "deploy.write", "repo.read", "repo.write", "git.read"],
          process.env.TOOL_AUDIENCE ?? "alfred:tools",
          {
            elevated: true,
            mfa: "passkey",
            roles: ["owner"],
            ttlSec: 900,
          }
        );
        const authz = `Bearer ${toolJwt}`;

        server = Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          fetch: (req: Request) => {
            const url = new URL(req.url);
            if (url.pathname.startsWith("/api/trpc")) {
              return fetchRequestHandler({
                endpoint: "/api/trpc",
                req,
                router: appRouter,
                createContext: () => createContext({ req }),
              });
            }
            return new Response("Not Found", { status: 404 });
          },
        });

        const baseUrl = `http://127.0.0.1:${server.port}`;
        const requirement =
          'Create a file "hello.txt" at the workspace root containing exactly: hello.';

        // 1) schedule (init → context → plan → schedule)
        const scheduled = await trpcMutation<{
          runId: string;
          untilStage: string;
          lastCompletedStage: string | null;
          nextStage: string | null;
        }>({
          baseUrl,
          path: "workflow.phase.step",
          headers,
          input: {
            authz,
            requirement,
            runId,
            untilStage: "schedule",
            workspace: workspaceDir,
          },
        });
        expect(scheduled.runId).toBe(runId);
        expect(scheduled.untilStage).toBe("schedule");
        expect(scheduled.lastCompletedStage).toBe("schedule");

        // 2) Reduce the plan to a single task to keep execution bounded.
        const plan = await trpcQuery<{
          runId: string;
          rootPlanPath: string;
          structuredPlan: unknown;
          subtasks: { id: string }[];
          waves: { id: string; agents: string[] }[];
        }>({
          baseUrl,
          path: "workflow.phase.getPlan",
          headers,
          input: { runId },
        });
        expect(plan.runId).toBe(runId);
        expect(plan.rootPlanPath.length).toBeGreaterThan(0);
        expect(await Bun.file(plan.rootPlanPath).exists()).toBe(true);

        const parsed = structuredPlanSchema.parse(plan.structuredPlan);
        const firstPhase = parsed.phases[0];
        if (!firstPhase) {
          throw new Error("structured_plan_missing_phase");
        }
        const firstTask = firstPhase.tasks[0];
        if (!firstTask) {
          throw new Error("structured_plan_missing_task");
        }

        const trimmedPlan = {
          ...parsed,
          phases: [
            {
              ...firstPhase,
              tasks: [firstTask],
              dependsOn: [],
            },
          ],
          resources: {
            ...parsed.resources,
            agentCount: 1,
            strategy: "sequential",
          },
        };

        const updated = await trpcMutation<{
          waveCount: number;
          waves: { id: string; agents: string[] }[];
        }>({
          baseUrl,
          path: "workflow.phase.updatePlan",
          headers,
          input: {
            runId,
            structuredPlan: trimmedPlan,
          },
        });
        expect(updated.waveCount).toBe(1);
        expect(updated.waves[0]?.agents.length).toBe(1);

        // 3) Prepare AgentFS (real Docker container + DB)
        const prepared = await trpcMutation<{
          runId: string;
          workspace: string;
          dbPath: string;
          containerName: string;
        }>({
          baseUrl,
          path: "workflow.phase.prepare",
          headers,
          input: {
            authz,
            runId,
            workspace: workspaceDir,
          },
        });
        ({ containerName } = prepared);
        expect(prepared.runId).toBe(runId);
        expect(prepared.dbPath.length).toBeGreaterThan(0);
        expect(prepared.containerName.startsWith("alfred-agentfs-")).toBe(true);

        const preSnap = await trpcQuery<{
          runId: string;
          dbPath: string;
          entries: { name: string }[];
        }>({
          baseUrl,
          path: "agentfs.snapshot",
          headers,
          input: {
            dbPath: prepared.dbPath,
            dir: "/workspace",
            runId,
          },
        });
        expect(preSnap.runId).toBe(runId);
        expect(preSnap.entries.some((e) => e.name === "README.md")).toBe(true);

        // 4) Execute (schedule → execute). This must run real AgentFS executors.
        const executed = await trpcMutation<{
          runId: string;
          untilStage: string;
          lastCompletedStage: string | null;
          outputSummary: Record<string, unknown>;
        }>({
          baseUrl,
          path: "workflow.phase.step",
          headers,
          input: {
            authz,
            runId,
            untilStage: "execute",
          },
        });
        expect(executed.runId).toBe(runId);
        expect(executed.untilStage).toBe("execute");
        expect(executed.lastCompletedStage).toBe("execute");

        const summary = executed.outputSummary;
        expect(summary.dryRun).toBe(false);
        expect(typeof summary.fileChangeCount).toBe("number");
        expect((summary.fileChangeCount as number) >= 1).toBe(true);

        const postSnap = await trpcQuery<{
          entries: { name: string }[];
          toolCalls: unknown[];
        }>({
          baseUrl,
          path: "agentfs.snapshot",
          headers,
          input: {
            dbPath: prepared.dbPath,
            dir: "/workspace",
            runId,
          },
        });
        expect(postSnap.entries.some((e) => e.name === "hello.txt")).toBe(true);
        expect(postSnap.toolCalls.length).toBeGreaterThan(0);

        const cogState = await trpcQuery<{
          autonomy: number;
          phase: string;
        }>({
          baseUrl,
          path: "cognitive.state",
          headers,
          input: {
            streamId: runId,
          },
        });
        expect(typeof cogState.autonomy).toBe("number");
        expect(cogState.phase.length).toBeGreaterThan(0);

        const cogEvents = await trpcQuery<{
          events: { kind: string }[];
        }>({
          baseUrl,
          path: "cognitive.eventsList",
          headers,
          input: {
            limit: 50,
            streamId: runId,
          },
        });
        expect(cogEvents.events.some((e) => e.kind === "input")).toBe(true);
      } finally {
        try {
          if (server) {
            server.stop(true);
          }
        } catch {
          // ignore
        }

        try {
          if (containerName) {
            runCmd(["docker", "rm", "-f", containerName]);
          }
        } catch {
          // ignore
        }

        try {
          process.chdir(originalCwd);
        } catch {
          // ignore
        }

        try {
          if (workspaceDir) {
            cleanupTestDir(workspaceDir);
          }
        } catch {
          // ignore
        }

        for (const key of restoreEnvKeys) {
          const prev = originalEnv[key];
          if (typeof prev === "string") {
            process.env[key] = prev;
          } else {
            delete process.env[key];
          }
        }
      }
    },
    10 * 60 * 1000
  );
});
