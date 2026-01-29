import { describe, expect, it } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

async function listSourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "__tests__" || ent.name === "tests") {
        continue;
      }

      // Server-only directories are allowed to depend on @alfred/agent.
      if (ent.name === "server" || full.includes("/routes/api")) {
        continue;
      }
      out.push(...(await listSourceFiles(full)));
      continue;
    }
    if (
      ent.isFile() &&
      (full.endsWith(".ts") || full.endsWith(".tsx")) &&
      !full.endsWith(".d.ts") &&
      !full.endsWith(".test.ts") &&
      !full.endsWith(".test.tsx") &&
      !full.endsWith(".spec.ts") &&
      !full.endsWith(".spec.tsx")
    ) {
      out.push(full);
    }
  }
  return out;
}

describe("boundary: apps/web must not import @alfred/agent", () => {
  it("has zero @alfred/agent imports in client-land (excluding tests, src/server/**, and src/routes/api/**)", async () => {
    const srcDir = new URL("../../", import.meta.url);
    const files = await listSourceFiles(srcDir.pathname);

    const offenders: string[] = [];
    for (const file of files) {
      const text = await Bun.file(file).text();

      const hasStatic =
        /\bfrom\s+["']@alfred\/agent(\/[^"']+)?["']/.test(text) ||
        /\bimport\s+[^;\n]+\s+from\s+["']@alfred\/agent(\/[^"']+)?["']/.test(
          text
        );
      const hasDynamic =
        /\bimport\(\s*["']@alfred\/agent(\/[^"']+)?["']\s*\)/.test(text);

      if (hasStatic || hasDynamic) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
