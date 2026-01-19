import { describe, expect, it } from "bun:test";
import { parseVoiceAssistantRaw } from "../src/voice.zod";

describe("VoiceAssistantRaw contract", () => {
  it("accepts UIMessage[] + workflow meta + data-ui parts", () => {
    const raw = {
      uiMessages: [
        {
          id: "msg-1",
          role: "assistant",
          parts: [
            { type: "text", text: "Plan ready." },
            {
              type: "data-ui",
              data: {
                kind: "workflow-timeline",
                runId: "run-1",
                planId: "plan-1",
              },
              ui: {
                component: "workflow-timeline",
                props: {
                  workflowId: "run-1",
                  title: "Workflow Execution",
                  phases: [
                    {
                      id: "plan",
                      name: "Plan",
                      status: "completed",
                      progress: 100,
                      tasks: [],
                    },
                  ],
                  elapsed: 0,
                },
              },
            },
          ],
        },
      ],
      meta: { runId: "run-1", planId: "plan-1" },
    };

    const res = parseVoiceAssistantRaw(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.meta?.runId).toBe("run-1");
      expect(res.value.meta?.planId).toBe("plan-1");
      expect(res.value.uiMessages.length).toBe(1);
    }
  });

  it("rejects invalid payloads", () => {
    expect(parseVoiceAssistantRaw(null).ok).toBe(false);
    expect(parseVoiceAssistantRaw({}).ok).toBe(false);
    expect(parseVoiceAssistantRaw({ uiMessages: "nope" }).ok).toBe(false);
  });
});
