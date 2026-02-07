/**
 * Re-export barrel for backward compatibility.
 * The learning worker has been split into focused modules:
 *  - learning/worker.ts  — Polling loop, config, start/stop
 *  - learning/extract.ts — Knowledge extraction from runs
 *  - learning/maintain.ts — Memory maintenance (decay, pruning, embedding backfill)
 */
export {
  learnDomainCorrection,
  startLearningWorker,
  stopLearningWorker,
} from "./learning/index.js";
export type { LearningWorkerConfig } from "./learning/index.js";
