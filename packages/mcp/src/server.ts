import type { AnySchema } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/spec.types.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { verifyMcpSessionToken } from "@alfred/auth/token";
import { logger } from "@alfred/logger";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { z, type output } from "zod/mini";

export interface RuntimeMcpServerOptions {
  bindHost: string;
  port: number;
  /** Path for the MCP endpoint (default: "/mcp") */
  path?: string;
}

export interface RuntimeMcpSession {
  runId: string;
  agentId: string;
  abort: (reason: string) => void;
  onEscalate?: (payload: {
    runId: string;
    agentId: string;
    input: RuntimeMcpEscalationInput;
    receipt: RuntimeMcpEscalationReceipt;
  }) => void;
}

export const RUNTIME_MCP_TOOL_NAMES = {
  ESCALATE: "escalate",
} as const;

export interface RuntimeMcpEscalationReceipt {
  ok: true;
  receiptId: string;
  receivedAt: number;
  action: "abort" | "continue";
  message: string;
}

const escalationInputSchema = z.object({
  reason: z.enum([
    "missing_dependency",
    "wrong_architecture",
    "permission_denied",
    "resource_exhausted",
    "external_service_unavailable",
    "conflicting_requirements",
    "other",
  ]),
  details: z.string().check(z.minLength(10), z.maxLength(2000)),
  suggestions: z.optional(
    z.array(z.string().check(z.maxLength(500))).check(z.maxLength(5))
  ),
  severity: z._default(z.enum(["warning", "blocking"]), "blocking"),
});

export type RuntimeMcpEscalationInput = output<typeof escalationInputSchema>;

interface SessionConn {
  token: string;
  runId: string;
  agentId: string;
  session: RuntimeMcpSession;
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

function normalizeHeaderValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const v = normalizeHeaderValue(item);
      if (v) {
        return v;
      }
    }
  }
  return;
}

function parseBearerToken(req: IncomingMessage): string | null {
  const raw = normalizeHeaderValue(req.headers.authorization);
  if (!raw) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  if (!match) {
    return null;
  }
  const token = match[1]?.trim();
  return token && token.length > 0 ? token : null;
}

function getMcpSessionId(req: IncomingMessage): string | undefined {
  const raw = normalizeHeaderValue(req.headers["mcp-session-id"]);
  return raw;
}

function sendText(res: ServerResponse, code: number, text: string): void {
  res.statusCode = code;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(text);
}

function createPerSessionMcpServer(session: RuntimeMcpSession): {
  server: McpServer;
  toolName: string;
} {
  const mcp = new McpServer({
    name: "alfred-runtime",
    version: "0.1.0",
  });

  const toolName = RUNTIME_MCP_TOOL_NAMES.ESCALATE;

  mcp.registerTool(
    toolName,
    {
      description:
        "Escalate an environment blocker to the ALFRED orchestrator (immediate ack).",
      inputSchema: escalationInputSchema as unknown as AnySchema,
    },
    async (inputRaw: unknown): Promise<CallToolResult> => {
      const parsed = escalationInputSchema.safeParse(inputRaw);
      if (!parsed.success) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "invalid_input",
            },
          ],
        };
      }

      const input = parsed.data;
      const shouldAbort = input.severity === "blocking";
      const receipt: RuntimeMcpEscalationReceipt = {
        ok: true,
        receiptId: randomUUID(),
        receivedAt: Date.now(),
        action: shouldAbort ? "abort" : "continue",
        message: shouldAbort
          ? "Escalation received; orchestrator abort requested."
          : "Escalation received; orchestrator will continue.",
      };

      if (shouldAbort) {
        try {
          session.abort(
            `${input.reason}:${input.severity}:${input.details.slice(0, 200)}`
          );
        } catch (error) {
          logger.warn("runtime_mcp_escalate_abort_failed", {
            runId: session.runId,
            agentId: session.agentId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      try {
        session.onEscalate?.({
          runId: session.runId,
          agentId: session.agentId,
          input,
          receipt,
        });
      } catch (error) {
        logger.warn("runtime_mcp_escalate_callback_failed", {
          runId: session.runId,
          agentId: session.agentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(receipt),
          },
        ],
        structuredContent: receipt as unknown as Record<string, unknown>,
      };
    }
  );

  return { server: mcp, toolName };
}

export class RuntimeMcpServer {
  private readonly options: Required<RuntimeMcpServerOptions>;
  private httpServer: ReturnType<typeof createServer> | null = null;
  private baseUrl: string | null = null;

  private readonly tokens = new Map<string, RuntimeMcpSession>();
  private readonly conns = new Map<string, SessionConn>();

  constructor(options: RuntimeMcpServerOptions) {
    this.options = {
      ...options,
      path: options.path ?? "/mcp",
    };
  }

  get url(): string | null {
    return this.baseUrl;
  }

  registerSession(
    session: RuntimeMcpSession,
    options?: { token?: string }
  ): { token: string } {
    const token = options?.token ?? `alfred_mcp_${randomUUID()}`;
    this.tokens.set(token, session);
    return { token };
  }

  unregisterToken(token: string): void {
    this.tokens.delete(token);
  }

  async start(): Promise<{ url: string }> {
    if (this.httpServer) {
      if (!this.baseUrl) {
        throw new Error("runtime_mcp_server_invalid_state");
      }
      return { url: this.baseUrl };
    }

    const server = createServer((req, res) => {
      void this.handleRequest(req, res).catch((error) => {
        logger.warn("runtime_mcp_request_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        if (res.headersSent) {
          try {
            res.end();
          } catch {
            // ignore
          }
        } else {
          sendText(res, 500, "Internal Server Error");
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.options.port, this.options.bindHost, () => resolve());
    });

    const addr = server.address() as AddressInfo | null;
    if (!addr) {
      server.close();
      throw new Error("runtime_mcp_listen_failed");
    }

    this.httpServer = server;
    this.baseUrl = `http://${addr.address}:${addr.port}${this.options.path}`;

    logger.info("runtime_mcp_server_started", {
      url: this.baseUrl,
      bindHost: this.options.bindHost,
      port: addr.port,
      path: this.options.path,
    });

    return { url: this.baseUrl };
  }

  async stop(): Promise<void> {
    if (!this.httpServer) {
      return;
    }

    const server = this.httpServer;
    this.httpServer = null;
    this.baseUrl = null;

    // Close active transports
    for (const conn of this.conns.values()) {
      try {
        conn.transport.onclose?.();
      } catch {
        // ignore
      }
    }
    this.conns.clear();
    this.tokens.clear();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const url = new URL(
      req.url ?? "",
      `http://${req.headers.host ?? "localhost"}`
    );
    if (url.pathname !== this.options.path) {
      sendText(res, 404, "Not Found");
      return;
    }

    const token = parseBearerToken(req);
    if (!token) {
      sendText(res, 401, "Missing bearer token");
      return;
    }

    // Verify token on every request. Streamable HTTP MCP performs multiple requests
    // per session (tools/list, tools/call, etc.), so replay protection must be disabled.
    try {
      await verifyMcpSessionToken(token, ["mcp.escalate"]);
    } catch {
      sendText(res, 403, "Invalid token");
      return;
    }

    const mcpSessionId = getMcpSessionId(req);

    if (mcpSessionId) {
      const existing = this.conns.get(mcpSessionId);
      if (!existing) {
        sendText(res, 404, "Session not found");
        return;
      }
      if (existing.token !== token) {
        sendText(res, 403, "Invalid token for session");
        return;
      }
      await existing.transport.handleRequest(req, res);
      return;
    }

    // New session: must be POST
    if (req.method !== "POST") {
      sendText(res, 400, "Invalid request");
      return;
    }

    const session = this.tokens.get(token);
    if (!session) {
      sendText(res, 409, "Unknown token (session not registered)");
      return;
    }

    const { server: mcpServer } = createPerSessionMcpServer(session);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        this.conns.set(id, {
          token,
          runId: session.runId,
          agentId: session.agentId,
          session,
          server: mcpServer,
          transport,
        });
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        this.conns.delete(transport.sessionId);
      }
    };

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
  }
}
