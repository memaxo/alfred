import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { uiComponentSchema } from "@alfred/type/genui.zod";

type EnvSnapshot = Record<string, string | undefined>;

const ENV_KEYS = [
  "NODE_ENV",
  "AI_MODEL_REF_CLASSIFY",
  "AI_MODEL_CLASSIFY",
  "AI_MODEL_REF",
  "AI_MODEL",
  "OPENAI_API_KEY",
  "AI_GATEWAY_API_KEY",
  "CEREBRAS_API_KEY",
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

function snapEnv(): EnvSnapshot {
  const out: EnvSnapshot = {};
  for (const k of ENV_KEYS) {
    out[k] = process.env[k];
  }
  return out;
}

function restoreEnv(s: EnvSnapshot): void {
  for (const k of ENV_KEYS) {
    const v = s[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

function setEnv(key: EnvKey, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("SchemaGenerator", () => {
  const env0 = snapEnv();

  beforeEach(() => {
    vi.restoreAllMocks();
    setEnv("NODE_ENV", "test");
    setEnv("AI_GATEWAY_API_KEY", undefined);
    setEnv("OPENAI_API_KEY", undefined);
    setEnv("AI_MODEL_REF", undefined);
    setEnv("AI_MODEL", undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnv(env0);
  });

  it("selectComponent: array of numbers -> chart", async () => {
    const { SchemaGenerator } = await import("../src/services/schema");
    const gen = new SchemaGenerator();
    expect(
      gen.selectComponent([1, 2, 3], { surface: "web", mode: "assistant" })
    ).toBe("chart");
  });

  it("selectComponent: record of primitives -> grid", async () => {
    const { SchemaGenerator } = await import("../src/services/schema");
    const gen = new SchemaGenerator();
    expect(
      gen.selectComponent(
        { a: 1, b: "x", c: true },
        { surface: "web", mode: "assistant" }
      )
    ).toBe("grid");
  });

  it("selectComponent: array of timestamped objects -> workflow-timeline in workflow mode", async () => {
    const { SchemaGenerator } = await import("../src/services/schema");
    const gen = new SchemaGenerator();
    expect(
      gen.selectComponent(
        [{ timestamp: "2026-01-01T00:00:00Z", status: "running" }],
        { surface: "web", mode: "workflow" }
      )
    ).toBe("workflow-timeline");
  });

  it("selectComponent: array of timestamped objects -> list outside workflow mode", async () => {
    const { SchemaGenerator } = await import("../src/services/schema");
    const gen = new SchemaGenerator();
    expect(
      gen.selectComponent(
        [{ createdAt: "2026-01-01T00:00:00Z", msg: "hi" }],
        { surface: "web", mode: "assistant" }
      )
    ).toBe("list");
  });

  it("selectComponent: text -> null (no GenUI)", async () => {
    const { SchemaGenerator } = await import("../src/services/schema");
    const gen = new SchemaGenerator();
    expect(
      gen.selectComponent("hello", { surface: "web", mode: "assistant" })
    ).toBeNull();
  });

  it("selectComponent: array of strings -> null (no GenUI)", async () => {
    const { SchemaGenerator } = await import("../src/services/schema");
    const gen = new SchemaGenerator();
    expect(
      gen.selectComponent(["a", "b"], { surface: "web", mode: "assistant" })
    ).toBeNull();
  });

  it("selectComponent: kind override -> workflow-timeline", async () => {
    const { SchemaGenerator } = await import("../src/services/schema");
    const gen = new SchemaGenerator();
    expect(
      gen.selectComponent(
        { kind: "workflow-timeline", foo: 1 },
        { surface: "web", mode: "assistant" }
      )
    ).toBe("workflow-timeline");
  });

  it("selectComponent: phases array -> workflow-timeline in workflow mode", async () => {
    const { SchemaGenerator } = await import("../src/services/schema");
    const gen = new SchemaGenerator();
    expect(
      gen.selectComponent(
        { phases: [{ id: "p1" }] },
        { surface: "web", mode: "workflow" }
      )
    ).toBe("workflow-timeline");
  });

  it("selectComponent: phases array -> plan outside workflow mode", async () => {
    const { SchemaGenerator } = await import("../src/services/schema");
    const gen = new SchemaGenerator();
    expect(
      gen.selectComponent(
        { phases: [{ id: "p1" }] },
        { surface: "web", mode: "assistant" }
      )
    ).toBe("plan");
  });

  it("generateSchema: deterministic chart validates", async () => {
    const { SchemaGenerator } = await import("../src/services/schema");
    const gen = new SchemaGenerator();
    const result = await gen.generateSchema({
      data: [10, 20, 30],
      ctx: { surface: "web", mode: "assistant" },
    });
    expect(result.meta.path).toBe("deterministic");
    expect(result.ui).toBeTruthy();
    expect(uiComponentSchema.safeParse(result.ui).success).toBe(true);
    expect(result.ui?.component).toBe("chart");
  });

  it("generateSchema: deterministic workflow-timeline validates (no LLM)", async () => {
    const { SchemaGenerator } = await import("../src/services/schema");
    const gen = new SchemaGenerator();
    const result = await gen.generateSchema({
      preferredComponent: "workflow-timeline",
      data: {
        workflowId: "run-1",
        title: "Workflow",
        phases: [
          {
            id: "p",
            name: "Phase",
            status: "running",
            progress: 10,
            tasks: [],
          },
        ],
        elapsed: 0,
      },
      ctx: { surface: "voice", mode: "workflow" },
    });
    expect(result.meta.path).toBe("deterministic");
    expect(result.ui?.component).toBe("workflow-timeline");
    expect(uiComponentSchema.safeParse(result.ui).success).toBe(true);
  });

  it("generateSchema: skips LLM when capability missing", async () => {
    setEnv("CEREBRAS_API_KEY", "test");
    setEnv("AI_MODEL_REF_CLASSIFY", "cerebras:llama3.1-8b");

    const { SchemaGenerator } = await import("../src/services/schema");
    const gen = new SchemaGenerator();

    const result = await gen.generateSchema({
      preferredComponent: "workflow-timeline",
      data: { workflowId: "run-1", phases: "bad" },
      ctx: { surface: "web", mode: "workflow", userId: "user-1" },
    });

    expect(result.ui).toBeNull();
    expect(result.meta.path).toBe("skipped");
    expect(result.meta.selectedComponent).toBe("workflow-timeline");
  });

  it("generateSchema: uses LLM path when enabled and returns validated schema", async () => {
    setEnv("AI_MODEL_REF_CLASSIFY", "openai:gpt-4o-mini");

    const { DefaultAIAdapter } = await import("../src/adapters/ai-generation");
    type MinimalGenerateObjectResult<T> = { object: T } & Record<string, unknown>;
    const spy = vi
      .spyOn(DefaultAIAdapter.prototype, "generateObject")
      .mockResolvedValue(
        {
          object: { component: "list", props: { items: [] } },
        } as unknown as MinimalGenerateObjectResult<unknown>
      );

    const { SchemaGenerator } = await import("../src/services/schema");
    const gen = new SchemaGenerator();

    const out = await gen.generateSchema({
      preferredComponent: "workflow-timeline",
      data: { workflowId: "run-1", phases: "bad" },
      ctx: { surface: "web", mode: "workflow", userId: "user-1" },
    });

    expect(spy).toHaveBeenCalled();
    expect(out.meta.path).toBe("llm");
    expect(out.ui?.component).toBe("list");
    expect(uiComponentSchema.safeParse(out.ui).success).toBe(true);
  });
});

