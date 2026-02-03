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

function isSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

async function getSessionFromRequest(request: Request) {
  const authPkg = "@alfred/auth";
  const { auth } = await import(/* @vite-ignore */ authPkg);
  return auth.api.getSession({ headers: request.headers });
}

export const Route = createFileRoute("/api/agentfs/export")({
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
        const shaRaw = url.searchParams.get("sha");
        const store = url.searchParams.get("store") === "1";
        const runId = url.searchParams.get("runId") ?? "";
        const dbPath = url.searchParams.get("dbPath") ?? "";
        const projectIdRaw = url.searchParams.get("projectId");

        if (shaRaw) {
          if (!isSha256Hex(shaRaw)) {
            return new Response(JSON.stringify({ error: "invalid_sha" }), {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            });
          }

          const sha = shaRaw.toLowerCase();
          const policyPkg = "@alfred/policy";
          const { evaluate } = await import(/* @vite-ignore */ policyPkg);
          const decision = await evaluate({
            action: "agentfs.read",
            subject: {
              id: session.user.id,
              roles,
              scopes: scopes.length > 0 ? scopes : undefined,
            },
            resource: { kind: "agentfs_file", id: `cas:${sha}` },
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

          const casPkg = "@alfred/api/agentfscas";
          const { readAgentfsCasMeta } = await import(
            /* @vite-ignore */ casPkg
          );
          const meta = await readAgentfsCasMeta({ sha });

          if (meta?.projectId) {
            if (!projectIdRaw || projectIdRaw !== meta.projectId) {
              return new Response(JSON.stringify({ error: "forbidden" }), {
                status: 403,
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "no-store",
                },
              });
            }
          }

          const absCas = path.resolve(
            process.cwd(),
            ".agentfs",
            "cas",
            `${sha}.tar.gz`
          );
          try {
            const st = await stat(absCas);
            if (!st.isFile()) {
              throw new Error("not_file");
            }
          } catch {
            try {
              const metricsPkg = "@alfred/api/services/agentfs-metrics";
              const { recordCasMiss } = await import(
                /* @vite-ignore */ metricsPkg
              );
              recordCasMiss();
            } catch {
              // best-effort
            }
            return new Response(JSON.stringify({ error: "not_found" }), {
              status: 404,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            });
          }

          // Update lastAccessedAt for LRU tracking
          try {
            const schedulerPkg = "@alfred/api/scheduler";
            const { touchAgentfsCasLastAccessed } = await import(
              /* @vite-ignore */ schedulerPkg
            );
            await touchAgentfsCasLastAccessed({ sha });
          } catch {
            // ignore - don't fail the download if tracking fails
          }

          try {
            const metricsPkg = "@alfred/api/services/agentfs-metrics";
            const { recordCasHit } = await import(
              /* @vite-ignore */ metricsPkg
            );
            recordCasHit();
          } catch {
            // best-effort
          }

          const name = `agentfs-cas-${sha.slice(0, 12)}.tar.gz`;
          return new Response(Bun.file(absCas).stream(), {
            status: 200,
            headers: {
              "Content-Type": "application/gzip",
              "Content-Disposition": `attachment; filename="${name}"`,
              "Cache-Control": "no-store",
              "x-agentfs-cas-sha": sha,
              ...(meta?.projectId
                ? { "x-agentfs-cas-project-id": meta.projectId }
                : {}),
            },
          });
        }

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
        const relDir = path.posix.dirname(normalized);
        const absDir = path.resolve(process.cwd(), relDir);

        try {
          const st = await stat(absDir);
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

        if (store) {
          const casPkg = "@alfred/api/agentfscas";
          const { exportAgentfsRunToCas } = await import(
            /* @vite-ignore */ casPkg
          );
          let cas: { sha: string; absPath: string };
          try {
            cas = await exportAgentfsRunToCas({
              runId,
              relDir: runId,
              rootAbs: path.resolve(process.cwd(), ".agentfs"),
              projectId: access.projectId,
            });
          } catch (error) {
            try {
              const auditPkg = "@alfred/agent/utils/audit";
              const { recordAudit } = await import(/* @vite-ignore */ auditPkg);
              await recordAudit({
                userId: session.user.id,
                projectId: access.projectId,
                action: "agentfs.op.cas_export",
                resource: { kind: "agentfs_run", id: runId },
                decision: "deny",
                context: {
                  success: false,
                  runId,
                  error:
                    error instanceof Error
                      ? error.message
                      : String(error ?? ""),
                },
              });
            } catch {
              // best-effort
            }
            return new Response(JSON.stringify({ error: "export_failed" }), {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            });
          }

          try {
            const auditPkg = "@alfred/agent/utils/audit";
            const { recordAudit } = await import(/* @vite-ignore */ auditPkg);
            await recordAudit({
              userId: session.user.id,
              projectId: access.projectId,
              action: "agentfs.op.cas_export",
              resource: { kind: "agentfs_run", id: runId },
              decision: "allow",
              context: { success: true, runId, sha: cas.sha },
            });
          } catch {
            // best-effort
          }
          const name = `agentfs-${safeRunId(runId)}-${cas.sha.slice(0, 12)}.tar.gz`;
          return new Response(Bun.file(cas.absPath).stream(), {
            status: 200,
            headers: {
              "Content-Type": "application/gzip",
              "Content-Disposition": `attachment; filename="${name}"`,
              "Cache-Control": "no-store",
              "x-agentfs-cas-sha": cas.sha,
              ...(access.projectId
                ? { "x-agentfs-cas-project-id": access.projectId }
                : {}),
            },
          });
        }

        const name = `agentfs-${safeRunId(runId)}.tar.gz`;
        const proc = Bun.spawn({
          cmd: ["tar", "-czf", "-", relDir],
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
            // Best-effort: nothing to do (response is already streaming).
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
