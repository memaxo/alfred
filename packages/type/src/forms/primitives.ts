import { z } from "zod";

export const nonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Required",
  });

export const emailSchema = z.email("Invalid email address");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");
