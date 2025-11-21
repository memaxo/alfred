# Drizzle Query Patterns

## Core Principle

Use Drizzle ORM's type-safe query builder consistently. Leverage TypeScript inference, optimize with indexes, and avoid anti-patterns that reduce type safety or performance.

## Rules

1. **Type-safe queries.** Always use Drizzle's query builder (`db.select().from(table).where(...)`), never raw SQL (`db.execute(sql`...`)`).

2. **Query inference.** Use `typeof table.$inferSelect` and `typeof table.$inferInsert` for types.

3. **Index usage.** Match query predicates to composite indexes. Use `and()`/`or()` for compound conditions.

4. **Batch operations.** Use `db.batch([...])` for multiple independent queries instead of loops.

5. **Transactions.** Use `db.transaction(async (tx) => {...})` for atomic operations. Keep transactions short.

6. **Returning clauses.** Use `.returning()` to get inserted/updated rows instead of separate SELECT queries.

7. **JSONB handling.** Use `as any` for JSONB fields (Drizzle limitation). Document this pattern in code comments.

8. **Performance.** All queries must complete in <10ms (p99). Use indexes for all WHERE clauses. Prefer batch operations over loops. Keep transactions short (<100ms).

