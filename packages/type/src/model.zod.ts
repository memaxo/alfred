import { z } from "zod";

import type { ModelProvider, ModelRef, ModelRole } from "./model";

import { MODEL_PROVIDERS, MODEL_ROLES } from "./model";

export const modelRoleSchema = z.enum(
  MODEL_ROLES satisfies readonly [ModelRole, ...ModelRole[]]
);

export const modelProviderSchema = z.enum(
  MODEL_PROVIDERS satisfies readonly [ModelProvider, ...ModelProvider[]]
);

export const modelRefSchema: z.ZodType<ModelRef> = z
  .string()
  .trim()
  .min(1)
  .superRefine((value, ctx) => {
    const i = value.indexOf(":");
    if (i === -1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "model_ref_missing_colon",
      });
      return;
    }

    const provider = value.slice(0, i).trim();
    if (provider.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "model_ref_provider_empty",
      });
      return;
    }

    const modelId = value.slice(i + 1).trim();
    if (modelId.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "model_ref_modelid_empty",
      });
      return;
    }

    const p = modelProviderSchema.safeParse(provider);
    if (!p.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "model_ref_provider_unknown",
      });
    }
  })
  .transform((value) => {
    const i = value.indexOf(":");
    const provider = value.slice(0, i).trim();
    const modelId = value.slice(i + 1).trim();
    return `${provider}:${modelId}` as ModelRef;
  });
