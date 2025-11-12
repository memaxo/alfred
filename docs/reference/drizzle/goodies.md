---
title: Drizzle ORM - Goodies
url: 
description: Drizzle ORM is a lightweight and performant TypeScript ORM with developer experience in mind.
language: en
---

[Drizzle Studio Gateway is now FREE 👀](https://gateway.drizzle.team/)

[v1.0\\
\\
75%](https://orm.drizzle.team/roadmap)

[Benchmarks](https://orm.drizzle.team/benchmarks) [Extension](https://driz.link/extension) [Studio](https://orm.drizzle.team/drizzle-studio/overview) [Studio Package](https://github.com/drizzle-team/drizzle-studio-npm) [Gateway](https://gateway.drizzle.team/) [Drizzle Run](https://drizzle.run/)

Our goodies!

[![](<Base64-Image-Removed>)![Gel](<Base64-Image-Removed>)](https://driz.link/edgedb)

[![](<Base64-Image-Removed>)![Turso](<Base64-Image-Removed>)\\
\\
🚀 Drizzle is giving you 10% off Turso Scaler and Pro for 1 Year 🚀](https://driz.link/turso) [![](<Base64-Image-Removed>)![Payload](<Base64-Image-Removed>)](https://driz.link/payload) [![](<Base64-Image-Removed>)![Xata](<Base64-Image-Removed>)](https://driz.link/xataio) [![](<Base64-Image-Removed>)![Neon](<Base64-Image-Removed>)](https://driz.link/neon) [![](<Base64-Image-Removed>)![Nuxt](<Base64-Image-Removed>)](https://hub.nuxt.com/?utm_source=drizzle-docs) [![](<Base64-Image-Removed>)![SQLite Cloud](<Base64-Image-Removed>)](https://driz.link/sqlitecloud) [![](<Base64-Image-Removed>)![Upstash](<Base64-Image-Removed>)](https://driz.link/upstash) [![](<Base64-Image-Removed>)![SingleStore](<Base64-Image-Removed>)](https://driz.link/singlestore) [![](<Base64-Image-Removed>)![Lokalise](<Base64-Image-Removed>)](https://driz.link/lokalise) [![](<Base64-Image-Removed>)![Replit](<Base64-Image-Removed>)](https://driz.link/replit) [![](<Base64-Image-Removed>)![Sentry](<Base64-Image-Removed>)](https://driz.link/sentry) [![](<Base64-Image-Removed>)![Sevalla](<Base64-Image-Removed>)](https://driz.link/sevalla) [![](<Base64-Image-Removed>)![GibsonAI](<Base64-Image-Removed>)](https://driz.link/gibsonai) [![](<Base64-Image-Removed>)![Sponsor](<Base64-Image-Removed>)](https://driz.link/sponsor)

Product by Drizzle Team

[One Dollar Stats$1 per mo web analytics\\
\\
christmas\\
\\
deal](https://driz.link/onedollarstats)

## Type API

To retrieve a type from your table schema for `select` and `insert` queries, you can make use of our type helpers.

PostgreSQL

MySQL

SQLite

SingleStore

```
import { serial, text, pgTable } from 'drizzle-orm/pg-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm'

const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
});

type SelectUser = typeof users.$inferSelect;
type InsertUser = typeof users.$inferInsert;
// or
type SelectUser = typeof users._.$inferSelect;
type InsertUser = typeof users._.$inferInsert;
// or
type SelectUser = InferSelectModel<typeof users>;
type InsertUser = InferInsertModel<typeof users>;
```

```
import { int, text, mysqlTable } from 'drizzle-orm/mysql-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm'

const users = mysqlTable('users', {
  id: int('id').primaryKey(),
  name: text('name').notNull(),
});

type SelectUser = typeof users.$inferSelect;
type InsertUser = typeof users.$inferInsert;
// or
type SelectUser = typeof users._.$inferSelect;
type InsertUser = typeof users._.$inferInsert;
// or
type SelectUser = InferSelectModel<typeof users>;
type InsertUser = InferInsertModel<typeof users>;
```

```
import { int, text, sqliteTable } from 'drizzle-orm/sqlite-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm'

const users = sqliteTable('users', {
  id: int('id').primaryKey(),
  name: text('name').notNull(),
});

type SelectUser = typeof users.$inferSelect;
type InsertUser = typeof users.$inferInsert;
// or
type SelectUser = typeof users._.$inferSelect;
type InsertUser = typeof users._.$inferInsert;
// or
type SelectUser = InferSelectModel<typeof users>;
type InsertUser = InferInsertModel<typeof users>;
```

```
import { int, text, singlestoreTable } from 'drizzle-orm/singlestore-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm'

const users = singlestoreTable('users', {
  id: int('id').primaryKey(),
  name: text('name').notNull(),
});

type SelectUser = typeof users.$inferSelect;
type InsertUser = typeof users.$inferInsert;
// or
type SelectUser = typeof users._.$inferSelect;
type InsertUser = typeof users._.$inferInsert;
// or
type SelectUser = InferSelectModel<typeof users>;
type InsertUser = InferInsertModel<typeof users>;
```

## Logging

To enable default query logging, just pass `{ logger: true }` to the `drizzle` initialization function:

```
import { drizzle } from 'drizzle-orm/...'; // driver specific

const db = drizzle({ logger: true });
```

You can change the logs destination by creating a `DefaultLogger` instance and providing a custom `writer` to it:

```
import { DefaultLogger, LogWriter } from 'drizzle-orm/logger';
import { drizzle } from 'drizzle-orm/...'; // driver specific

class MyLogWriter implements LogWriter {
  write(message: string) {
    // Write to file, stdout, etc.
  }
}

const logger = new DefaultLogger({ writer: new MyLogWriter() });
const db = drizzle({ logger });
```

You can also create a custom logger:

```
import { Logger } from 'drizzle-orm/logger';
import { drizzle } from 'drizzle-orm/...'; // driver specific

class MyLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    console.log({ query, params });
  }
}

const db = drizzle({ logger: new MyLogger() });
```

## Multi-project schema

**Table creator** API lets you define customise table names.

It’s very useful when you need to keep schemas of different projects in one database.

PostgreSQL

MySQL

SQLite

SingleStore

```
import { serial, text, pgTableCreator } from 'drizzle-orm/pg-core';

const pgTable = pgTableCreator((name) => `project1_${name}`);

const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
});
```

```
import { int, text, mysqlTableCreator } from 'drizzle-orm/mysql-core';

const mysqlTable = mysqlTableCreator((name) => `project1_${name}`);

const users = mysqlTable('users', {
  id: int('id').primaryKey(),
  name: text('name').notNull(),
});
```

```
import { int, text, sqliteTableCreator } from 'drizzle-orm/sqlite-core';

const sqliteTable = sqliteTableCreator((name) => `project1_${name}`);

const users = sqliteTable('users', {
  id: int('id').primaryKey(),
  name: text('name').notNull(),
});
```

```
import { int, text, singlestoreTableCreator } from 'drizzle-orm/singlestore-core';

const mysqlTable = singlestoreTableCreator((name) => `project1_${name}`);

const users = singlestoreTable('users', {
  id: int('id').primaryKey(),
  name: text('name').notNull(),
});
```

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/*",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  }
  tablesFilter: ["project1_*"],
});
```

You can apply multiple `or` filters:

```
tablesFilter: ["project1_*", "project2_*"]
```

## Printing SQL query

You can print SQL queries with `db` instance or by using **[`standalone query builder`](https://orm.drizzle.team/docs/goodies#standalone-query-builder)**.

```
const query = db
  .select({ id: users.id, name: users.name })
  .from(users)
  .groupBy(users.id)
  .toSQL();
// query:
{
  sql: 'select 'id', 'name' from 'users' group by 'users'.'id'',
  params: [],
}
```

## Raw SQL queries execution

If you have some complex queries to execute and `drizzle-orm` can’t handle them yet,
you can use the `db.execute` method to execute raw `parametrized` queries.

PostgreSQL

MySQL

SQLite

SingleStore

```
const statement = sql`select * from ${users} where ${users.id} = ${userId}`;
const res: postgres.RowList<Record<string, unknown>[]> = await db.execute(statement)
```

```
import { ..., MySqlQueryResult } from "drizzle-orm/mysql2";

const statement = sql`select * from ${users} where ${users.id} = ${userId}`;
const res: MySqlRawQueryResult = await db.execute(statement);
```

```
const statement = sql`select * from ${users} where ${users.id} = ${userId}`;

const res: unknown[] = db.all(statement)
const res: unknown = db.get(statement)
const res: unknown[][] = db.values(statement)
const res: Database.RunResult = db.run(statement)
```

```
import { ..., SingleStoreQueryResult } from "drizzle-orm/singlestore";

const statement = sql`select * from ${users} where ${users.id} = ${userId}`;
const res: SingleStoreRawQueryResult = await db.execute(statement);
```

## Standalone query builder

Drizzle ORM provides a standalone query builder that allows you to build queries
without creating a database instance and get generated SQL.

PostgreSQL

MySQL

SQLite

SingleStore

```
import { QueryBuilder } from 'drizzle-orm/pg-core';

const qb = new QueryBuilder();

const query = qb.select().from(users).where(eq(users.name, 'Dan'));
const { sql, params } = query.toSQL();
```

```
import { QueryBuilder } from 'drizzle-orm/mysql-core';

const qb = new QueryBuilder();

const query = qb.select().from(users).where(eq(users.name, 'Dan'));
const { sql, params } = query.toSQL();
```

```
import { QueryBuilder } from 'drizzle-orm/sqlite-core';

const qb = new QueryBuilder();

const query = qb.select().from(users).where(eq(users.name, 'Dan'));
const { sql, params } = query.toSQL();
```

```
import { QueryBuilder } from 'drizzle-orm/singlestore-core';

const qb = new QueryBuilder();

const query = qb.select().from(users).where(eq(users.name, 'Dan'));
const { sql, params } = query.toSQL();
```

## Get typed table columns

You can get a typed table columns map,
very useful when you need to omit certain columns upon selection.

PostgreSQL

MySQL

SQLite

SingleStore

index.ts

schema.ts

```
import { getTableColumns } from "drizzle-orm";
import { user } from "./schema";

const { password, role, ...rest } = getTableColumns(user);

await db.select({ ...rest }).from(users);
```

```
import { serial, text, pgTable } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  password: text("password"),
  role: text("role").$type<"admin" | "customer">(),
});
```

index.ts

schema.ts

```
import { getTableColumns } from "drizzle-orm";
import { user } from "./schema";

const { password, role, ...rest } = getTableColumns(user);

await db.select({ ...rest }).from(users);
```

```
import { int, text, mysqlTable } from "drizzle-orm/mysql-core";

export const user = mysqlTable("user", {
  id: int("id").primaryKey().autoincrement(),
  name: text("name"),
  email: text("email"),
  password: text("password"),
  role: text("role").$type<"admin" | "customer">(),
});
```

index.ts

schema.ts

```
import { getTableColumns } from "drizzle-orm";
import { user } from "./schema";

const { password, role, ...rest } = getTableColumns(user);

await db.select({ ...rest }).from(users);
```

```
import { integer, text, sqliteTable } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  email: text("email"),
  password: text("password"),
  role: text("role").$type<"admin" | "customer">(),
});
```

index.ts

schema.ts

```
import { getTableColumns } from "drizzle-orm";
import { user } from "./schema";

const { password, role, ...rest } = getTableColumns(user);

await db.select({ ...rest }).from(users);
```

```
import { int, text, mysqlTable } from "drizzle-orm/singlestore-core";

export const user = singlestoreTable("user", {
  id: int("id").primaryKey().autoincrement(),
  name: text("name"),
  email: text("email"),
  password: text("password"),
  role: text("role").$type<"admin" | "customer">(),
});
```

## Get table information

PostgreSQL

MySQL

SQLite

SingleStore

```
import { getTableConfig, pgTable } from 'drizzle-orm/pg-core';

export const table = pgTable(...);

const {
  columns,
  indexes,
  foreignKeys,
  checks,
  primaryKeys,
  name,
  schema,
} = getTableConfig(table);
```

```
import { getTableConfig, mysqlTable } from 'drizzle-orm/mysql-core';

export const table = mysqlTable(...);

const {
  columns,
  indexes,
  foreignKeys,
  checks,
  primaryKeys,
  name,
  schema,
} = getTableConfig(table);
```

```
import { getTableConfig, sqliteTable } from 'drizzle-orm/sqlite-core';

export const table = sqliteTable(...);

const {
  columns,
  indexes,
  foreignKeys,
  checks,
  primaryKeys,
  name,
  schema,
} = getTableConfig(table);
```

```
import { getTableConfig, mysqlTable } from 'drizzle-orm/singlestore-core';

export const table = singlestoreTable(...);

const {
  columns,
  indexes,
  checks,
  primaryKeys,
  name,
  schema,
} = getTableConfig(table);
```

## Compare objects types (instanceof alternative)

You can check if an object is of a specific Drizzle type using the `is()` function.
You can use it with any available type in Drizzle.

IMPORTANT

You should always use `is()` instead of `instanceof`

**Few examples**

```
import { Column, is } from 'drizzle-orm';

if (is(value, Column)) {
  // value's type is narrowed to Column
}
```

### Mock Driver

This API is a successor to an undefined `drizzle({} as any)` API which we’ve used internally in Drizzle tests and rarely recommended to external developers.

We decided to build and expose a proper API, every `drizzle` driver now has `drizzle.mock()`:

```
import { drizzle } from "drizzle-orm/node-postgres";

const db = drizzle.mock();
```

you can provide schema if necessary for types

```
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema"

const db = drizzle.mock({ schema });
```