import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";

describe("persona boundaries", () => {
  it("pipeline must not import @alfred/persona", async () => {
    const root = process.cwd();
    const candidate1 = `${root}/packages/pipeline/src`;
    const candidate2 = `${root}/../pipeline/src`;
    const pipelineDir = existsSync(candidate1) ? candidate1 : candidate2;
    const glob = new Bun.Glob("**/*.{ts,tsx,js,jsx,mjs,cjs}");

    for await (const rel of glob.scan(pipelineDir)) {
      const path = `${pipelineDir}/${rel}`;
      const text = await Bun.file(path).text();
      expect(text.includes("@alfred/persona")).toBe(false);
    }
  });
});

