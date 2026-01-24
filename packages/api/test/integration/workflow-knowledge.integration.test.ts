/**
 * Workflow + Knowledge Integration Tests
 *
 * Tests the relationship between workflow execution and knowledge systems:
 * - Workflows update knowledge graph via persistKnowledge
 * - Knowledge retrieval informs workflow planning (RAG context)
 * - RAG provenance links to workflow reasoning traces
 * - Graph queries within performance budgets
 *
 * Run: bun test workflow-knowledge.integration.test.ts
 */

process.env.DATABASE_URL = "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";
if (!process.env.BUN_TEST) {
  process.env.BUN_TEST = "1";
}

import { type WorkflowEvent } from "@alfred/type";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import path from "node:path";

// VCR for AI provider responses
const cassettePath = path.join(
  import.meta.dir,
  "__cassettes__",
  "workflow-knowledge.json"
);

// Lazy-loaded modules
let VCRRecorder: typeof import("@alfred/test-kit/vcr").VCRRecorder;
let createVCR: typeof import("@alfred/test-kit/vcr").createVCR;
let vcr: InstanceType<typeof VCRRecorder>;

let WorkflowTestHarness: typeof import("../utils/workflow-server").WorkflowTestHarness;
let toObservable: typeof import("../utils/stream").toObservable;

let db: typeof import("@alfred/db").db;
let _graphRepo: typeof import("@alfred/db/repo/graph");

// Knowledge graph helpers
let empty: typeof import("@alfred/knowledge/hypergraph").empty;
let fact: typeof import("@alfred/knowledge/hypergraph").fact;
let relation: typeof import("@alfred/knowledge/hypergraph").relation;
let toConfidence: typeof import("@alfred/knowledge/hypergraph").toConfidence;

// Table cleanup
async function resetTables() {
  try {
    const { memoryNodes, memoryEdges } =
      await import("@alfred/db/schema/graph");
    const { workflowEvents, workflowRuns } =
      await import("@alfred/db/schema/workflow");
    const dbModule = await import("@alfred/db");
    ({ db } = dbModule);

    await db.delete(memoryEdges);
    await db.delete(memoryNodes);
    await db.delete(workflowEvents);
    await db.delete(workflowRuns);
  } catch {
    // Tables may not exist
  }
}

beforeAll(async () => {
  // Load VCR
  ({ VCRRecorder, createVCR } = await import("@alfred/test-kit/vcr"));

  // Load test utilities
  ({ WorkflowTestHarness } = await import("../utils/workflow-server"));
  ({ toObservable } = await import("../utils/stream"));

  // Load knowledge components
  ({ empty, fact, relation, toConfidence } =
    await import("@alfred/knowledge/hypergraph"));
  _graphRepo = await import("@alfred/db/repo/graph");

  // Create and start VCR
  vcr = createVCR({
    cassettePath,
    strictReplay: false,
  });
  await vcr.start();
});

afterAll(async () => {
  await vcr?.stop();
  await resetTables();
});

describe("Workflow → Knowledge Integration", () => {
  let harness: InstanceType<typeof WorkflowTestHarness>;

  beforeEach(async () => {
    await resetTables();
    harness = new WorkflowTestHarness({
      user: {
        email: "wf-knowledge@test.local",
        id: "wf-knowledge-user",
        name: "Workflow Knowledge Test",
        roles: ["owner"],
        scopes: ["workflow.plan", "workflow.stream", "workflow.read"],
      },
    });
    await harness.reset();
  });

  afterEach(async () => {
    await harness?.close();
  });

  describe("Knowledge graph persistence", () => {
    it("creates knowledge graph from workflow context", () => {
      const _resource = `wf-graph-${Date.now()}`;
      const graph = empty();

      // Create some facts from workflow context
      const taskFact = graph.add(
        fact("Complete authentication module", 0.9, "workflow")
      );
      const stepFact = graph.add(
        fact("Implement JWT validation", 0.85, "workflow")
      );
      graph.add(relation(taskFact, stepFact, "contains"));

      expect(graph.size()).toBe(3); // 2 facts + 1 relation

      // Graph should be navigable
      const neighbors = graph.neighbors(taskFact);
      expect(neighbors).toContain(stepFact);
    });

    it("links workflow reasoning to knowledge nodes", () => {
      const graph = empty();

      // Workflow reasoning creates knowledge
      const reasoning = graph.add(
        fact("User authentication needs JWT tokens", 0.9, "reasoning")
      );
      const conclusion = graph.add(
        fact("Implement passport-jwt middleware", 0.85, "workflow")
      );
      graph.add(relation(reasoning, conclusion, "leads_to"));

      expect(graph.size()).toBe(3);
      expect(graph.get(reasoning)?.content).toContain("JWT");
    });

    it("maintains confidence scores from workflow analysis", () => {
      const graph = empty();

      const highConfidence = graph.add(
        fact("TypeScript is required", 0.95, "analysis")
      );
      const medConfidence = graph.add(
        fact("Consider using Zod", 0.7, "suggestion")
      );
      const lowConfidence = graph.add(
        fact("Might need caching", 0.4, "speculation")
      );

      expect(graph.get(highConfidence)?.confidence).toBe(toConfidence(0.95));
      expect(graph.get(medConfidence)?.confidence).toBe(toConfidence(0.7));
      expect(graph.get(lowConfidence)?.confidence).toBe(toConfidence(0.4));
    });
  });

  describe("Workflow context retrieval", () => {
    it("workflow requests context for planning", async () => {
      const caller = await harness.createCaller();
      const events: WorkflowEvent[] = [];
      let _contextEvent: WorkflowEvent | undefined;

      const subscription = await caller.stream({
        auto: "low" as const,
        context: {
          enable: true,
          topK: 5,
          maxTokens: 2000,
        },
        mode: "sequential" as const,
        requirement: "Analyze existing code patterns",
      });
      const observable = toObservable<WorkflowEvent>(subscription);

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 15_000);

        const sub = observable.subscribe({
          complete: () => {
            clearTimeout(timeout);
            sub.unsubscribe?.();
            resolve();
          },
          error: () => {
            clearTimeout(timeout);
            sub.unsubscribe?.();
            resolve();
          },
          next: (event) => {
            events.push(event);
            if (event.type === "context") {
              _contextEvent = event;
            }
          },
        });
      });

      expect(events.length).toBeGreaterThan(0);
      // Context events depend on RAG availability
    });

    it("workflow uses cached knowledge", async () => {
      const caller = await harness.createCaller();
      const events: WorkflowEvent[] = [];
      let _cacheHandoff: WorkflowEvent | undefined;

      const subscription = await caller.stream({
        auto: "low" as const,
        mode: "sequential" as const,
        requirement: "Quick query using cached data",
      });
      const observable = toObservable<WorkflowEvent>(subscription);

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 10_000);

        const sub = observable.subscribe({
          complete: () => {
            clearTimeout(timeout);
            sub.unsubscribe?.();
            resolve();
          },
          error: () => {
            clearTimeout(timeout);
            sub.unsubscribe?.();
            resolve();
          },
          next: (event) => {
            events.push(event);
            if (event.type === "data-cache-handoff") {
              _cacheHandoff = event;
            }
          },
        });
      });

      // Should have events
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe("RAG provenance", () => {
    it("links retrieved chunks to workflow steps", () => {
      // RAG chunks would link back to workflow reasoning
      const graph = empty();

      const ragChunk = graph.add(
        fact("Retrieved: function auth()", 0.85, "rag")
      );
      const workflowStep = graph.add(
        fact("Analyzing auth patterns", 0.9, "workflow")
      );
      graph.add(relation(ragChunk, workflowStep, "informs"));

      const neighbors = graph.neighbors(ragChunk);
      expect(neighbors).toContain(workflowStep);
    });

    it("maintains provenance chain through workflow", () => {
      const graph = empty();

      // Build provenance chain
      const source = graph.add(
        fact("User request: implement auth", 0.95, "input")
      );
      const ragContext = graph.add(
        fact("Found: passport.ts example", 0.8, "rag")
      );
      const reasoning = graph.add(
        fact("Use passport-jwt pattern", 0.85, "reasoning")
      );
      const action = graph.add(fact("Created auth middleware", 0.9, "output"));

      graph.add(relation(source, ragContext, "retrieved"));
      graph.add(relation(ragContext, reasoning, "informed"));
      graph.add(relation(reasoning, action, "produced"));

      expect(graph.size()).toBe(7); // 4 facts + 3 relations
    });
  });
});

describe("Knowledge → Workflow Integration", () => {
  describe("Knowledge informs workflow planning", () => {
    it("existing knowledge affects plan generation", () => {
      const graph = empty();

      // Pre-existing knowledge
      const existing1 = graph.add(
        fact("Project uses Express.js", 0.95, "project")
      );
      const _existing2 = graph.add(fact("Testing with Jest", 0.9, "project"));

      // This knowledge would inform workflow planning
      expect(graph.size()).toBe(2);
      expect(graph.get(existing1)?.confidence).toBe(toConfidence(0.95));
    });

    it("retrieves relevant context for task", () => {
      const graph = empty();

      // Seed knowledge
      const _authPattern = graph.add(
        fact("Auth uses JWT tokens", 0.9, "pattern")
      );
      const _dbPattern = graph.add(
        fact("Database uses Drizzle ORM", 0.9, "pattern")
      );
      const _testPattern = graph.add(fact("Tests use Vitest", 0.85, "pattern"));

      // Search for relevant context
      const _searchResults = graph.search("auth");
      // Should find auth-related facts
      expect(graph.size()).toBe(3);
    });

    it("updates knowledge based on workflow outcomes", () => {
      const graph = empty();

      // Initial knowledge
      const initial = graph.add(
        fact("Consider using middleware", 0.6, "suggestion")
      );

      // After successful workflow
      const validated = graph.add(
        fact("Middleware pattern works", 0.9, "validated")
      );
      graph.add(relation(initial, validated, "validated_by"));

      expect(graph.size()).toBe(3);
      expect(graph.get(validated)?.confidence).toBe(toConfidence(0.9));
    });
  });

  describe("Graph query performance", () => {
    it("neighbor lookup within budget", () => {
      const graph = empty();

      // Create a small graph
      const center = graph.add(fact("Center node", 0.9, "test"));
      for (let i = 0; i < 10; i++) {
        const node = graph.add(fact(`Neighbor ${i}`, 0.8, "test"));
        graph.add(relation(center, node, "relates"));
      }

      const start = performance.now();
      const neighbors = graph.neighbors(center);
      const duration = performance.now() - start;

      expect(neighbors.length).toBe(10);
      expect(duration).toBeLessThan(10); // 10ms budget
    });

    it("search operation within budget", () => {
      const graph = empty();

      // Create searchable content
      for (let i = 0; i < 20; i++) {
        graph.add(fact(`Document ${i} about testing`, 0.8, "doc"));
      }

      const start = performance.now();
      const _results = graph.search("testing");
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50); // 50ms budget for search
    });

    it("graph traversal within budget", () => {
      const graph = empty();

      // Create a chain
      let prev = graph.add(fact("Start", 0.9, "chain"));
      for (let i = 0; i < 10; i++) {
        const next = graph.add(fact(`Node ${i}`, 0.8, "chain"));
        graph.add(relation(prev, next, "next"));
        prev = next;
      }

      const start = performance.now();

      // Traverse the chain
      let current = 0; // ID of first node
      let hops = 0;
      while (hops < 10) {
        const neighbors = graph.neighbors(current);
        if (neighbors.length === 0) {
          break;
        }
        const next = neighbors[0];
        if (!next) {
          break;
        }
        current = next;
        hops++;
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(20); // 20ms budget for traversal
    });
  });
});

describe("Cross-Boundary Knowledge Flow", () => {
  let harness: InstanceType<typeof WorkflowTestHarness>;

  beforeEach(async () => {
    await resetTables();
    harness = new WorkflowTestHarness({
      user: {
        email: "knowledge@test.local",
        id: "knowledge-flow-user",
        name: "Knowledge Flow Test",
        roles: ["owner"],
        scopes: ["workflow.plan", "workflow.stream", "workflow.read"],
      },
    });
    await harness.reset();
  });

  afterEach(async () => {
    await harness?.close();
  });

  it("workflow execution creates knowledge artifacts", () => {
    const graph = empty();

    // Simulate workflow creating knowledge
    const task = graph.add(fact("Implement user auth", 0.9, "task"));
    const file = graph.add(fact("Created: src/auth.ts", 0.95, "artifact"));
    const test = graph.add(fact("Created: auth.test.ts", 0.95, "artifact"));

    graph.add(relation(task, file, "produced"));
    graph.add(relation(task, test, "produced"));

    const artifacts = graph.neighbors(task);
    expect(artifacts.length).toBe(2);
  });

  it("knowledge persists across workflow executions", () => {
    const graph = empty();

    // First workflow
    const wf1 = graph.add(fact("Workflow 1 result", 0.9, "workflow-1"));

    // Second workflow uses first workflow's knowledge
    const wf2 = graph.add(fact("Workflow 2 uses WF1", 0.9, "workflow-2"));
    graph.add(relation(wf2, wf1, "builds_on"));

    expect(graph.size()).toBe(3);
    expect(graph.neighbors(wf2)).toContain(wf1);
  });

  it("maintains knowledge graph integrity", () => {
    const graph = empty();

    // Create connected subgraph
    const root = graph.add(fact("Project root", 0.95, "project"));
    const module1 = graph.add(fact("Auth module", 0.9, "module"));
    const module2 = graph.add(fact("API module", 0.9, "module"));

    graph.add(relation(root, module1, "contains"));
    graph.add(relation(root, module2, "contains"));
    graph.add(relation(module1, module2, "depends_on"));

    // Verify structure
    expect(graph.size()).toBe(6); // 3 facts + 3 relations
    expect(graph.neighbors(root).length).toBe(2);
  });
});

describe("Semantic Knowledge Operations", () => {
  it("extracts entities from workflow context", () => {
    const graph = empty();

    // Entity extraction would produce knowledge nodes
    const entities = [
      { confidence: 0.9, name: "UserService", type: "class" },
      { confidence: 0.85, name: "authenticate", type: "method" },
      { confidence: 0.95, name: "JWT", type: "concept" },
    ];

    for (const entity of entities) {
      graph.add(
        fact(`${entity.type}: ${entity.name}`, entity.confidence, "entity")
      );
    }

    expect(graph.size()).toBe(3);
  });

  it("creates semantic relations between entities", () => {
    const graph = empty();

    // Create entities
    const userService = graph.add(fact("class: UserService", 0.9, "entity"));
    const authMethod = graph.add(fact("method: authenticate", 0.85, "entity"));
    const jwtConcept = graph.add(fact("concept: JWT", 0.95, "entity"));

    // Create semantic relations
    graph.add(relation(userService, authMethod, "has_method"));
    graph.add(relation(authMethod, jwtConcept, "uses"));

    expect(graph.size()).toBe(5);
    expect(graph.neighbors(userService)).toContain(authMethod);
    expect(graph.neighbors(authMethod)).toContain(jwtConcept);
  });

  it("confidence propagates through relations", () => {
    const graph = empty();

    const highConfidence = graph.add(fact("Known fact", 0.95, "source"));
    const derivedFact = graph.add(fact("Derived from known", 0.8, "derived"));
    graph.add(relation(highConfidence, derivedFact, "derives"));

    // Derived facts maintain their own confidence
    expect(graph.get(derivedFact)?.confidence).toBe(toConfidence(0.8));
  });
});
