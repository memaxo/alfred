import { z } from "zod";

export const capabilityRiskSchema = z.enum(["low", "medium", "high"]);

export const capabilityDescriptorSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  category: z.string().min(1),
  risk: capabilityRiskSchema,
  requiresAuth: z.boolean().optional(),
  requiresElevation: z.boolean().optional(),
  uiOnly: z.boolean().optional(),
  webWindowType: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

export const capabilityListSchema = z.array(capabilityDescriptorSchema);
