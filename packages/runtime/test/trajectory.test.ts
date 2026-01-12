import { describe, expect, it } from "bun:test";
import { wrapEventEnvelope } from "@alfred/agent/utils/envelope";
import type { PersistedWorkflowEvent } from "../src/trajectory/atif";
import { buildAtifTrajectory } from "../src/trajectory/atif";
import { validateAtifTrajectory } from "../src/trajectory/validate";

function mkEv(
  e: Omit<PersistedWorkflowEvent, "eventData"> & { data: unknown }
) {
  return {
    ...e,
    eventData: wrapEventEnvelope({
      id: e.eventId,
      type: e.eventType,
      data: e.data,
      createdAt: (e.timestamp ?? new Date(0)).toISOString(),
    }),
  } satisfies PersistedWorkflowEvent;
}

describe("ATIF trajectory export", () => {
  it("builds a trajectory with sequential step IDs and valid tool references", () => {
    const runId = "00000000-0000-0000-0000-000000000000";
    const events: PersistedWorkflowEvent[] = [
      mkEv({
        eventId: "e1",
        eventType: "tool-call",
        timestamp: new Date("2025-01-01T00:00:00.000Z"),
        seq: 1,
        data: {
          toolCallId: "call_1",
          toolName: "fs.read",
          input: { path: "a" },
        },
      }),
      mkEv({
        eventId: "e2",
        eventType: "tool-result",
        timestamp: new Date("2025-01-01T00:00:01.000Z"),
        seq: 2,
        data: {
          toolCallId: "call_1",
          toolName: "fs.read",
          input: { path: "a" },
          output: { ok: true },
        },
      }),
    ];

    const traj = buildAtifTrajectory({ runId, events, requirement: null });
    expect(traj.schema_version).toBe("ATIF-v1.4");
    expect(traj.session_id).toBe(runId);
    expect(traj.steps.length).toBe(2);
    expect(traj.steps[0]?.step_id).toBe(1);
    expect(traj.steps[1]?.step_id).toBe(2);

    const v = validateAtifTrajectory(traj);
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });

  it("flags observations that reference unknown tool calls", () => {
    const runId = "00000000-0000-0000-0000-000000000000";
    const traj = buildAtifTrajectory({
      runId,
      requirement: null,
      events: [
        mkEv({
          eventId: "e1",
          eventType: "tool-result",
          timestamp: new Date("2025-01-01T00:00:01.000Z"),
          seq: 1,
          data: {
            toolCallId: "missing_call",
            toolName: "fs.read",
            input: { path: "a" },
            output: { ok: true },
          },
        }),
      ],
    });

    const v = validateAtifTrajectory(traj);
    expect(v.ok).toBe(false);
    expect(
      v.errors.some((e) => e.message.includes("unknown tool call id"))
    ).toBe(true);
  });
});
