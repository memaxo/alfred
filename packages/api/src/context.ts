import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { auth } from "@alfred/auth";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { getSessionUser } from "./utils/session";

type AuthSession = Awaited<ReturnType<(typeof auth)["api"]["getSession"]>>;

const TEST_SESSION_HEADER = "x-alfred-test-session";

export type RuntimeMetadata = {
  /** Unique identifier for the incoming request */
  requestId: string;
  /** Timestamp when the backend received the request */
  receivedAt: Date;
  /** HTTP method */
  method: string;
  /** Absolute URL of the request */
  url: string;
  /** Best-effort client IP */
  ip: string | null;
  /** Ordered list of forwarded-for entries */
  forwardedFor: string[];
  /** Reported user agent */
  userAgent: string | null;
  /** Referer/Referrer header */
  referer: string | null;
};

export type Context = {
  session: AuthSession | null;
  runtime: RuntimeMetadata;
  runtimeContext: RuntimeContext;
  policy?: {
    obligations: string[];
  };
};

function parseForwardedFor(headers: Headers) {
  const header = headers.get("x-forwarded-for");
  if (!header) {
    return [] as string[];
  }
  return header
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function resolveClientIp(headers: Headers, forwardedFor: string[]) {
  if (forwardedFor.length > 0) {
    return forwardedFor[0] ?? null;
  }
  const directHeaders = [
    "x-real-ip",
    "cf-connecting-ip",
    "true-client-ip",
    "fastly-client-ip",
  ];
  for (const key of directHeaders) {
    const value = headers.get(key);
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function resolveRequestId(headers: Headers) {
  const headerNames = [
    "x-request-id",
    "cf-ray",
    "fly-request-id",
    "traceparent",
  ];
  for (const name of headerNames) {
    const value = headers.get(name);
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return randomUUID();
}

function resolveReferer(headers: Headers) {
  return headers.get("referer") ?? headers.get("referrer");
}

function parseTestSession(headers: Headers): AuthSession | null {
  const value = headers.get(TEST_SESSION_HEADER);
  if (!value) {
    return null;
  }
  try {
    const payload = Buffer.from(value, "base64").toString("utf8");
    const parsed = JSON.parse(payload) as AuthSession;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (!parsed.user || !parsed.session) {
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

export async function createContext({
  req,
}: {
  req: Request;
}): Promise<Context> {
  const headers = req.headers;
  const forwardedFor = parseForwardedFor(headers);
  const runtime: RuntimeMetadata = {
    requestId: resolveRequestId(headers),
    receivedAt: new Date(),
    method: req.method,
    url: req.url,
    ip: resolveClientIp(headers, forwardedFor),
    forwardedFor,
    userAgent: headers.get("user-agent"),
    referer: resolveReferer(headers),
  };

  const testSession = parseTestSession(headers);

  const session = testSession
    ? testSession
    : await auth.api
        .getSession({
          headers,
        })
        .catch(() => null);

  const runtimeContextEntries: [string, unknown][] = [
    ["requestId", runtime.requestId],
    ["receivedAt", runtime.receivedAt.toISOString()],
    ["method", runtime.method],
    ["url", runtime.url],
    ["ip", runtime.ip],
    ["forwardedFor", runtime.forwardedFor],
  ];

  if (runtime.userAgent) {
    runtimeContextEntries.push(["userAgent", runtime.userAgent]);
  }

  if (runtime.referer) {
    runtimeContextEntries.push(["referer", runtime.referer]);
  }

  const user = getSessionUser(session);
  if (user?.id) {
    runtimeContextEntries.push(["userId", user.id]);
  }
  if (user?.roles && user.roles.length > 0) {
    runtimeContextEntries.push(["userRoles", [...user.roles]]);
  }
  if (user?.scopes && user.scopes.length > 0) {
    runtimeContextEntries.push(["userScopes", [...user.scopes]]);
  }

  runtimeContextEntries.push(["scanContext", null]);

  const runtimeContext = new RuntimeContext<Record<string, unknown>>(
    runtimeContextEntries as [string, unknown][]
  );

  return {
    session,
    runtime,
    runtimeContext,
  };
}

export function cloneRuntimeContext(
  base: RuntimeContext,
  extras: [string, unknown][] = []
): RuntimeContext {
  const entries: [string, unknown][] = [];
  base.forEach((value, key) => {
    entries.push([String(key), value]);
  });
  const clone = new RuntimeContext<Record<string, unknown>>(
    entries as [string, unknown][]
  );
  for (const [key, value] of extras) {
    clone.set(key as string, value as unknown);
  }
  return clone;
}
