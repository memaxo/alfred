# Add tRPC Router

## Overview

Add a new tRPC router to the API package following established patterns.

## File Structure

```
packages/api/src/routers/<name>.ts
```

## Implementation Steps

### 1. Create Router File

```typescript
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const <name>Router = createTRPCRouter({
  // Queries (read operations)
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      // Use ctx.session.user.id for user-scoped queries
      return await repo.list(ctx.session.user.id, input.limit);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const item = await repo.get(input.id);
      if (!item || item.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return item;
    }),

  // Mutations (write operations)
  create: protectedProcedure
    .input(z.object({
      // Define input schema
    }))
    .mutation(async ({ ctx, input }) => {
      return await repo.create({
        userId: ctx.session.user.id,
        ...input,
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      // Fields to update
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await repo.get(input.id);
      if (!existing || existing.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return await repo.update(input.id, input);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await repo.get(input.id);
      if (!existing || existing.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await repo.delete(input.id);
      return { success: true };
    }),
});
```

### 2. Register Router

Add to `packages/api/src/index.ts`:

```typescript
import { <name>Router } from "./routers/<name>";

export const appRouter = createTRPCRouter({
  // ... existing routers
  <name>: <name>Router,
});
```

### 3. Add Tests

Create `packages/api/test/<name>.test.ts`:

- Test each procedure
- Test authorization (user can only access own data)
- Test validation (invalid inputs rejected)
- Test error cases (not found, unauthorized)

## Patterns to Follow

### Protected vs Public

- `protectedProcedure` - Requires authentication
- `publicProcedure` - No auth required (rare)

### Error Handling

```typescript
throw new TRPCError({
  code: "NOT_FOUND", // or UNAUTHORIZED, BAD_REQUEST, etc.
  message: "optional_error_code",
});
```

### Input Validation

- Always use Zod schemas
- Add `.default()` for optional fields with defaults
- Use `.uuid()` for IDs

### User Scoping

- Always filter by `ctx.session.user.id`
- Check ownership before update/delete
- Never expose other users' data

## Reference

See existing routers: `packages/api/src/routers/note.ts`, `remind.ts`
