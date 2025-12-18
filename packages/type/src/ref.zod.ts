import { z } from "zod";

export const nodeIdRefSchema = z.object({
  dbId: z
    .union([
      // Postgres UUID (production).
      z
        .string()
        .uuid(),
      // SQLite defaultRandom() uuid fallback (Bun tests): lower(hex(randomblob(16))).
      z
        .string()
        .regex(/^[0-9a-f]{32}$/i),
    ])
    .optional(),
  hgHash: z.string().min(1).optional(),
  uiId: z.string().min(1).optional(),
});

export const nodeRefSchema = z.object({
  id: nodeIdRefSchema,
  resource: z.string().min(1),
});
