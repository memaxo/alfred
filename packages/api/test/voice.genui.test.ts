import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
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

function pickUiParts(raw: unknown): unknown[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }
  const r = raw as Record<string, unknown>;
  const uiMessages = r.uiMessages;
  if (!Array.isArray(uiMessages) || uiMessages.length === 0) {
    return [];
  }
  const first = uiMessages[0];
  if (!first || typeof first !== "object") {
    return [];
  }
  const parts = (first as Record<string, unknown>).parts;
  if (!Array.isArray(parts)) {
    return [];
  }
  return parts.filter(
    (p) =>
      p &&
      typeof p === "object" &&
      (p as Record<string, unknown>).type === "data-ui"
  );
}

function makeStructuredPlan() {
  return {
    id: "plan-1",
    title: "Test Plan",
    intent: "Do the thing",
    phases: [
      {
        id: "p1",
        name: "Phase",
        description: "desc",
        tasks: [{ id: "t1", title: "Task", deps: [] }],
        dependsOn: [],
        estimatedDurationMs: 60_000,
        agentType: "codex",
      },
    ],
    waves: [{ id: "w1", agents: ["t1"], dependsOn: [] }],
    resources: { agentCount: 1, strategy: "sequential", isolation: "agentfs" },
    evaluationCriteria: [],
  };
}

describe("voice workflow GenUI raw output", () => {
  const env0 = snapEnv();

  beforeEach(() => {
    vi.restoreAllMocks();
    setEnv("NODE_ENV", "test");
    setEnv("AI_GATEWAY_API_KEY", undefined);
    setEnv("OPENAI_API_KEY", undefined);
    setEnv("CEREBRAS_API_KEY", "test");
    // Ensure schema generator prefers deterministic paths.
    setEnv("AI_MODEL_REF_CLASSIFY", "cerebras:llama3.1-8b");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreEnv(env0);
  });

  it("handleWorkflowIntent emits data-ui parts with schemas validating uiComponentSchema", async () => {
    // Minimal mocks so we can reach buildVoiceWorkflowRaw without DB/pipeline.
    mock.module("@alfred/db/repo/plan", () => ({
      updatePlanStatus: vi.fn().mockResolvedValue(undefined),
    }));
    const plan = makeStructuredPlan();

    mock.module("./session-context.js", () => ({
      setVoiceWorkflowContext: vi.fn().mockResolvedValue(undefined),
      getVoiceWorkflowContext: vi.fn().mockResolvedValue(undefined),
      clearVoiceWorkflowContext: vi.fn().mockResolvedValue(undefined),
    }));

    mock.module("./preferences.js", () => ({
      getVoiceWorkflowPreferences: vi.fn().mockResolvedValue({
        enabled: true,
        verbosity: "standard",
        autoApprove: "off",
        notifications: "voice",
        updates: "request",
        timeout: 5,
        learning: false,
      }),
    }));

    mock.module("@alfred/plan", () => ({
      parseIntent: vi.fn().mockResolvedValue({
        type: "intent",
        intent: { description: "Do the thing" },
      }),
    }));

    mock.module("@alfred/db/repo/plan", () => ({
      updatePlanStatus: vi.fn().mockResolvedValue(undefined),
    }));

    // Prevent the real pipeline execution path; we only need a plan result.
    mock.module("@alfred/pipeline", () => ({
      PipelineRunner: class {
        constructor() {}
        addObserver() {}
        async *runUntilStage() {}
      },
      registerDefaultStages: () => {},
    }));
    mock.module("@alfred/pipeline/observers", () => ({
      MetricsObserver: class {},
      CheckpointObserver: class {},
    }));
    mock.module("@alfred/db/repo/workflow", () => ({
      createRun: vi.fn().mockResolvedValue(undefined),
      updateRun: vi.fn().mockResolvedValue(undefined),
      PostgresCheckpointStorage: class {
        async load() {
          return {
            status: "running",
            stageResults: [],
            contextEntries: [
              {
                key: "planOutput",
                value: {
                  planId: "plan-1",
                  structuredPlan: plan,
                  subtasks: [{ id: "t1" }],
                },
              },
              {
                key: "scheduleOutput",
                value: { waves: [{ id: "w1", agents: [] }] },
              },
            ],
          };
        }
      },
    }));
    mock.module("@alfred/pipeline/snapshot", () => ({
      createContextFromSnapshot: () => ({
        get: (k: string) => {
          if (k === "planOutput") {
            return {
              planId: "plan-1",
              structuredPlan: plan,
              subtasks: [{ id: "t1" }],
            };
          }
          if (k === "scheduleOutput") {
            return { waves: [{ id: "w1", agents: [] }] };
          }
          return;
        },
      }),
      fromSerializable: (v: unknown) => v,
    }));

    const { handleWorkflowIntent } = await import(
      "../src/voice/workflow-handler"
    );

    const out = await handleWorkflowIntent(
      // ctx unused
      {} as never,
      { userId: "user-1", text: "Do the thing" } as never,
      undefined
    );

    const parts = pickUiParts(out.raw);
    expect(parts.length).toBeGreaterThanOrEqual(1);

    for (const part of parts) {
      const ui = (part as Record<string, unknown>).ui;
      const parsed = uiComponentSchema.safeParse(ui);
      expect(parsed.success).toBe(true);
    }
  });
});
