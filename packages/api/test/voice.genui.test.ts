import { uiComponentSchema } from "@alfred/type/genui.zod";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

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
  const { uiMessages } = r;
  if (!Array.isArray(uiMessages) || uiMessages.length === 0) {
    return [];
  }
  const first = uiMessages[0];
  if (!first || typeof first !== "object") {
    return [];
  }
  const { parts } = first as Record<string, unknown>;
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
    evaluationCriteria: [],
    id: "plan-1",
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
    resources: { agentCount: 1, strategy: "sequential", isolation: "agentfs" },
    title: "Test Plan",
    waves: [{ id: "w1", agents: ["t1"], dependsOn: [] }],
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
      updatePlanStatus: vi.fn().mockResolvedValue(),
    }));
    const plan = makeStructuredPlan();

    mock.module("./session-context.js", () => ({
      clearVoiceWorkflowContext: vi.fn().mockResolvedValue(undefined),
      getVoiceWorkflowContext: vi.fn().mockResolvedValue(undefined),
      setVoiceWorkflowContext: vi.fn().mockResolvedValue(undefined),
    }));

    mock.module("./preferences.js", () => ({
      getVoiceWorkflowPreferences: vi.fn().mockResolvedValue({
        autoApprove: "off",
        enabled: true,
        learning: false,
        notifications: "voice",
        timeout: 5,
        updates: "request",
        verbosity: "standard",
      }),
    }));

    mock.module("@alfred/plan", () => ({
      parseIntent: vi.fn().mockResolvedValue({
        intent: { description: "Do the thing" },
        type: "intent",
      }),
    }));

    mock.module("@alfred/db/repo/plan", () => ({
      updatePlanStatus: vi.fn().mockResolvedValue(),
    }));

    // Prevent the real pipeline execution path; we only need a plan result.
    mock.module("@alfred/pipeline", () => ({
      PipelineRunner: class {
        addObserver() {}
        async *runUntilStage() {}
      },
      registerDefaultStages: () => {},
    }));
    mock.module("@alfred/pipeline/observers", () => ({
      CheckpointObserver: class {},
      MetricsObserver: class {},
    }));
    mock.module("@alfred/db/repo/workflow", () => ({
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
      createRun: vi.fn().mockResolvedValue(undefined),
      updateRun: vi.fn().mockResolvedValue(undefined),
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
            return { waves: [{ agents: [], id: "w1" }] };
          }
          return;
        },
      }),
      fromSerializable: (v: unknown) => v,
    }));

    const { handleWorkflowIntent } =
      await import("../src/voice/workflow-handler");

    const out = await handleWorkflowIntent(
      // ctx unused
      {} as never,
      { text: "Do the thing", userId: "user-1" } as never
    );

    const parts = pickUiParts(out.raw);
    expect(parts.length).toBeGreaterThanOrEqual(1);

    for (const part of parts) {
      const { ui } = part as Record<string, unknown>;
      const parsed = uiComponentSchema.safeParse(ui);
      expect(parsed.success).toBe(true);
    }
  });
});
