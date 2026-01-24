export { ContextStage } from "./context";
export { ExecuteStage } from "./execute";
export { InitStage } from "./init";
export { LearnStage } from "./learn";
export { PlanStage } from "./plan";
export { ReviewStage } from "./review";
export { ScheduleStage } from "./schedule";
export { SummarizeStage } from "./summarize";
export * from "./types";

import type { PipelineRunner } from "../runner";

import { ContextStage } from "./context";
import { ExecuteStage } from "./execute";
import { InitStage } from "./init";
import { LearnStage } from "./learn";
import { PlanStage } from "./plan";
import { ReviewStage } from "./review";
import { ScheduleStage } from "./schedule";
import { SummarizeStage } from "./summarize";

export function registerDefaultStages(runner: PipelineRunner): PipelineRunner {
  return runner
    .registerStage(new InitStage())
    .registerStage(new ContextStage())
    .registerStage(new PlanStage())
    .registerStage(new ScheduleStage())
    .registerStage(new ExecuteStage())
    .registerStage(new ReviewStage())
    .registerStage(new LearnStage())
    .registerStage(new SummarizeStage());
}
