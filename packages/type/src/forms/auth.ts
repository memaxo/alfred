import { z } from "zod";

import {
  emailSchema,
  nonEmptyStringSchema,
  passwordSchema,
} from "./primitives";

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signUpSchema = z.object({
  name: nonEmptyStringSchema.min(2, "Name must be at least 2 characters"),
  email: emailSchema,
  password: passwordSchema,
});
