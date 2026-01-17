import { describe, expect, it } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

async function listSourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await listSourceFiles(full)));
      continue;
    }
    if (ent.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx"))) {
      out.push(full);
    }
  }
  return out;
}

describe("boundary: routes must not @vite-ignore @/ alias imports", () => {
  it('does not contain import(/* @vite-ignore */ "@/...") under apps/web/src/routes/**', async () => {
    const routesDir = new URL("../../routes", import.meta.url);
    const files = await listSourceFiles(routesDir.pathname);

    const offenders: string[] = [];
    for (const file of files) {
      const text = await Bun.file(file).text();
      if (/import\(\s*\/\*\s*@vite-ignore\s*\*\/\s*["']@\/.*/.test(text)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
