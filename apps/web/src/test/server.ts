import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { RuntimeContext } from "@alfred/type/runtime-context";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { randomUUID } from "node:crypto";

import type { Context } from "../../../../packages/api/src/context";

import {
  closeTestDb,
  createTestDb,
  truncateTables,
} from "../../../../packages/api/test/utils/db";
import { uiTestAppRouter } from "./app-router";
import {
  createTestSession,
  deserializeTestSession,
  TEST_SESSION_HEADER,
  type TestSession,
} from "./auth";

type BunServer = ReturnType<typeof Bun.serve>;

interface InternalServer {
  instance: BunServer;
  dbClient: Awaited<ReturnType<typeof createTestDb>>;
  currentSession: TestSession;
  api: TestServer;
}

let internalServer: InternalServer | null = null;

export interface TestServer {
  url: string;
  port: number;
  db: NodePgDatabase;
  getSession(): TestSession;
  setSession(next: TestSession): void;
  reset(): Promise<void>;
  stop(): Promise<void>;
}

interface CreateServerOptions {
  session?: TestSession;
}

function buildContext(req: Request, session: TestSession | null): Context {
  const url = new URL(req.url);
  const runtime: Context["runtime"] = {
    requestId: randomUUID(),
    receivedAt: new Date(),
    method: req.method,
    url: url.toString(),
    ip: "127.0.0.1",
    forwardedFor: [],
    userAgent: "test-harness",
    referer: null,
  };

  const runtimeContext = new RuntimeContext([
    ["requestId", runtime.requestId],
    ["receivedAt", runtime.receivedAt.toISOString()],
    ["method", runtime.method],
    ["url", runtime.url],
    ["ip", runtime.ip],
    ["scanContext", null],
  ]);

  if (runtime.userAgent) {
    runtimeContext.set("userAgent", runtime.userAgent);
  }

  return {
    session: (session ?? null) as Context["session"],
    runtime,
    runtimeContext,
    policy: { obligations: [] },
  };
}

function resolveSession(
  req: Request,
  fallback: TestSession
): TestSession | null {
  const headerValue = req.headers.get(TEST_SESSION_HEADER);
  return deserializeTestSession(headerValue) ?? fallback;
}

async function safeReset(db: NodePgDatabase) {
  try {
    await truncateTables(db);
  } catch {}
}

async function ensureInternalServer(
  options: CreateServerOptions
): Promise<InternalServer> {
  if (internalServer) {
    if (options.session) {
      internalServer.currentSession = options.session;
      internalServer.api.setSession(options.session);
    }
    await safeReset(internalServer.dbClient.db);
    return internalServer;
  }

  const dbClient = await createTestDb();
  await safeReset(dbClient.db);
  let sessionRef = options.session ?? createTestSession();

  const instance = Bun.serve({
    port: 0,
    fetch: (req) => {
      const url = new URL(req.url);
      if (!url.pathname.startsWith("/api/trpc")) {
        return new Response("Not Found", { status: 404 });
      }

      return fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: uiTestAppRouter,
        createContext: () => buildContext(req, resolveSession(req, sessionRef)),
      });
    },
  });

  const api: TestServer = {
    url: `http://127.0.0.1:${instance.port ?? 0}`,
    port: instance.port ?? 0,
    db: dbClient.db,
    getSession() {
      return sessionRef;
    },
    setSession(next: TestSession) {
      sessionRef = next;
      if (internalServer) {
        internalServer.currentSession = next;
      }
    },
    async reset() {
      await safeReset(dbClient.db);
    },
    async stop() {
      if (!internalServer) {
        return;
      }
      instance.stop();
      await closeTestDb(dbClient);
      internalServer = null;
    },
  };

  internalServer = {
    instance,
    dbClient,
    currentSession: sessionRef,
    api,
  };
  return internalServer;
}

export async function createTestServer(
  options: CreateServerOptions = {}
): Promise<TestServer> {
  const server = await ensureInternalServer(options);
  return server.api;
}

export async function cleanupTestServer(server?: TestServer): Promise<void> {
  if (server) {
    await server.stop();
    return;
  }
  if (internalServer) {
    internalServer.instance.stop();
    await closeTestDb(internalServer.dbClient);
    internalServer = null;
  }
}

export async function withTestServer<T>(
  fn: (server: TestServer) => Promise<T>,
  options: CreateServerOptions = {}
): Promise<T> {
  const server = await createTestServer(options);
  try {
    await server.reset();
    return await fn(server);
  } finally {
    await cleanupTestServer(server);
  }
}
