import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

const ragBudgetExceededTotalMock = {
  inc: vi.fn(),
};

mock.module("../src/metrics", () => ({
  ragBudgetExceededTotal: ragBudgetExceededTotalMock,
}));

import { ContextBudgetManager } from "@alfred/history";

const { buildAssistantContextWithDeps } =
  await import("../src/ai/assistant-context");

const ORIGINAL_RAG_RERANK = process.env.RAG_RERANK;

beforeEach(() => {
  if (ORIGINAL_RAG_RERANK === undefined) {
    process.env.RAG_RERANK = undefined;
  } else {
    process.env.RAG_RERANK = ORIGINAL_RAG_RERANK;
  }
});

afterEach(() => {
  if (ORIGINAL_RAG_RERANK === undefined) {
    process.env.RAG_RERANK = undefined;
  } else {
    process.env.RAG_RERANK = ORIGINAL_RAG_RERANK;
  }
});

describe("buildAssistantContext (RAG rerank toggle)", () => {
  it("passes useReranking=true when RAG_RERANK=1", async () => {
    process.env.RAG_RERANK = "1";

    let receivedOpts:
      | {
          topK?: number;
          boostConcepts?: string[];
          useHybrid?: boolean;
          useReranking?: boolean;
        }
      | undefined;

    class FakeKnowledgeEngine {
      retrieveContext(
        _query: string,
        opts: {
          topK?: number;
          boostConcepts?: string[];
          useHybrid?: boolean;
          useReranking?: boolean;
        }
      ) {
        receivedOpts = opts;
        return Promise.resolve([{ content: "doc-a" }]);
      }
    }

    const result = await buildAssistantContextWithDeps(
      {
        baseInstructions: "BASE",
        messages: [{ role: "user", content: "hello" }],
        memory: { semanticRecall: { topK: 3 } },
      },
      {
        adapter: {
          analyzeContext: () => ({ domains: ["cognition"] }),
          getPersonaInstruction: () => "PERSONA",
        },
        KnowledgeEngine: FakeKnowledgeEngine,
      }
    );

    expect(result.detectedDomains).toEqual(["cognition"]);
    expect(result.systemInstruction).toContain("BASE");
    expect(result.systemInstruction).toContain("PERSONA");
    expect(result.systemInstruction).toContain("<context_documents>");
    expect(receivedOpts).toMatchObject({
      topK: 3,
      boostConcepts: ["cognition"],
      useHybrid: true,
      useReranking: true,
    });
  });

  it("passes useReranking=false when RAG_RERANK is not 1", async () => {
    process.env.RAG_RERANK = "0";

    let receivedOpts:
      | {
          useReranking?: boolean;
        }
      | undefined;

    class FakeKnowledgeEngine {
      retrieveContext(
        _query: string,
        opts: {
          topK?: number;
          boostConcepts?: string[];
          useHybrid?: boolean;
          useReranking?: boolean;
        }
      ) {
        receivedOpts = opts;
        return Promise.resolve([]);
      }
    }

    await buildAssistantContextWithDeps(
      {
        baseInstructions: "BASE",
        messages: [{ role: "user", content: "hello" }],
        memory: { semanticRecall: { topK: 3 } },
      },
      {
        adapter: {
          analyzeContext: () => ({ domains: [] }),
          getPersonaInstruction: () => "",
        },
        KnowledgeEngine: FakeKnowledgeEngine,
      }
    );

    expect(receivedOpts).toMatchObject({ useReranking: false });
  });

  it("budgets RAG injection and increments rag_budget_exceeded_total", async () => {
    ragBudgetExceededTotalMock.inc.mockClear();

    class FakeKnowledgeEngine {
      retrieveContext() {
        return Promise.resolve([
          { content: "DOC-A\n".repeat(2000) },
          { content: "DOC-B\n".repeat(2000) },
          { content: "DOC-C\n".repeat(2000) },
        ]);
      }
    }

    const budgetManager = new ContextBudgetManager({
      modelId: "openai/gpt-4o-mini",
      maxContextTokens: 16_000,
    });

    const result = await buildAssistantContextWithDeps(
      {
        baseInstructions: "BASE",
        messages: [{ role: "user", content: "hello" }],
        memory: { semanticRecall: { topK: 3 } },
        modelId: "openai/gpt-4o-mini",
        budgetManager,
      },
      {
        adapter: {
          analyzeContext: () => ({ domains: ["cognition"] }),
          getPersonaInstruction: () => "PERSONA",
        },
        KnowledgeEngine: FakeKnowledgeEngine,
      }
    );

    expect(result.systemInstruction).toContain("<context_documents>");
    const docs = result.systemInstruction.match(/<document>/g)?.length ?? 0;
    expect(docs).toBeGreaterThan(0);
    expect(docs).toBeLessThan(3);
    expect(ragBudgetExceededTotalMock.inc).toHaveBeenCalled();
  });
});
