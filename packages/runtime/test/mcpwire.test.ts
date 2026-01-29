import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("runtime MCP wiring", () => {
  it("imports @alfred/mcp and gates behind ORCH_MCP", () => {
    const p = path.resolve(import.meta.dir, "../src/orchestrator/index.ts");
    const src = readFileSync(p, "utf8");

    expect(src).toContain('from "@alfred/mcp"');
    expect(src).toContain("process.env.ORCH_MCP");
  });
});
