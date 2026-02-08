import { beforeEach, describe, expect, it, mock, vi } from "bun:test";

const metricsMock = {
  multiAgentAgentDurationSeconds: { observe: vi.fn() },
  multiAgentErrorsTotal: { inc: vi.fn() },
  multiAgentTasksTotal: { inc: vi.fn() },
  multiAgentWavesTotal: { inc: vi.fn() },
};

mock.module("../../src/workflow/metrics", () => metricsMock);

const { recordMultiAgentEvent } =
  await import("../../src/workflow/metrics-recorder");

describe("recordMultiAgentEvent", () => {
  beforeEach(() => {
    metricsMock.multiAgentAgentDurationSeconds.observe.mockReset();
    metricsMock.multiAgentErrorsTotal.inc.mockReset();
    metricsMock.multiAgentTasksTotal.inc.mockReset();
    metricsMock.multiAgentWavesTotal.inc.mockReset();
  });

  describe("data-subtasks events", () => {
    it("increments tasks total with count from data array", () => {
      recordMultiAgentEvent({
        data: [{}, {}, {}],
        kind: "data-subtasks",
      });

      expect(metricsMock.multiAgentTasksTotal.inc).toHaveBeenCalledWith(
        { status: "created" },
        3
      );
    });

    it("increments by 1 for empty data array", () => {
      recordMultiAgentEvent({
        data: [],
        kind: "data-subtasks",
      });

      expect(metricsMock.multiAgentTasksTotal.inc).toHaveBeenCalledWith(
        { status: "created" },
        1
      );
    });
  });

  describe("data-wave-plan events", () => {
    it("increments waves total with started status", () => {
      recordMultiAgentEvent({ kind: "data-wave-plan" });

      expect(metricsMock.multiAgentWavesTotal.inc).toHaveBeenCalledWith({
        status: "started",
      });
    });
  });

  describe("wave-result events", () => {
    it("increments waves total with status from data", () => {
      recordMultiAgentEvent({
        data: { status: "completed" },
        kind: "wave-result",
      });

      expect(metricsMock.multiAgentWavesTotal.inc).toHaveBeenCalledWith({
        status: "completed",
      });
    });

    it("defaults to completed status when missing", () => {
      recordMultiAgentEvent({
        data: {},
        kind: "wave-result",
      });

      expect(metricsMock.multiAgentWavesTotal.inc).toHaveBeenCalledWith({
        status: "completed",
      });
    });

    it("records agent outcomes for each agent", () => {
      recordMultiAgentEvent({
        data: {
          status: "completed",
          agents: [
            { role: "planner", status: "completed", durationSeconds: 5.5 },
            { role: "worker", status: "failed", durationSeconds: 2 },
          ],
        },
        kind: "wave-result",
      });

      expect(
        metricsMock.multiAgentAgentDurationSeconds.observe
      ).toHaveBeenCalledWith({ outcome: "ok", role: "planner" }, 5.5);
      expect(
        metricsMock.multiAgentAgentDurationSeconds.observe
      ).toHaveBeenCalledWith({ outcome: "error", role: "worker" }, 2);
    });

    it("records stuck agent errors", () => {
      recordMultiAgentEvent({
        data: {
          agents: [{ role: "worker", status: "stuck", durationSeconds: 10 }],
        },
        kind: "wave-result",
      });

      expect(metricsMock.multiAgentErrorsTotal.inc).toHaveBeenCalledWith({
        kind: "stuck_agent",
      });
    });

    it("handles stuck flag on agent", () => {
      recordMultiAgentEvent({
        data: {
          agents: [{ role: "worker", stuck: true, durationSeconds: 10 }],
        },
        kind: "wave-result",
      });

      expect(
        metricsMock.multiAgentAgentDurationSeconds.observe
      ).toHaveBeenCalledWith({ outcome: "stuck", role: "worker" }, 10);
    });

    it("defaults role to worker when missing", () => {
      recordMultiAgentEvent({
        data: {
          agents: [{ status: "completed", durationSeconds: 1 }],
        },
        kind: "wave-result",
      });

      expect(
        metricsMock.multiAgentAgentDurationSeconds.observe
      ).toHaveBeenCalledWith({ outcome: "ok", role: "worker" }, 1);
    });

    it("skips duration observation for invalid durations", () => {
      recordMultiAgentEvent({
        data: {
          agents: [
            { role: "worker", status: "completed", durationSeconds: -1 },
            {
              role: "worker",
              status: "completed",
              durationSeconds: Number.NaN,
            },
            { role: "worker", status: "completed" },
          ],
        },
        kind: "wave-result",
      });

      expect(
        metricsMock.multiAgentAgentDurationSeconds.observe
      ).not.toHaveBeenCalled();
    });
  });

  describe("wave-aborted events", () => {
    it("increments errors total with wave_aborted kind", () => {
      recordMultiAgentEvent({ kind: "wave-aborted" });

      expect(metricsMock.multiAgentErrorsTotal.inc).toHaveBeenCalledWith({
        kind: "wave_aborted",
      });
    });
  });

  describe("merge-conflict events", () => {
    it("increments errors total with merge_conflict kind", () => {
      recordMultiAgentEvent({ kind: "merge-conflict" });

      expect(metricsMock.multiAgentErrorsTotal.inc).toHaveBeenCalledWith({
        kind: "merge_conflict",
      });
    });
  });

  describe("merge-plan events", () => {
    it("increments tasks total with merged status", () => {
      recordMultiAgentEvent({ kind: "merge-plan" });

      expect(metricsMock.multiAgentTasksTotal.inc).toHaveBeenCalledWith({
        status: "merged",
      });
    });
  });

  describe("review-plan events", () => {
    it("increments tasks total with review status", () => {
      recordMultiAgentEvent({ kind: "review-plan" });

      expect(metricsMock.multiAgentTasksTotal.inc).toHaveBeenCalledWith({
        status: "review",
      });
    });
  });

  describe("agent result events", () => {
    const agentResultKinds = [
      { errorKind: "merge_failed", kind: "merge-agent-result" },
      { errorKind: "review_failed", kind: "review-agent-result" },
      {
        errorKind: "merge_conflict_analysis_failed",
        kind: "conflict-agent-result",
      },
      {
        errorKind: "merge_conflict_resolution_failed",
        kind: "conflict-resolution-result",
      },
      { errorKind: "review_exec_failed", kind: "review-exec-result" },
    ];

    for (const { kind, errorKind } of agentResultKinds) {
      describe(`${kind} events`, () => {
        it("observes duration for successful agent", () => {
          recordMultiAgentEvent({
            data: {
              role: "reviewer",
              status: "completed",
              durationSeconds: 3.5,
            },
            kind,
          });

          expect(
            metricsMock.multiAgentAgentDurationSeconds.observe
          ).toHaveBeenCalledWith({ outcome: "ok", role: "reviewer" }, 3.5);
          expect(metricsMock.multiAgentErrorsTotal.inc).not.toHaveBeenCalled();
        });

        it("records error for failed agent", () => {
          recordMultiAgentEvent({
            data: { role: "reviewer", status: "failed", durationSeconds: 2 },
            kind,
          });

          expect(
            metricsMock.multiAgentAgentDurationSeconds.observe
          ).toHaveBeenCalledWith({ outcome: "error", role: "reviewer" }, 2);
          expect(metricsMock.multiAgentErrorsTotal.inc).toHaveBeenCalledWith({
            kind: errorKind,
          });
        });

        it("records error for stuck agent", () => {
          recordMultiAgentEvent({
            data: { role: "reviewer", status: "stuck", durationSeconds: 5 },
            kind,
          });

          expect(
            metricsMock.multiAgentAgentDurationSeconds.observe
          ).toHaveBeenCalledWith({ outcome: "stuck", role: "reviewer" }, 5);
          expect(metricsMock.multiAgentErrorsTotal.inc).toHaveBeenCalledWith({
            kind: errorKind,
          });
        });

        it("defaults role to worker", () => {
          recordMultiAgentEvent({
            data: { status: "completed", durationSeconds: 1 },
            kind,
          });

          expect(
            metricsMock.multiAgentAgentDurationSeconds.observe
          ).toHaveBeenCalledWith({ outcome: "ok", role: "worker" }, 1);
        });
      });
    }
  });

  describe("unknown events", () => {
    it("does not record metrics for unknown event kinds", () => {
      recordMultiAgentEvent({ kind: "unknown-event" });
      recordMultiAgentEvent({ kind: null });
      recordMultiAgentEvent({});

      expect(metricsMock.multiAgentTasksTotal.inc).not.toHaveBeenCalled();
      expect(metricsMock.multiAgentWavesTotal.inc).not.toHaveBeenCalled();
      expect(
        metricsMock.multiAgentAgentDurationSeconds.observe
      ).not.toHaveBeenCalled();
      expect(metricsMock.multiAgentErrorsTotal.inc).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("handles null input", () => {
      recordMultiAgentEvent(null);

      expect(metricsMock.multiAgentTasksTotal.inc).not.toHaveBeenCalled();
    });

    it("handles undefined input", () => {
      recordMultiAgentEvent();

      expect(metricsMock.multiAgentTasksTotal.inc).not.toHaveBeenCalled();
    });

    it("handles string input", () => {
      recordMultiAgentEvent('{"kind": "data-wave-plan"}');

      expect(metricsMock.multiAgentWavesTotal.inc).toHaveBeenCalledWith({
        status: "started",
      });
    });
  });
});
