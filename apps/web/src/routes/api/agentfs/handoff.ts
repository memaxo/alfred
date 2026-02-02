import { hasScope, READ_SCOPES } from "@alfred/type";
import { createFileRoute } from "@tanstack/react-router";
import { stat } from "node:fs/promises";
import path from "node:path";

import { isUuid, openAgentfsDb } from "@/server/agentfs";

function isSafeAgentfsDbPath(args: { runId: string; dbPath: string }): boolean {
  const normalized = args.dbPath.replaceAll("\\", "/");
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

function safeRunId(runId: string): string {
  return runId.replaceAll(/[^a-zA-Z0-9-]/g, "-");
}

async function getSessionFromRequest(request: Request) {
  const authPkg = "@alfred/auth";
  const { auth } = await import(/* @vite-ignore */ authPkg);
  return auth.api.getSession({ headers: request.headers });
}

export const Route = createFileRoute("/api/agentfs/handoff")({
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

        if (scopes.length > 0 && !hasScope(scopes, READ_SCOPES.AGENTFS)) {
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
        const projectIdRaw = url.searchParams.get("projectId");

        if (!runId || !dbPath) {
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

        const policyPkg = "@alfred/policy";
        const { evaluate } = await import(/* @vite-ignore */ policyPkg);
        const decision = await evaluate({
          action: "agentfs.read",
          subject: {
            id: session.user.id,
            roles,
            scopes: scopes.length > 0 ? scopes : undefined,
          },
          resource: { kind: "agentfs_file", id: `${runId}:/` },
          context: {},
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

        let baseDir: string | null = null;
        try {
          const opened = await openAgentfsDb({ runId, dbPath });
          ({ baseDir } = opened);
          await opened.fsdb.close();
        } catch {
          baseDir = null;
        }

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

        const normalized = dbPath.replaceAll("\\", "/");
        const relRunDir = path.posix.dirname(normalized);
        const absRunDir = path.resolve(process.cwd(), relRunDir);

        try {
          const st = await stat(absRunDir);
          if (!st.isDirectory()) {
            return new Response(JSON.stringify({ error: "not_found" }), {
              status: 404,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            });
          }
        } catch {
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        }

        const relToolsDir = ".agent/tools";
        const absToolsDir = path.resolve(process.cwd(), relToolsDir);

        const paths: string[] = [relRunDir];
        try {
          const st = await stat(absToolsDir);
          if (st.isDirectory()) {
            paths.push(relToolsDir);
          }
        } catch {
          // ignore
        }

        const name = `handoff-${safeRunId(runId)}.tar.gz`;
        const proc = Bun.spawn({
          cmd: ["tar", "-czf", "-", ...paths],
          cwd: process.cwd(),
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
        });

        request.signal.addEventListener(
          "abort",
          () => {
            try {
              proc.kill();
            } catch {
              // ignore
            }
          },
          { once: true }
        );

        void (async () => {
          const exit = await proc.exited;
          if (exit !== 0) {
            void new Response(proc.stderr).text();
          }
        })();

        return new Response(proc.stdout, {
          status: 200,
          headers: {
            "Content-Type": "application/gzip",
            "Content-Disposition": `attachment; filename="${name}"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
