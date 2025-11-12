---
title: Drizzle ORM - Nile
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

# Drizzle <> Nile

This guide assumes familiarity with:

- Database [connection basics](https://orm.drizzle.team/docs/connect-overview) with Drizzle
- Nile Database - [website](https://thenile.dev/)
- Drizzle PostgreSQL drivers - [docs](https://orm.drizzle.team/docs/get-started-postgresql)

According to the **[official website](https://thenile.dev/)**, Nile is PostgreSQL re-engineered for multi-tenant apps.

Checkout official **[Nile + Drizzle Quickstart](https://www.thenile.dev/docs/getting-started/languages/drizzle)** and **[Migration](https://www.thenile.dev/docs/getting-started/schema_migrations/drizzle)** docs.

You can use Nile with any of Drizzle’s Postgres drivers, we’ll be showing the use of `node-postgres` below.

#### Step 1 - Install packages

npm

yarn

pnpm

bun

```
npm i drizzle-orm postgres
npm i -D drizzle-kit
```

```
yarn add drizzle-orm postgres
yarn add -D drizzle-kit
```

```
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

```
bun add drizzle-orm postgres
bun add -D drizzle-kit
```

#### Step 2 - Initialize the driver and make a query

```
// Make sure to install the 'pg' package
import { drizzle } from 'drizzle-orm/node-postgres'

const db = drizzle(process.env.NILEDB_URL);

const response = await db.select().from(...);
```

If you need to provide your existing driver:

```
// Make sure to install the 'pg' package
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle({ client: pool });

const response = await db.select().from(...);
```

#### Connecting to a virtual tenant database

Nile provides virtual tenant databases, when you set the tenant context, Nile will direct your queries to the virtual database for this particular tenant and all queries will apply to that tenant (i.e. `select * from table` will result records only for this tenant).

In order to set the tenant context, we wrap each query in a transaction that sets the appropriate tenant context before running the transaction.

The tenant ID can simply be passed into the wrapper as an argument:

```
import { drizzle } from 'drizzle-orm/node-postgres';
import { todosTable, tenants } from "./db/schema";
import { sql } from 'drizzle-orm';
import 'dotenv/config';

const db = drizzle(process.env.NILEDB_URL);

function tenantDB<T>(tenantId: string, cb: (tx: any) => T | Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    if (tenantId) {
      await tx.execute(sql`set local nile.tenant_id = '${sql.raw(tenantId)}'`);
    }

    return cb(tx);
  }) as Promise<T>;
}

// In a webapp, you'll likely get it from the request path parameters or headers
const tenantId = '01943e56-16df-754f-a7b6-6234c368b400'

const response = await tenantDB(tenantId, async (tx) => {
    // No need for a "where" clause here
    return await tx.select().from(todosTable);
});

console.log(response);
```

If you are using a web framwork that supports it, you can set up [AsyncLocalStorage](https://nodejs.org/api/async_context.html) and use middleware to populate it with the tenant ID. In this case, your Drizzle client setup will be:

```
import { drizzle } from 'drizzle-orm/node-postgres';
import dotenv from "dotenv/config";
import { sql } from "drizzle-orm";
import { AsyncLocalStorage } from "async_hooks";

export const db = drizzle(process.env.NILEDB_URL);
export const tenantContext = new AsyncLocalStorage<string | undefined>();

export function tenantDB<T>(cb: (tx: any) => T | Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const tenantId = tenantContext.getStore();
    console.log("executing query with tenant: " + tenantId);
    // if there's a tenant ID, set it in the transaction context
    if (tenantId) {
      await tx.execute(sql`set local nile.tenant_id = '${sql.raw(tenantId)}'`);
    }

    return cb(tx);
  }) as Promise<T>;
}
```

And then, configure a middleware to populate the the AsyncLocalStorage and use `tenantDB` method when handling requests:

```
// Middleware to set tenant context
app.use("/api/tenants/:tenantId/*", async (c, next) => {
  const tenantId = c.req.param("tenantId");
  console.log("setting context to tenant: " + tenantId);
  return tenantContext.run(tenantId, () => next());
});

// Route handler
app.get("/api/tenants/:tenantId/todos", async (c) => {
    const todos = await tenantDB(c, async (tx) => {
      return await tx
        .select({
          id: todoSchema.id,
          tenant_id: todoSchema.tenantId,
          title: todoSchema.title,
          estimate: todoSchema.estimate,
        })
        .from(todoSchema);
    });
    return c.json(todos);
});
```

#### What’s next?

**Manage schema**

[Drizzle Schema](https://orm.drizzle.team/docs/sql-schema-declaration) [PostgreSQL data types](https://orm.drizzle.team/docs/column-types/pg) [Indexes and Constraints](https://orm.drizzle.team/docs/indexes-constraints) [Database Views](https://orm.drizzle.team/docs/views) [Database Schemas](https://orm.drizzle.team/docs/schemas) [Sequences](https://orm.drizzle.team/docs/sequences) [Extensions](https://orm.drizzle.team/docs/extensions/pg)

**Query data**

[Relational Queries](https://orm.drizzle.team/docs/rqb) [Select](https://orm.drizzle.team/docs/select) [Insert](https://orm.drizzle.team/docs/insert) [Update](https://orm.drizzle.team/docs/update) [Delete](https://orm.drizzle.team/docs/delete) [Filters](https://orm.drizzle.team/docs/operators) [Joins](https://orm.drizzle.team/docs/joins) [sql\`\` operator](https://orm.drizzle.team/docs/sql)