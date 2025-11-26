process.env.DATABASE_URL = "sqlite::memory:";
process.env.OPENAI_API_KEY ??= "test-key";
process.env.DISABLE_TRPC_METRICS = "1";

import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "bun:test";

const [
  { WorkflowTestHarness },
  { workflowSchema, db },
  { handleWorkflowStreamRequest },
  workflowAccess,
] = await Promise.all([
  import("../../../../../../packages/api/test/utils/workflow-server.ts"),
  import("@alfred/db"),
  import("../workflow/stream"),
  import("@alfred/api/workflow/access"),
]);

const minimalInput = {
  requirement: "Plan integration workflow",
  auto: "low" as const,
  mode: "sequential" as const,
};

type ParsedEvent = { name: string; data: any };

async function collectSseEvents(response: Response): Promise<ParsedEvent[]> {
  const events: ParsedEvent[] = [];
  const reader = response.body?.getReader();
  if (!reader) {
    return events;
  }
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    buffer = drainEvents(buffer, (evt) => events.push(evt));
  }
  buffer = drainEvents(buffer, (evt) => events.push(evt));
  return events;
}

function drainEvents(
  buffer: string,
  push: (evt: ParsedEvent) => void
): string {
  while (true) {
    const idx = buffer.indexOf("\n\n");
    if (idx === -1) {
      break;
    }
    const chunk = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 2);
    const evt = parseEvent(chunk);
    if (evt) {
      push(evt);
    }
  }
  return buffer;
}

function parseEvent(raw: string): ParsedEvent | null {
  let name = "message";
  let data = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      name = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      const chunk = line.slice("data:".length);
      data = data.length ? `${data}\n${chunk}` : chunk;
    }
  }
  if (!data) {
    return null;
  }
  try {
    return { name, data: JSON.parse(data) };
  } catch {
    return null;
  }
}

describe("/api/workflow/stream integration", () => {
  let harness: WorkflowTestHarness;

  beforeAll(() => {
    harness = new WorkflowTestHarness();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  afterAll(async () => {
    await harness.close();
  });

  it("streams workflow events and persists records", async () => {
    const response = await harness.invoke(
      handleWorkflowStreamRequest,
      minimalInput
    );
    expect(response.status).toBe(200);

    const events = await collectSseEvents(response);
    const runEvent = events.find(
      (evt) => evt.name === "workflow-event" && evt.data.type === "run"
    );
    expect(runEvent).toBeTruthy();

    const completeEvent = events.find((evt) => evt.name === "complete");
    expect(completeEvent).toBeTruthy();

    const runs = await db.select().from(workflowSchema.workflowRuns);
    expect(runs.length).toBeGreaterThan(0);
    const persistedEvents = await db
      .select()
      .from(workflowSchema.workflowEvents);
    expect(persistedEvents.length).toBeGreaterThan(0);
  });

  it("rejects missing authentication", async () => {
    const request = new Request("http://localhost/api/workflow/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(minimalInput),
    });
    const response = await handleWorkflowStreamRequest(request);
    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.error).toBe("session_required");
  });

  it("emits obligation event when policy requires biometrics", async () => {
    const policySpy = vi.spyOn(workflowAccess, "enforceWorkflowPlanPolicy");
    policySpy.mockResolvedValueOnce({
      obligations: [
        {
          type: "biometric",
          reason: "biometric_required",
          metadata: { code: "requireBio" },
        },
      ],
    });

    const response = await harness.invoke(handleWorkflowStreamRequest, {
      ...minimalInput,
      auto: "medium",
    });
    expect(response.status).toBe(200);

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    const decoder = new TextDecoder();
    let buffer = "";
    let obligationFound = false;

    while (!obligationFound && reader) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      buffer = drainEvents(buffer, (evt) => {
        if (
          evt.name === "workflow-event" &&
          evt.data?.type === "obligation"
        ) {
          obligationFound = true;
          expect(evt.data.obligations?.[0]?.type).toBe("biometric");
        }
      });
    }

    expect(obligationFound).toBe(true);
    await reader?.cancel();
    policySpy.mockRestore();
  });
});
