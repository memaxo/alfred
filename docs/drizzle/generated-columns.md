---
title: Drizzle ORM - Generated Columns
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

# Generated Columns

To use this feature you would need to have `drizzle-orm@0.32.0` or higher and `drizzle-kit@0.23.0` or higher

Generated columns in SQL are a feature that allows you to create columns in a table whose values are automatically computed based on expressions involving other columns within the same table. This can help ensure data consistency, simplify database design, and improve query performance.

There are two types of generated columns:

1. Virtual (or non-persistent) Generated Columns: These columns are computed dynamically whenever they are queried. They do not occupy storage space in the database.

2. Stored (or persistent) Generated Columns: These columns are computed when a row is inserted or updated and their values are stored in the database. This allows them to be indexed and can improve query performance since the values do not need to be recomputed for each query.


Generated columns can be especially useful for:

- Deriving new data from existing columns
- Automating calculations to avoid manual updates
- Enforcing data integrity and consistency
- Simplifying application logic by keeping complex calculations within the database schema

The implementation and usage of generated columns can vary significantly across different SQL databases. PostgreSQL, MySQL, and SQLite each have unique features, capabilities, and limitations when it comes to generated columns. In this section, we will explore these differences in detail to help you understand how to best utilize generated columns in each database system.

PostgreSQL

MySQL

SQLite

SingleStore(WIP)

#### Database side

**Types**: `STORED` only

**How It Works**

- Automatically computes values based on other columns during insert or update.

**Capabilities**

- Simplifies data access by precomputing complex expressions.
- Enhances query performance with index support on generated columns.

**Limitations**

- Cannot specify default values.
- Expressions cannot reference other generated columns or include subqueries.
- Schema changes required to modify generated column expressions.
- Cannot directly use in primary keys, foreign keys, or unique constraints

For more info, please check [PostgreSQL](https://www.postgresql.org/docs/current/ddl-generated-columns.html) docs

#### Drizzle side

In Drizzle you can specify `.generatedAlwaysAs()` function on any column type and add a supported sql query,
that will generate this column data for you.

#### Features

This function can accept generated expression in 3 ways:

**`string`**

```
export const test = pgTable("test", {
    generatedName: text("gen_name").generatedAlwaysAs(`hello world!`),
});
```

```
CREATE TABLE IF NOT EXISTS "test" (
    "gen_name" text GENERATED ALWAYS AS (hello world!) STORED
);
```

**`sql`** tag - if you want drizzle to escape some values for you

```
export const test = pgTable("test", {
    generatedName: text("gen_name").generatedAlwaysAs(sql`hello "world"!`),
});
```

```
CREATE TABLE IF NOT EXISTS "test" (
    "gen_name" text GENERATED ALWAYS AS (hello "world"!) STORED
);
```

**`callback`** \- if you need to reference columns from a table

```
export const test = pgTable("test", {
    name: text("first_name"),
    generatedName: text("gen_name").generatedAlwaysAs(
      (): SQL => sql`hi, ${test.name}!`
    ),
});
```

```
CREATE TABLE IF NOT EXISTS "test" (
    "first_name" text,
    "gen_name" text GENERATED ALWAYS AS (hi, "test"."first_name"!) STORED
);
```

**Example** generated columns with full-text search

schema.ts

```
import { SQL, sql } from "drizzle-orm";
import { customType, index, integer, pgTable, text } from "drizzle-orm/pg-core";

const tsVector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const test = pgTable(
  "test",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    content: text("content"),
    contentSearch: tsVector("content_search", {
      dimensions: 3,
    }).generatedAlwaysAs(
      (): SQL => sql`to_tsvector('english', ${test.content})`
    ),
  },
  (t) => [\
    index("idx_content_search").using("gin", t.contentSearch)\
  ]
);
```

```
CREATE TABLE IF NOT EXISTS "test" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "test_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"content" text,
	"content_search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', "test"."content")) STORED
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_content_search" ON "test" USING gin ("content_search");
```

#### Database side

**Types**: `STORED`, `VIRTUAL`

**How It Works**

- Defined with an expression in the table schema.
- Virtual columns are computed during read operations.
- Stored columns are computed during write operations and stored.

**Capabilities**

- Used in SELECT, INSERT, UPDATE, and DELETE statements.
- Can be indexed, both virtual and stored.
- Can specify NOT NULL and other constraints.

**Limitations**

- Cannot directly insert or update values in a generated column

For more info, please check [MySQL Alter Generated](https://dev.mysql.com/doc/refman/8.4/en/alter-table-generated-columns.html) docs and [MySQL create generated](https://dev.mysql.com/doc/refman/8.4/en/create-table-generated-columns.html) docs

#### Drizzle side

#### Features

**`string`**

```
export const test = mysqlTable("test", {
    generatedName: text("gen_name").generatedAlwaysAs(`hello world!`),
});
```

```
CREATE TABLE `test` (
    `gen_name` text GENERATED ALWAYS AS (hello world!) VIRTUAL
);
```

**`sql`** tag - if you want drizzle to escape some values for you

```
export const test = mysqlTable("test", {
    generatedName: text("gen_name").generatedAlwaysAs(sql`hello "world"!`),
});
```

```
CREATE TABLE `test` (
    `gen_name` text GENERATED ALWAYS AS (hello "world"!) VIRTUAL
);
```

**`callback`** \- if you need to reference columns from a table

```
export const test = mysqlTable("test", {
    name: text("first_name"),
    generatedName: text("gen_name").generatedAlwaysAs(
      (): SQL => sql`hi, ${test.name}!`
    ),
});
```

```
CREATE TABLE `test` (
	`first_name` text,
	`gen_name` text GENERATED ALWAYS AS (hi, `test`.`first_name`!) VIRTUAL
);
```

#### Limitations

Drizzle Kit will also have limitations for `push` command:

1. You can’t change the generated constraint expression and type using `push`. Drizzle-kit will ignore this change. To make it work, you would need to `drop the column`, `push`, and then `add a column with a new expression`. This was done due to the complex mapping from the database side, where the schema expression will be modified on the database side and, on introspection, we will get a different string. We can’t be sure if you changed this expression or if it was changed and formatted by the database. As long as these are generated columns and `push` is mostly used for prototyping on a local database, it should be fast to `drop` and `create` generated columns. Since these columns are `generated`, all the data will be restored
2. `generate` should have no limitations

schema.ts

```
export const users = mysqlTable("users", {
    id: int("id"),
    id2: int("id2"),
    name: text("name"),
    storedGenerated: text("stored_gen").generatedAlwaysAs(
      (): SQL => sql`${users.name} || 'hello'`,
      { mode: "stored" }
    ),
    virtualGenerated: text("virtual_gen").generatedAlwaysAs(
      (): SQL => sql`${users.name} || 'hello'`,
      { mode: "virtual" }
    ),
})
```

```
CREATE TABLE `users` (
    `id` int,
    `id2` int,
    `name` text,
    `stored_gen` text GENERATED ALWAYS AS (`users`.`name` || 'hello') STORED,
    `virtual_gen` text GENERATED ALWAYS AS (`users`.`name` || 'hello') VIRTUAL
);
```

#### Database side

**Types**: `STORED`, `VIRTUAL`

**How It Works**

- Defined with an expression in the table schema.
- Virtual columns are computed during read operations.
- Stored columns are computed during write operations and stored.

**Capabilities**

- Used in SELECT, INSERT, UPDATE, and DELETE statements.
- Can be indexed, both virtual and stored.
- Can specify NOT NULL and other constraints.

**Limitations**

- Cannot directly insert or update values in a generated column

For more info, please check [SQLite](https://www.sqlite.org/gencol.html) docs

#### Drizzle side

#### Features

**`string`**

```
export const test = sqliteTable("test", {
    generatedName: text("gen_name").generatedAlwaysAs(`hello world!`),
});
```

```
CREATE TABLE `test` (
    `gen_name` text GENERATED ALWAYS AS (hello world!) VIRTUAL
);
```

**`sql`** tag - if you want drizzle to escape some values for you

```
export const test = sqliteTable("test", {
    generatedName: text("gen_name").generatedAlwaysAs(sql`hello "world"!`),
});
```

```
CREATE TABLE `test` (
    `gen_name` text GENERATED ALWAYS AS (hello "world"!) VIRTUAL
);
```

**`callback`** \- if you need to reference columns from a table

```
export const test = sqliteTable("test", {
    name: text("first_name"),
    generatedName: text("gen_name").generatedAlwaysAs(
      (): SQL => sql`hi, ${test.name}!`
    ),
});
```

```
CREATE TABLE `test` (
    `first_name` text,
    `gen_name` text GENERATED ALWAYS AS (hi, "first_name"!) VIRTUAL
);
```

#### Limitations

Drizzle Kit will also have limitations for `push` and `generate` command:

1. You can’t change the generated constraint expression with the stored type in an existing table. You would need to delete this table and create it again. This is due to SQLite limitations for such actions. We will handle this case in future releases (it will involve the creation of a new table with data migration).
2. You can’t add a `stored` generated expression to an existing column for the same reason as above. However, you can add a `virtual` expression to an existing column.
3. You can’t change a `stored` generated expression in an existing column for the same reason as above. However, you can change a `virtual` expression.
4. You can’t change the generated constraint type from `virtual` to `stored` for the same reason as above. However, you can change from `stored` to `virtual`.

index.ts

schema.ts

```
export const users = sqliteTable("users", {
  id: int("id"),
  name: text("name"),
  storedGenerated: text("stored_gen").generatedAlwaysAs(
    (): SQL => sql`${users.name} || 'hello'`,
    { mode: "stored" }
  ),
  virtualGenerated: text("virtual_gen").generatedAlwaysAs(
    (): SQL => sql`${users.name} || 'hello'`,
    { mode: "virtual" }
  ),
});
```

```
CREATE TABLE `users` (
    `id` integer,
    `name` text,
    `stored_gen` text GENERATED ALWAYS AS ("name" || 'hello') STORED,
    `virtual_gen` text GENERATED ALWAYS AS ("name" || 'hello') VIRTUAL
);
```

Work in Progress