import type { z } from "zod";

import type {
  executorConfigPublicSchema,
  executorConfigWriteSchema,
  executorHealthSchema,
  executorKindSchema,
  executorStatusSchema,
} from "./executor.zod";

export type ExecutorKind = z.infer<typeof executorKindSchema>;

export type ExecutorConfigWrite = z.infer<typeof executorConfigWriteSchema>;
export type ExecutorConfigPublic = z.infer<typeof executorConfigPublicSchema>;

export type ExecutorStatus = z.infer<typeof executorStatusSchema>;
export type ExecutorHealth = z.infer<typeof executorHealthSchema>;
