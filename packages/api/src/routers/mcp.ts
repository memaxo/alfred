import {
  createMcpServer,
  deleteMcpServer,
  listMcpServers,
  updateMcpServer,
} from "@alfred/db/repo/mcp";
import type { McpAuthType, McpTransport } from "@alfred/db/schema/mcp";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

const labelSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-z][a-z0-9_]*$/, "label_must_be_snake_case");

const transportSchema = z.enum(["http", "sse", "streamable-http"]);

const authTypeSchema = z.enum(["none", "bearer"]);

const bearerEnvSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[A-Z][A-Z0-9_]*$/, "env_must_be_upper_snake_case");

const createSchema = z
  .object({
    label: labelSchema,
    url: z.string().url(),
    transport: transportSchema.default("http"),
    enabled: z.boolean().default(true),
    authType: authTypeSchema.default("none"),
    bearerEnv: bearerEnvSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.authType === "bearer" && !value.bearerEnv) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bearerEnv"],
        message: "bearer_env_required",
      });
    }
  });

const updateSchema = z
  .object({
    id: z.string().min(1),
    label: labelSchema.optional(),
    url: z.string().url().optional(),
    transport: transportSchema.optional(),
    enabled: z.boolean().optional(),
    authType: authTypeSchema.optional(),
    bearerEnv: bearerEnvSchema.optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.authType === "bearer" && value.bearerEnv == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bearerEnv"],
        message: "bearer_env_required",
      });
    }
  });

export const mcpRouter = router({
  list: authedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const rows = await listMcpServers(userId);
    return Array.isArray(rows) ? rows : [];
  }),

  create: authedProcedure
    .input(createSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const authType = input.authType as McpAuthType;
      const transport = input.transport as McpTransport;
      const auth =
        authType === "bearer" ? { bearerEnv: input.bearerEnv ?? null } : null;

      const row = await createMcpServer(userId, {
        label: input.label,
        url: input.url,
        transport,
        authType,
        auth,
        enabled: input.enabled,
      });

      return row;
    }),

  update: authedProcedure
    .input(updateSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const authType = input.authType as McpAuthType | undefined;
      const auth =
        authType === "bearer"
          ? { bearerEnv: input.bearerEnv ?? null }
          : authType
            ? null
            : undefined;

      const row = await updateMcpServer(userId, input.id, {
        ...(input.label ? { label: input.label } : {}),
        ...(input.url ? { url: input.url } : {}),
        ...(input.transport ? { transport: input.transport } : {}),
        ...(typeof input.enabled === "boolean"
          ? { enabled: input.enabled }
          : {}),
        ...(authType ? { authType } : {}),
        ...(auth !== undefined ? { auth } : {}),
      });

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "mcp_not_found" });
      }

      return row;
    }),

  delete: authedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const removed = await deleteMcpServer(userId, input.id);
      return { removed };
    }),
});
