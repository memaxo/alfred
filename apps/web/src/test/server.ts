import { randomUUID } from "node:crypto";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { appRouter } from "@alfred/api/routers";
import type { Context } from "@alfred/api/context";
import {
  createTestDb,
  closeTestDb,
  truncateTables,
} from "../../../packages/api/test/utils/db";
import {
  createTestSession,
  deserializeTestSession,
  TEST_SESSION_HEADER,
  type TestSession,
} from "./auth";

type BunServer = ReturnType<typeof Bun.serve>;

type InternalServer = {
  instance: BunServer;
  dbClient: Awaited<ReturnType<typeof createTestDb>>;
  currentSession: TestSession;
  api: TestServer;
};

let internalServer: InternalServer | null = null;

export type TestServer = {
  url: string;
  port: number;
  db: NodePgDatabase;
  getSession(): TestSession;
  setSession(next: TestSession): void;
  reset(): Promise<void>;
  stop(): Promise<void>;
};

type CreateServerOptions = {
  session?: TestSession;
};

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

async function ensureInternalServer(
  options: CreateServerOptions
): Promise<InternalServer> {
  if (internalServer) {
    if (options.session) {
      internalServer.currentSession = options.session;
      internalServer.api.setSession(options.session);
    }
    await truncateTables(internalServer.dbClient.db);
    return internalServer;
  }

  const dbClient = await createTestDb();
  await truncateTables(dbClient.db);
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
        router: appRouter,
        createContext: () => buildContext(req, resolveSession(req, sessionRef)),
      });
    },
  });

  const api: TestServer = {
    url: `http://127.0.0.1:${instance.port}`,
    port: instance.port,
    db: dbClient.db,
    getSession() {
      return sessionRef;
    },
    setSession(next: TestSession) {
      sessionRef = next;
      internalServer!.currentSession = next;
    },
    async reset() {
      await truncateTables(dbClient.db);
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

export async function cleanupTestServer(
  server?: TestServer
): Promise<void> {
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
