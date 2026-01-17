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

describe("boundary: components must not read process.env", () => {
  it("does not use process.env in apps/web/src/components/** (allowlisted exceptions only)", async () => {
    const componentsDir = new URL("../../components", import.meta.url);
    const files = await listSourceFiles(componentsDir.pathname);

    const offenders: string[] = [];
    for (const file of files) {
      const text = await Bun.file(file).text();
      if (/\bprocess\.env\b/.test(text)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
