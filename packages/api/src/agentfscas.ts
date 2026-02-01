import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export interface AgentfsCasMeta {
  sha: string;
  runId: string;
  projectId: string | null;
  createdAt: string;
  sizeBytes: number;
  lastAccessedAt?: string;
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

async function listTarInputs(relDir: string): Promise<string[]> {
  const rootRelPosix = relDir.replaceAll("\\", "/");
  const rootAbs = path.resolve(process.cwd(), relDir);
  const out: string[] = [];

  const walk = async (absDir: string, relDirPosix: string): Promise<void> => {
    const ents = await readdir(absDir, { withFileTypes: true });
    ents.sort((a, b) => (a.name < b.name ? -1 : (a.name > b.name ? 1 : 0)));

    for (const ent of ents) {
      const childRel = path.posix.join(relDirPosix, ent.name);
      const childAbs = path.join(absDir, ent.name);

      if (ent.isDirectory()) {
        await walk(childAbs, childRel);
        continue;
      }

      // We intentionally omit explicit directory entries (including empty dirs)
      // to avoid tar's recursive directory traversal ordering differences.
      out.push(childRel);
    }
  };

  await walk(rootAbs, rootRelPosix);
  return out;
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
  const tmpListAbs = `${tmpBase}.list`;

  try {
    let tarCmd: string[] = ["tar", "-cf", tmpTarAbs, args.relDir];
    let tarCmdFallback: string[] | null = null;
    try {
      const inputs = await listTarInputs(args.relDir);
      if (inputs.length > 0) {
        await writeFile(tmpListAbs, `${inputs.join("\n")}\n`, "utf8");
        const common = [
          "--no-acls",
          "--no-xattrs",
          "--numeric-owner",
          "--owner=0",
          "--group=0",
          "-cf",
          tmpTarAbs,
          "-T",
          tmpListAbs,
        ];

        // Prefer ustar to avoid pax headers that can capture unstable metadata.
        tarCmd = ["tar", "--format", "ustar", ...common];
        tarCmdFallback = ["tar", "--format", "pax", ...common];
      }
    } catch {
      // Best-effort: fall back to directory tar if listing fails.
      await rm(tmpListAbs, { force: true });
      tarCmd = ["tar", "-cf", tmpTarAbs, args.relDir];
    }

    const runTar = async (cmd: string[]) => {
      const tar = Bun.spawn({
        cmd,
        cwd: rootAbs,
        stderr: "pipe",
        stdin: "ignore",
        stdout: "ignore",
      });

      const [tarStderr, tarExit] = await Promise.all([
        new Response(tar.stderr).text().catch(() => ""),
        tar.exited,
      ]);

      return { tarExit, tarStderr };
    };

    const a = await runTar(tarCmd);
    if (a.tarExit !== 0) {
      if (tarCmdFallback) {
        await rm(tmpTarAbs, { force: true });
        const b = await runTar(tarCmdFallback);
        if (b.tarExit !== 0) {
          throw new Error(
            `tar_failed exit=${b.tarExit} relDir=${args.relDir} stderr=${b.tarStderr.slice(0, 200)}`
          );
        }
      } else {
        throw new Error(
          `tar_failed exit=${a.tarExit} relDir=${args.relDir} stderr=${a.tarStderr.slice(0, 200)}`
        );
      }
    }

    await rm(tmpListAbs, { force: true });

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
        cwd: rootAbs,
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
        cwd: rootAbs,
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
      await writeAgentfsCasMetaAtomic({ metaAbs, meta: nextMeta });
    } catch {
      // ignore
    }

    return { absPath: finalAbs, sha };
  } catch (error) {
    await rm(tmpAbs, { force: true });
    await rm(tmpTarAbs, { force: true });
    await rm(tmpListAbs, { force: true });
    throw error;
  }
}

async function writeAgentfsCasMetaAtomic(args: {
  metaAbs: string;
  meta: AgentfsCasMeta;
}): Promise<void> {
  const tmpAbs = `${args.metaAbs}.tmp.${Date.now()}.${Math.random().toString(16).slice(2)}`;
  try {
    await writeFile(tmpAbs, JSON.stringify(args.meta, null, 2), "utf8");
    await rename(tmpAbs, args.metaAbs);
  } catch (error) {
    await rm(tmpAbs, { force: true });
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
      lastAccessedAt:
        typeof rec.lastAccessedAt === "string" ? rec.lastAccessedAt : undefined,
      projectId: typeof rec.projectId === "string" ? rec.projectId : null,
      runId: rec.runId,
      sha: rec.sha,
      sizeBytes: rec.sizeBytes,
    };
  } catch {
    return null;
  }
}

export async function touchAgentfsCasLastAccessed(args: {
  sha: string;
  rootAbs?: string;
  now?: Date;
}): Promise<void> {
  const rootAbs = args.rootAbs ?? path.resolve(process.cwd(), ".agentfs");
  const metaAbs = path.join(rootAbs, "cas", `${args.sha}.json`);

  try {
    const existing = await readAgentfsCasMeta({ rootAbs, sha: args.sha });
    if (!existing) {
      return;
    }
    const updated: AgentfsCasMeta = {
      ...existing,
      lastAccessedAt: (args.now ?? new Date()).toISOString(),
    };
    await writeAgentfsCasMetaAtomic({ metaAbs, meta: updated });
  } catch {
    // ignore
  }
}
