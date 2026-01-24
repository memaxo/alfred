import { existsSync } from "node:fs";
import { lstat, mkdir, realpath, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export interface PersistArtifactArgs {
  repoRoot: string;
  category: string;
  tool: string;
  format: "json" | "md" | "txt" | "log";
  content: string | Uint8Array;
  filename?: string;
}

function safeSegment(value: string, name: string): string {
  const v = value.trim();
  if (!v) {
    throw new Error(`artifact_${name}_empty`);
  }
  if (!/^[a-z0-9_-]+$/i.test(v)) {
    throw new Error(`artifact_${name}_invalid`);
  }
  return v;
}

function safeBasename(value: string): string {
  const v = value.trim();
  if (!v) {
    throw new Error("artifact_filename_empty");
  }
  if (v.includes("/") || v.includes("\\") || v.includes("..")) {
    throw new Error("artifact_filename_invalid");
  }
  return v.replaceAll(/[\r\n"]/g, "_");
}

async function ensureDirTree(rootReal: string, relParts: string[]) {
  let current = rootReal;
  for (const part of relParts) {
    const next = path.join(current, part);
    if (existsSync(next)) {
      const st = await lstat(next);
      if (st.isSymbolicLink()) {
        throw new Error("artifact_symlink_refused");
      }
      if (!st.isDirectory()) {
        throw new Error("artifact_parent_not_dir");
      }
    } else {
      await mkdir(next);
    }
    current = next;
  }
  return current;
}

export async function persistArtifact(
  args: PersistArtifactArgs
): Promise<{ path: string }> {
  const repoReal = await realpath(args.repoRoot);

  const category = safeSegment(args.category, "category");
  const tool = safeSegment(args.tool, "tool");

  const dir = await ensureDirTree(repoReal, [".agent", "tools", category]);

  const file = safeBasename(args.filename ?? `${tool}.${args.format}`);
  const finalPath = path.join(dir, file);

  if (existsSync(finalPath)) {
    const st = await lstat(finalPath);
    if (st.isSymbolicLink()) {
      throw new Error("artifact_symlink_refused");
    }
  }

  const tmpPath = path.join(
    dir,
    `.${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  await writeFile(tmpPath, args.content);
  await rename(tmpPath, finalPath);

  const rel = path.relative(repoReal, finalPath).replaceAll(/\\/g, "/");
  return { path: rel };
}
