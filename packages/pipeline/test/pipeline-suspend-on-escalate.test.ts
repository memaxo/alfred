import { describe, expect, it } from "bun:test";
import type { PipelineEvent } from "../src/events";
import { createEvent } from "../src/events";
import type { PipelineContext, PipelineStage } from "../src/pipeline";
import { PipelineRunner } from "../src/runner";
import type { PipelineInput } from "../src/stages/types";

describe("PipelineRunner suspension", () => {
  it("emits pipeline:suspend and stops when pipelineSuspend is set", async () => {
    const runner = new PipelineRunner();

    const stageInit: PipelineStage<unknown, unknown> = {
      name: "init",
      execute: (input) => Promise.resolve(input),
    };

    const stageContext: PipelineStage<unknown, unknown> = {
      name: "context",
      execute: (input) => Promise.resolve(input),
    };

    const stagePlan: PipelineStage<unknown, unknown> = {
      name: "plan",
      execute: (input, ctx: PipelineContext) => {
        ctx.emit(
          createEvent("agent:escalate-request", {
            agentId: "agent-test",
            reason: "missing_dependency",
            details: "blocked",
            severity: "blocking",
          })
        );
        ctx.set("pipelineSuspend", { reason: "agent_escalation" });
        return Promise.resolve(input);
      },
    };

    // Register minimal stages up through plan so the runner hits our suspend.
    runner
      .registerStage(stageInit)
      .registerStage(stageContext)
      .registerStage(stagePlan);

    const events: PipelineEvent[] = [];
    const input: PipelineInput = {
      runId: "run-test",
      requirement: "req",
      workspace: process.cwd(),
      userId: "user-test",
    };

    for await (const e of runner.run(input)) {
      events.push(e);
    }

    expect(events.some((e) => e.type === "pipeline:suspend")).toBe(true);
  });

  it("does not suspend for warning escalations unless pipelineSuspend is set", async () => {
    const runner = new PipelineRunner();

    const stageInit: PipelineStage<unknown, unknown> = {
      name: "init",
      execute: (input) => Promise.resolve(input),
    };

    const stageContext: PipelineStage<unknown, unknown> = {
      name: "context",
      execute: (input) => Promise.resolve(input),
    };

    const stagePlan: PipelineStage<unknown, unknown> = {
      name: "plan",
      execute: (input, ctx: PipelineContext) => {
        ctx.emit(
          createEvent("agent:escalate-request", {
            agentId: "agent-test",
            reason: "missing_dependency",
            details: "warn",
            severity: "warning",
          })
        );
        return Promise.resolve(input);
      },
    };

    const stageSchedule: PipelineStage<unknown, unknown> = {
      name: "schedule",
      execute: (input) => Promise.resolve(input),
    };

    const stageExecute: PipelineStage<unknown, unknown> = {
      name: "execute",
      execute: (input) => Promise.resolve(input),
    };

    const stageReview: PipelineStage<unknown, unknown> = {
      name: "review",
      execute: (input) => Promise.resolve(input),
    };

    const stageLearn: PipelineStage<unknown, unknown> = {
      name: "learn",
      execute: (input) => Promise.resolve(input),
    };

    const stageSummarize: PipelineStage<unknown, unknown> = {
      name: "summarize",
      execute: (input) => Promise.resolve(input),
    };

    runner
      .registerStage(stageInit)
      .registerStage(stageContext)
      .registerStage(stagePlan)
      .registerStage(stageSchedule)
      .registerStage(stageExecute)
      .registerStage(stageReview)
      .registerStage(stageLearn)
      .registerStage(stageSummarize);

    const events: PipelineEvent[] = [];
    const input: PipelineInput = {
      runId: "run-test",
      requirement: "req",
      workspace: process.cwd(),
      userId: "user-test",
    };

    for await (const e of runner.run(input)) {
      events.push(e);
    }

    expect(events.some((e) => e.type === "pipeline:suspend")).toBe(false);
    expect(events.some((e) => e.type === "pipeline:complete")).toBe(true);
  });
});
