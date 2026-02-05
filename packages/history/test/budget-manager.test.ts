import { describe, expect, it } from "bun:test";

import { ContextBudgetManager } from "../src/budget-manager";

function repeatLine(line: string, n: number): string {
  return Array.from({ length: n }, () => line).join("\n");
}

describe("ContextBudgetManager", () => {
  it("truncates system parts to allocation", () => {
    const mgr = new ContextBudgetManager({
      modelId: "openai/gpt-4o-mini",
      maxContextTokens: 8000,
    });
    const huge = repeatLine("Preference: keep explanations detailed.", 500);
    const out = mgr.registerSystemPart("preferences", huge);
    expect(out.tokens).toBeGreaterThan(0);
    expect(out.tokens).toBeLessThanOrEqual(
      mgr.snapshot().allocated.preferences
    );
    expect(out.truncated).toBe(true);
  });

  it("selects RAG chunks within budget and accounts for wrapper", () => {
    const mgr = new ContextBudgetManager({
      modelId: "openai/gpt-4o-mini",
      maxContextTokens: 8000,
    });
    const chunks = [
      { content: repeatLine("DOC A", 50) },
      { content: repeatLine("DOC B", 200) },
      { content: repeatLine("DOC C", 200) },
    ];
    const res = mgr.selectRagContext(chunks);
    expect(typeof res.injected).toBe("string");
    if (res.injected) {
      expect(res.injected).toContain("<context_documents>");
      expect(res.injected).toContain("</context_documents>");
    }
    expect(res.usedTokens).toBeGreaterThanOrEqual(0);
    expect(res.usedTokens).toBeLessThanOrEqual(mgr.snapshot().allocated.rag);
  });

  it("drops MCP tools first when tooling budget is exceeded", () => {
    const mgr = new ContextBudgetManager({
      modelId: "openai/gpt-4o-mini",
      maxContextTokens: 8000,
      coreToolNames: ["core_a", "core_b"],
    });

    const bigSchema = {
      type: "object",
      properties: Object.fromEntries(
        Array.from({ length: 5000 }, (_, i) => [
          `field_${i.toString().padStart(5, "0")}`,
          { type: "string" },
        ])
      ),
    };

    const tools = {
      core_a: {
        description: "core a",
        inputSchema: { type: "object", properties: { a: { type: "string" } } },
        execute: async () => ({}),
      },
      core_b: {
        description: "core b",
        inputSchema: { type: "object", properties: { b: { type: "string" } } },
        execute: async () => ({}),
      },
      demo__mcp: {
        description: "[mcp:demo] large tool",
        inputSchema: bigSchema,
        execute: async () => ({}),
      },
    } as any;

    const enforced = mgr.enforceTools(tools);
    expect(enforced.droppedToolNames.some((n) => n.includes("__"))).toBe(true);
    expect(enforced.tools.core_a).toBeDefined();
    expect(enforced.tools.core_b).toBeDefined();
  });
});
