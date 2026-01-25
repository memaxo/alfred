import { createFileRoute } from "@tanstack/react-router";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

function safeRunId(runId: string): string {
  return runId.replaceAll(/[^a-zA-Z0-9-]/g, "-");
}

function isSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function writeBodyToFile(args: {
  body: ReadableStream<Uint8Array>;
  filePath: string;
}): Promise<void> {
  const writer = Bun.file(args.filePath).writer();
  const reader = args.body.getReader();
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      writer.write(value);
    }
  } finally {
    writer.end();
  }
}

async function getSessionFromRequest(request: Request) {
  const authPkg = "@alfred/auth";
  const { auth } = await import(/* @vite-ignore */ authPkg);
  return auth.api.getSession({ headers: request.headers });
}

export const Route = createFileRoute("/api/agentfs/restore")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
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

        if (scopes.length > 0 && !scopes.includes("agentfs.write")) {
          return new Response(JSON.stringify({ error: "missing_scope" }), {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        }

        if (!request.body) {
          return new Response(JSON.stringify({ error: "invalid_request" }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          });
        }

        const contentType = request.headers.get("content-type") ?? "";
        let casSha: string | null = null;
        let casProjectId: string | null = null;
        if (contentType.includes("application/json")) {
          const json = (await request.json().catch(() => null)) as null | {
            sha?: unknown;
          };
          const shaRaw = typeof json?.sha === "string" ? json.sha : null;
          const projectIdRaw =
            json &&
            typeof (json as { projectId?: unknown }).projectId === "string"
              ? ((json as { projectId?: string }).projectId ?? null)
              : null;

          if (!shaRaw || !isSha256Hex(shaRaw)) {
            return new Response(JSON.stringify({ error: "invalid_request" }), {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            });
          }

          if (projectIdRaw && !isUuid(projectIdRaw)) {
            return new Response(JSON.stringify({ error: "invalid_request" }), {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            });
          }

          casSha = shaRaw.toLowerCase();
          casProjectId = projectIdRaw;
        }

        const runId = safeRunId(globalThis.crypto.randomUUID().slice(0, 12));

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

        const tmpRoot = path.resolve(process.cwd(), "tmp", "agentfs-restore");
        const tmpArchive = path.join(tmpRoot, `${runId}.tar.gz`);
        const tmpExtract = path.join(tmpRoot, `${runId}-extract`);

        await mkdir(tmpRoot, { recursive: true });
        await mkdir(tmpExtract, { recursive: true });

        const archivePath = casSha
          ? path.resolve(process.cwd(), ".agentfs", "cas", `${casSha}.tar.gz`)
          : tmpArchive;

        let metaProjectId: string | null = null;
        if (casSha) {
          const casPkg = "@alfred/api/agentfscas";
          const { readAgentfsCasMeta } = await import(
            /* @vite-ignore */ casPkg
          );
          const meta = await readAgentfsCasMeta({ sha: casSha });
          metaProjectId = meta?.projectId ?? null;

          if (metaProjectId && metaProjectId !== casProjectId) {
            return new Response(JSON.stringify({ error: "forbidden" }), {
              status: 403,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            });
          }
        }

        try {
          if (casSha) {
            const casDecision = await evaluate({
              action: "agentfs.read",
              subject: {
                id: session.user.id,
                roles,
                scopes: scopes.length > 0 ? scopes : undefined,
              },
              resource: { kind: "agentfs_file", id: `cas:${casSha}` },
              context: {},
            });
            if (!casDecision.allow) {
              return new Response(JSON.stringify({ error: "forbidden" }), {
                status: 403,
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "no-store",
                },
              });
            }

            try {
              const st = await stat(archivePath);
              if (!st.isFile()) {
                throw new Error("not_file");
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
          } else {
            await writeBodyToFile({ body: request.body, filePath: tmpArchive });
          }

          const proc = Bun.spawn({
            cmd: ["tar", "-xzf", archivePath, "-C", tmpExtract],
            cwd: process.cwd(),
            stdin: "ignore",
            stdout: "pipe",
            stderr: "pipe",
          });

          const [stdout, stderr, exit] = await Promise.all([
            new Response(proc.stdout).text().catch(() => ""),
            new Response(proc.stderr).text().catch(() => ""),
            proc.exited,
          ]);

          if (exit !== 0) {
            return new Response(
              JSON.stringify({
                error: "extract_failed",
                stdout: stdout.slice(0, 1000),
                stderr: stderr.slice(0, 1000),
              }),
              {
                status: 400,
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "no-store",
                },
              }
            );
          }

          const extractedAgentfsDir = path.join(tmpExtract, ".agentfs");
          const entries = await readdir(extractedAgentfsDir, {
            withFileTypes: true,
          });
          const runDirs = entries.filter(
            (e) => e.isDirectory() && !e.name.startsWith(".")
          );
          if (runDirs.length !== 1) {
            return new Response(JSON.stringify({ error: "invalid_archive" }), {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            });
          }

          const entry = runDirs[0];
          if (!entry) {
            return new Response(JSON.stringify({ error: "invalid_archive" }), {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            });
          }

          const srcRunDir = path.join(extractedAgentfsDir, entry.name);

          const destRunDirRel = path.posix.join(".agentfs", runId);
          const destRunDirAbs = path.resolve(process.cwd(), destRunDirRel);
          await mkdir(path.resolve(process.cwd(), ".agentfs"), {
            recursive: true,
          });

          await rename(srcRunDir, destRunDirAbs);

          if (metaProjectId) {
            try {
              await writeFile(
                path.join(destRunDirAbs, ".project"),
                metaProjectId,
                "utf8"
              );
            } catch {
              // ignore
            }
          }

          const files = await readdir(destRunDirAbs);
          const db = files.find((f) => f.endsWith(".db"));
          if (!db) {
            return new Response(JSON.stringify({ error: "invalid_archive" }), {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            });
          }

          const dbPath = path.posix.join(destRunDirRel, db);
          return new Response(
            JSON.stringify({ runId, dbPath, projectId: metaProjectId }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            }
          );
        } finally {
          if (!casSha) {
            await rm(tmpArchive, { force: true });
          }
          await rm(tmpExtract, { recursive: true, force: true });
        }
      },
    },
  },
});
