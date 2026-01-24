import type { McpAuth, McpServer } from "@alfred/db/schema/mcp";
import type { Tool } from "ai";

import { experimental_createMCPClient as createMcpClient } from "@ai-sdk/mcp";
import { listEnabledMcpServers } from "@alfred/db/repo/mcp";
import { logger } from "@alfred/logger";

type ToolMap = Record<string, Tool>;

export type McpToolset = {
  tools: ToolMap;
  close: () => Promise<void>;
};

function normalizeTransport(value: string): "http" | "sse" {
  if (value === "sse") {
    return "sse";
  }
  return "http";
}

function resolveHeaders(authType: string, auth: McpAuth | null) {
  if (authType === "oauth") {
    return null;
  }
  if (authType !== "bearer") {
    return;
  }

  const envKey = auth?.bearerEnv ?? null;
  if (!envKey) {
    return null;
  }

  const token = process.env[envKey];
  if (!token) {
    return null;
  }

  return { Authorization: `Bearer ${token}` };
}

function namespace(label: string, toolName: string): string {
  return `${label}__${toolName}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toolDesc(tool: unknown): string | null {
  if (!isRecord(tool)) {
    return null;
  }
  return typeof tool.description === "string" ? tool.description : null;
}

export async function loadMcpTools(
  userId: string,
  signal?: AbortSignal
): Promise<McpToolset> {
  let servers: McpServer[] = [];
  try {
    const rows = await listEnabledMcpServers(userId);
    servers = Array.isArray(rows) ? (rows as McpServer[]) : [];
  } catch (error) {
    logger.warn("mcp_config_load_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { tools: {}, close: async () => {} };
  }
  if (servers.length === 0) {
    return { tools: {}, close: async () => {} };
  }

  const clients: { close: () => Promise<void> }[] = [];
  let closed = false;

  const close = async () => {
    if (closed) {
      return;
    }
    closed = true;
    await Promise.allSettled(clients.map((client) => client.close()));
  };

  if (signal) {
    if (signal.aborted) {
      await close();
      return { tools: {}, close };
    }
    signal.addEventListener(
      "abort",
      () => {
        void close();
      },
      { once: true }
    );
  }

  const merged: ToolMap = {};

  for (const server of servers) {
    let client: Awaited<ReturnType<typeof createMcpClient>> | null = null;
    try {
      const headers = resolveHeaders(server.authType, server.auth ?? null);
      if (headers === null) {
        logger.warn("mcp_auth_missing", {
          userId,
          serverId: server.id,
          label: server.label,
          authType: server.authType,
        });
        continue;
      }

      client = await createMcpClient({
        transport: {
          type: normalizeTransport(server.transport),
          url: server.url,
          ...(headers ? { headers } : {}),
        },
      });
      clients.push(client);

      const tools = await client.tools();
      for (const [toolName, toolDef] of Object.entries(tools)) {
        const key = namespace(server.label, toolName);
        if (key in merged) {
          logger.warn("mcp_tool_collision", {
            userId,
            serverId: server.id,
            label: server.label,
            toolName,
            namespaced: key,
          });
          continue;
        }

        merged[key] = {
          ...(toolDef as Tool),
          needsApproval: true,
          description: `[mcp:${server.label}] ${toolDesc(toolDef) ?? toolName}`,
        };
      }
    } catch (error) {
      logger.warn("mcp_tool_load_failed", {
        userId,
        serverId: server.id,
        label: server.label,
        error: error instanceof Error ? error.message : String(error),
      });
      try {
        await client?.close();
      } catch {}
    }
  }

  return { tools: merged, close };
}
