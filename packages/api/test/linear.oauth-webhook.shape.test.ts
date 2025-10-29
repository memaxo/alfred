import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it, mock, vi } from "bun:test";
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { webhookEventsTotal, webhookErrorsTotal } from "@alfred/api/metrics";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { mastraMock, resetAgentMocks } from "./utils/agent-mock";
import { createTestDb, closeTestDb } from "./utils/db";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../../db/.env") });

const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";
const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

const TEST_USER_ID = "linear-test-user";
const TEST_ORG_ID = "linear-org-1";

mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

let appRouter: typeof import("@alfred/api/routers/index").appRouter;
let linearRepo: typeof import("@alfred/db").linearRepo;
let originalFetch: typeof fetch;
let publishCalls: Array<any[]> = [];
let testDbHarness: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  const dbModule = await import("@alfred/db");
  linearRepo = dbModule.linearRepo;
  const { appRouter: router } = await import("@alfred/api/routers/index");
  appRouter = router;
  testDbHarness = await createTestDb();
});

async function resetLinearTables() {
  await testDbHarness.db.execute(sql`TRUNCATE linear_installations RESTART IDENTITY CASCADE`);
}

function createCaller() {
  const receivedAt = new Date();
  const runtime = {
    requestId: "test-request",
    receivedAt,
    method: "POST",
    url: "http://localhost/test",
    ip: null,
    forwardedFor: [] as string[],
    userAgent: null,
    referer: null,
  };
  const runtimeContext = new RuntimeContext([
    ["requestId", runtime.requestId],
    ["receivedAt", receivedAt.toISOString()],
    ["method", runtime.method],
    ["url", runtime.url],
    ["ip", runtime.ip],
    ["forwardedFor", runtime.forwardedFor],
    ["userId", TEST_USER_ID],
    ["userRoles", ["owner"]],
    ["userScopes", ["linear.read", "linear.write"]],
  ]);
  return appRouter.createCaller({
    session: {
      user: {
        id: TEST_USER_ID,
        roles: ["owner"],
        scopes: ["linear.read", "linear.write"],
      },
    },
    runtime,
    runtimeContext,
  } as any);
}

function installFetchMocks() {
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);

    if (url === LINEAR_TOKEN_URL) {
      return new Response(
        JSON.stringify({
          access_token: "linear-access-token",
          refresh_token: "linear-refresh-token",
          scope: "read write",
          expires_in: 3600,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    }

    if (url === LINEAR_GRAPHQL_URL) {
      return new Response(
        JSON.stringify({
          data: {
            viewer: {
              id: "linear-user-123",
              email: "user@example.com",
              displayName: "Linear User",
              organization: {
                id: TEST_ORG_ID,
                name: "Alfred",
              },
            },
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    }

    throw new Error(`unexpected fetch call to ${url} with ${JSON.stringify(init)}`);
  };
}

function restoreFetchMocks() {
  globalThis.fetch = originalFetch;
}

function resetMetrics() {
  webhookEventsTotal.reset();
  webhookErrorsTotal.reset();
}

function setLinearEnv() {
  process.env.LINEAR_CLIENT_ID = "client-id";
  process.env.LINEAR_CLIENT_SECRET = "client-secret";
  process.env.LINEAR_REDIRECT_URI = "https://example.com/callback";
  process.env.LINEAR_SCOPE = "read write";
  process.env.LINEAR_STATE_SECRET = "state-secret";
  process.env.LINEAR_WEBHOOK_SECRET = "webhook-secret";
}

beforeEach(async () => {
  setLinearEnv();
  resetMetrics();
  installFetchMocks();
  await resetLinearTables();
  publishCalls = [];
  mastraMock.pubsub.publish.mockImplementation(async (...args: any[]) => {
    publishCalls.push(args);
  });
});

afterEach(async () => {
  restoreFetchMocks();
  publishCalls = [];
  await resetLinearTables();
  resetAgentMocks();
});

afterAll(async () => {
  await closeTestDb(testDbHarness);
});

describe("linear OAuth router", () => {
  it("returns an authorize URL with signed state", async () => {
    const caller = createCaller();
    const response = await caller.linear.getAuthorizeUrl();

    expect(response.url).toContain("https://linear.app/oauth/authorize");
    expect(response.state).toBeDefined();
    expect(response.scope).toBe("read write");

    const stateParts = response.state.split(".");
    expect(stateParts.length).toBe(2);
  });

  it("exchanges code and persists installation", async () => {
    const caller = createCaller();
    const { state } = await caller.linear.getAuthorizeUrl();

    const result = await caller.linear.oauthCallback({
      code: "auth-code",
      state,
    });

    expect(result.ok).toBe(true);
    expect(result.workspace).toBe(TEST_ORG_ID);
    expect(result.user).toBe("linear-user-123");

    const installation = await linearRepo.getLinearInstallationByWorkspace(TEST_ORG_ID);
    expect(installation).not.toBeNull();
    expect(installation?.token).toBe("linear-access-token");
    expect(installation?.refresh).toBe("linear-refresh-token");
    expect(installation?.scope).toBe("read write");
  });
});

describe("linear webhook handler", () => {
  it("verifies signature and publishes agent activity", async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      type: "issue.created",
      data: {
        agentSessionId: "session-123",
      },
    };
    const body = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", process.env.LINEAR_WEBHOOK_SECRET ?? "")
      .update(`${timestamp}:${body}`)
      .digest("hex");

    const { Route: WebhookRoute } = await import("../../../apps/web/src/routes/api/linear/webhook.ts");
    const handler = WebhookRoute.options?.server?.handlers?.POST;
    expect(typeof handler).toBe("function");

    const response = await handler?.({
      request: new Request("http://localhost/api/linear/webhook", {
        method: "POST",
        headers: {
          "linear-signature": `t=${timestamp},v1=${signature}`,
          "content-type": "application/json",
        },
        body,
      }),
    });

    expect(response?.status).toBe(202);
    const responseJson = await response?.json();
    expect(responseJson).toEqual({ ok: true });

    const eventMetric = await webhookEventsTotal.get();
    expect(eventMetric.values[0]?.labels).toEqual({ type: "issue.created" });
    expect(eventMetric.values[0]?.value).toBe(1);

    const errorMetric = await webhookErrorsTotal.get();
    expect(errorMetric.values.length).toBe(0);

    expect(publishCalls.length).toBe(1);
    expect(publishCalls[0]?.[0]).toBe("linear.agent_activity");
    expect(publishCalls[0]?.[1]).toMatchObject({
      type: "issue.created",
      runId: "session-123",
    });
  });
});
