import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface AgentfsCasMeta {
  sha: string;
  runId: string;
  projectId: string | null;
  createdAt: string;
  sizeBytes: number;
}

async function sha256File(absPath: string): Promise<string> {
  const file = Bun.file(absPath);
  const st = await stat(absPath);
  if (!st.isFile()) {
    throw new Error("not_a_file");
  }

  const hash = createHash("sha256");
  const reader = file.stream().getReader();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    hash.update(value);
  }
  return hash.digest("hex");
}

export async function exportAgentfsRunToCas(args: {
  runId: string;
  relDir: string;
  rootAbs?: string;
  projectId?: string | null;
}): Promise<{ sha: string; absPath: string }> {
  const rootAbs = args.rootAbs ?? path.resolve(process.cwd(), ".agentfs");
  const casRootAbs = path.resolve(rootAbs, "cas");
  await mkdir(casRootAbs, { recursive: true });

  const safeRunId = args.runId.replaceAll(/[^a-zA-Z0-9-]/g, "-");
  const tmpBase = path.join(
    casRootAbs,
    `tmp-${safeRunId}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  const tmpTarAbs = `${tmpBase}.tar`;
  const tmpAbs = `${tmpBase}.tar.gz`;

  try {
    const tar = Bun.spawn({
      cmd: ["tar", "-cf", tmpTarAbs, args.relDir],
      cwd: process.cwd(),
      stderr: "pipe",
      stdin: "ignore",
      stdout: "ignore",
    });

    const [tarStderr, tarExit] = await Promise.all([
      new Response(tar.stderr).text().catch(() => ""),
      tar.exited,
    ]);

    if (tarExit !== 0) {
      throw new Error(
        `tar_failed exit=${tarExit} relDir=${args.relDir} stderr=${tarStderr.slice(0, 200)}`
      );
    }

    try {
      const st = await stat(tmpTarAbs);
      if (!st.isFile()) {
        throw new Error("tar_output_not_file");
      }
    } catch {
      throw new Error(`tar_output_missing path=${tmpTarAbs}`);
    }

    try {
      const gzip = Bun.spawn({
        cmd: ["gzip", "-n", tmpTarAbs],
        cwd: process.cwd(),
        stderr: "pipe",
        stdin: "ignore",
        stdout: "ignore",
      });

      const gzipStderr = await new Response(gzip.stderr).text().catch(() => "");
      const gzipExit = await gzip.exited;

      if (gzipExit !== 0) {
        throw new Error(
          `gzip_failed exit=${gzipExit} path=${tmpTarAbs} stderr=${gzipStderr.slice(0, 200)}`
        );
      }

      // gzip removes the input file by default.
    } catch {
      // Fallback: tar's built-in compression. (Not deterministic across runs.)
      await rm(tmpTarAbs, { force: true });
      await rm(tmpAbs, { force: true });

      const tarGz = Bun.spawn({
        cmd: ["tar", "-czf", tmpAbs, args.relDir],
        cwd: process.cwd(),
        stderr: "pipe",
        stdin: "ignore",
        stdout: "ignore",
      });

      const [tarGzStderr, tarGzExit] = await Promise.all([
        new Response(tarGz.stderr).text().catch(() => ""),
        tarGz.exited,
      ]);

      if (tarGzExit !== 0) {
        throw new Error(`tar_gz_failed: ${tarGzStderr.slice(0, 200)}`);
      }
    }

    const sha = await sha256File(tmpAbs);
    const finalAbs = path.join(casRootAbs, `${sha}.tar.gz`);
    const metaAbs = path.join(casRootAbs, `${sha}.json`);

    let sizeBytes = 0;
    try {
      const st = await stat(tmpAbs);
      sizeBytes = st.size;
    } catch {
      sizeBytes = 0;
    }

    if (!existsSync(finalAbs)) {
      await rename(tmpAbs, finalAbs);
    } else {
      await rm(tmpAbs, { force: true });
      try {
        const st = await stat(finalAbs);
        sizeBytes = st.size;
      } catch {
        // ignore
      }
    }

    const nextMeta: AgentfsCasMeta = {
      createdAt: new Date().toISOString(),
      projectId: args.projectId ?? null,
      runId: args.runId,
      sha,
      sizeBytes,
    };

    try {
      if (!existsSync(metaAbs)) {
        await writeFile(metaAbs, JSON.stringify(nextMeta, null, 2), "utf8");
      } else {
        const prev = await readAgentfsCasMeta({ rootAbs, sha });
        const merged: AgentfsCasMeta = {
          createdAt: prev?.createdAt ?? nextMeta.createdAt,
          projectId: prev?.projectId ?? nextMeta.projectId,
          runId: prev?.runId ?? nextMeta.runId,
          sha,
          sizeBytes: nextMeta.sizeBytes,
        };
        await writeFile(metaAbs, JSON.stringify(merged, null, 2), "utf8");
      }
    } catch {
      // ignore
    }

    return { absPath: finalAbs, sha };
  } catch (error) {
    await rm(tmpAbs, { force: true });
    await rm(tmpTarAbs, { force: true });
    throw error;
  }
}

export async function readAgentfsCasMeta(args: {
  sha: string;
  rootAbs?: string;
}): Promise<AgentfsCasMeta | null> {
  const rootAbs = args.rootAbs ?? path.resolve(process.cwd(), ".agentfs");
  const metaAbs = path.join(rootAbs, "cas", `${args.sha}.json`);

  try {
    const raw = await readFile(metaAbs, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const rec = parsed as Partial<AgentfsCasMeta>;
    if (
      typeof rec.sha !== "string" ||
      typeof rec.runId !== "string" ||
      typeof rec.createdAt !== "string" ||
      typeof rec.sizeBytes !== "number"
    ) {
      return null;
    }
    return {
      createdAt: rec.createdAt,
      projectId: typeof rec.projectId === "string" ? rec.projectId : null,
      runId: rec.runId,
      sha: rec.sha,
      sizeBytes: rec.sizeBytes,
    };
  } catch {
    return null;
  }
}
