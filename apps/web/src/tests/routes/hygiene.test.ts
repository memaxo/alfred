import { describe, expect, it } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (entry.isFile()) {
      out.push(full);
    } else if (statSync(full).isFile()) {
      out.push(full);
    }
  }
}

describe("route tree hygiene", () => {
  it("does not allow test/spec files under src/routes", () => {
    const routesDir = join(import.meta.dir, "..", "..", "routes");

    const files: string[] = [];
    walk(routesDir, files);

    const offenders = files.filter((file) =>
      /\.(test|spec)\.[jt]sx?$/.test(file)
    );

    expect(offenders).toEqual([]);
  });
});
