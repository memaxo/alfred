import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "__tests__") {
      continue;
    }
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listTsFiles(full));
      continue;
    }
    if (name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("knowledge boundaries", () => {
  it("does not import @alfred/db (DB-free core)", () => {
    const srcDir = join(import.meta.dir, "..");
    const files = listTsFiles(srcDir);
    for (const file of files) {
      // Hot-path modules may include DB-backed optimizations; the core hypergraph
      // and query/persist layers must remain DB-free.
      if (file.endsWith(".hot.ts")) {
        continue;
      }
      if (file.endsWith("manifest.ts")) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      expect(source.includes("@alfred/db")).toBe(false);
    }
  });
});
