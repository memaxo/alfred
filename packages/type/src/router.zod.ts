import { z } from "zod";

export const threadSchema = z.string().optional();

export const resourceSchema = z.string().optional();

export const toolChoiceSchema = z.enum(["auto", "none", "required"]).optional();

export function maxStepsSchema(max: number) {
  return z.number().int().min(1).max(max).optional();
}
