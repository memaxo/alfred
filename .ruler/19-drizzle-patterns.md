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

8. **Safe tsquery generation.** When constructing `tsquery` for search, always use `plainto_tsquery('english', ...)` for user input or `sql.join(..., sql` || `)` for combining queries. Never string-template raw variables into `to_tsquery` without sanitization.

9. **Performance.** All queries must complete in <10ms (p99). Use indexes for all WHERE clauses. Prefer batch operations over loops. Keep transactions short (<100ms).

10. **Bulk updates.** For bulk updates of the same column (e.g., confidence decay), prefer single SQL `UPDATE ... FROM (VALUES ...)` statement over `Promise.all` loops. This reduces DB roundtrips and improves performance. Example:
    ```typescript
    // ✅ CORRECT: Single SQL statement
    await db.update(table)
      .set({ confidence: sql`excluded.confidence` })
      .from(sql`(VALUES ${sql.join(updates.map(u => sql`(${u.id}, ${u.confidence})`), sql`, `)}) AS excluded(id, confidence)`)
      .where(sql`table.id = excluded.id`);
    
    // ❌ INCORRECT: Promise.all loop (many roundtrips)
    await Promise.all(updates.map(u => updateNodeConfidence(u.id, u.confidence)));
    ```

