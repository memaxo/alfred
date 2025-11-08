# Drizzle Query Patterns

## Core Principle

Use Drizzle ORM's type-safe query builder consistently. Leverage TypeScript inference, optimize with indexes, and avoid anti-patterns that reduce type safety or performance.

## Rules

1. **Type-safe queries.** Always use Drizzle's query builder, never raw SQL:
   ```typescript
   // ✅ Type-safe query
   const [row] = await db
     .select()
     .from(workflowRuns)
     .where(eq(workflowRuns.id, runId))
     .limit(1);
   
   // ❌ Raw SQL (loses type safety)
   await db.execute(sql`SELECT * FROM workflow_runs WHERE id = ${runId}`);
   ```

2. **Query inference.** Use Drizzle's inferred types:
   ```typescript
   type WorkflowRun = typeof workflowRuns.$inferSelect;
   type WorkflowRunInsert = typeof workflowRuns.$inferInsert;
   ```

3. **Index usage.** Match query predicates to composite indexes:
   ```typescript
   // Index: (user_id, status)
   await db
     .select()
     .from(workflowRuns)
     .where(
       and(
         eq(workflowRuns.userId, userId),
         eq(workflowRuns.status, "running")
       )
     );
   ```

4. **Batch operations.** Use `db.batch()` for multiple independent queries:
   ```typescript
   await db.batch([
     db.select().from(users).where(...),
     db.select().from(profiles).where(...),
   ]);
   ```

5. **Transactions.** Use `db.transaction()` for atomic operations:
   ```typescript
   await db.transaction(async (tx) => {
     await tx.insert(users).values({...});
     await tx.insert(profiles).values({...});
   });
   ```

6. **Returning clauses.** Use `.returning()` to get inserted/updated rows:
   ```typescript
   const [row] = await db
     .insert(workflowRuns)
     .values({...})
     .returning();
   ```

7. **JSONB handling.** Use `as any` for JSONB fields (Drizzle limitation):
   ```typescript
   inputData: args.inputData as any,
   stateData: args.stateData as any,
   ```
   Document this pattern in code comments.

## Anti-patterns

```typescript
// ❌ Raw SQL without type safety
await db.execute(sql`SELECT * FROM users`);

// ❌ Missing index usage
await db.select().from(users).where(eq(users.email, email));
// Should have index on email

// ❌ N+1 queries
for (const id of ids) {
  await db.select().from(users).where(eq(users.id, id));
}
// ✅ Use batch or IN clause
await db.select().from(users).where(inArray(users.id, ids));

// ❌ Missing returning clause
await db.insert(users).values({...});
const user = await db.select().from(users).where(...);
// ✅ Use returning
const [user] = await db.insert(users).values({...}).returning();
```

## Performance Guidelines

- All queries must complete in <10ms (p99)
- Use indexes for all WHERE clauses
- Prefer batch operations over loops
- Keep transactions short (<100ms)

## Examples

```typescript
// ✅ Complete pattern with type safety
export async function getRun(runId: string) {
  const [row] = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.id, runId))
    .limit(1);
  return row ?? null;
}

// ✅ Batch query pattern
export async function getMultipleRuns(runIds: string[]) {
  const results = await db.batch([
    db.select().from(workflowRuns).where(inArray(workflowRuns.id, runIds)),
    db.select().from(workflowEvents).where(inArray(workflowEvents.runId, runIds)),
  ]);
  return { runs: results[0], events: results[1] };
}
```

