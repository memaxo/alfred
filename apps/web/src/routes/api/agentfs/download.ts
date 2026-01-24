import { createFileRoute } from "@tanstack/react-router";
import path from "node:path";

import { isUuid, openAgentfsDb } from "../../../server/agentfs";

function isSafeAgentfsDbPath(args: { runId: string; dbPath: string }): boolean {
  const normalized = args.dbPath.replace(/\\/g, "/");
  if (!normalized.startsWith(".agentfs/")) {
    return false;
  }
  if (!normalized.endsWith(".db")) {
    return false;
  }
  if (normalized.includes("..")) {
    return false;
  }
  if (!normalized.includes(`/${args.runId}/`)) {
    return false;
  }
  return true;
}

function validateAgentfsFilePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  if (!normalized.startsWith("/")) {
    throw new Error("agentfs_file_path_invalid");
  }
  if (normalized.includes("\u0000")) {
    throw new Error("agentfs_file_path_invalid");
  }
  const norm = path.posix.normalize(normalized);
  const parts = norm.split("/").filter(Boolean);
  if (parts.some((p) => p === "..")) {
    throw new Error("agentfs_file_path_invalid");
  }
  return norm;
}

function safeFilename(filePath: string): string {
  const base = path.posix.basename(filePath);
  if (!base || base === "/" || base === "." || base === "..") {
    return "download";
  }
  return base.replace(/[\r\n"]/g, "_");
}

function classifyAgentfsFilePath(filePath: string): "normal" | "sensitive" {
  const lower = filePath.toLowerCase();
  if (
    lower.endsWith("/.env") ||
    lower.includes("/.env.") ||
    lower.includes("/.ssh/") ||
    lower.includes("/.aws/") ||
    lower.endsWith(".pem") ||
    lower.endsWith(".key")
  ) {
    return "sensitive";
  }
  return "normal";
}

async function getSessionFromRequest(request: Request) {
  const authPkg = "@alfred/auth";
  const { auth } = await import(/* @vite-ignore */ authPkg);
  return auth.api.getSession({ headers: request.headers });
}

export const Route = createFileRoute("/api/agentfs/download")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await getSessionFromRequest(request);
        const user = session?.user as
          | { roles?: unknown; scopes?: unknown }
          | undefined;

        if (!session?.user?.id) {
          return new Response(JSON.stringify({ error: "session_required" }), {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        }

        const roles = Array.isArray(user?.roles)
          ? user.roles.filter((r): r is string => typeof r === "string")
          : [];
        const scopes = Array.isArray(user?.scopes)
          ? user.scopes.filter((s): s is string => typeof s === "string")
          : [];

        if (scopes.length > 0 && !scopes.includes("read:agentfs")) {
          return new Response(JSON.stringify({ error: "missing_scope" }), {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        }

        const url = new URL(request.url);
        const runId = url.searchParams.get("runId") ?? "";
        const dbPath = url.searchParams.get("dbPath") ?? "";
        const filePathRaw = url.searchParams.get("filePath") ?? "";
        const projectIdRaw = url.searchParams.get("projectId");
        const confirmRaw = url.searchParams.get("confirm");

        if (!runId || !dbPath || !filePathRaw) {
          return new Response(JSON.stringify({ error: "invalid_request" }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        }

        if (projectIdRaw && !isUuid(projectIdRaw)) {
          return new Response(JSON.stringify({ error: "invalid_project_id" }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        }

        if (!isSafeAgentfsDbPath({ runId, dbPath })) {
          return new Response(
            JSON.stringify({ error: "agentfs_path_invalid" }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            }
          );
        }

        let filePath: string;
        try {
          filePath = validateAgentfsFilePath(filePathRaw);
        } catch {
          return new Response(
            JSON.stringify({ error: "agentfs_file_path_invalid" }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            }
          );
        }

        const sensitivity = classifyAgentfsFilePath(filePath);
        if (sensitivity === "sensitive" && confirmRaw !== "1") {
          return new Response(JSON.stringify({ error: "confirm_required" }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        }

        const policyPkg = "@alfred/policy";
        const { evaluate } = await import(/* @vite-ignore */ policyPkg);
        const decision = await evaluate({
          action: "agentfs.read",
          subject: {
            id: session.user.id,
            roles,
            scopes: scopes.length > 0 ? scopes : undefined,
          },
          resource: { kind: "agentfs_file", id: `${runId}:${filePath}` },
          context: { sensitivity },
        });

        if (!decision.allow) {
          return new Response(JSON.stringify({ error: "forbidden" }), {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        }

        const apiPkg = "@alfred/api/agentfsaccess";
        const { checkAgentfsAccess } = await import(/* @vite-ignore */ apiPkg);

        const { fsdb, baseDir } = await openAgentfsDb({ runId, dbPath });
        try {
          const access = await checkAgentfsAccess({
            userId: session.user.id,
            runId,
            baseDir,
            requestedProjectId: projectIdRaw ?? null,
          });
          if (!access.allow) {
            return new Response(JSON.stringify({ error: "forbidden" }), {
              status: 403,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            });
          }

          const st = await fsdb.fs.stat(filePath);
          if (st.isDirectory()) {
            return new Response(JSON.stringify({ error: "not_a_file" }), {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            });
          }

          const raw = await fsdb.fs.readFile(filePath, {});
          const buf =
            typeof raw === "string"
              ? Buffer.from(raw, "utf8")
              : Buffer.isBuffer(raw)
                ? raw
                : Buffer.from(raw);

          const body = new Blob([Uint8Array.from(buf)]);

          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Disposition": `attachment; filename="${safeFilename(filePath)}"`,
              "Cache-Control": "no-store",
            },
          });
        } finally {
          await fsdb.close();
        }
      },
    },
  },
});
