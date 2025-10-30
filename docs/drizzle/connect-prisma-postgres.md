---
title: Drizzle ORM - Prisma Postgres
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

# Drizzle <> Prisma Postgres

This guide assumes familiarity with:

- Database [connection basics](https://orm.drizzle.team/docs/connect-overview) with Drizzle
- Prisma Postgres serverless database - [website](https://prisma.io/postgres)
- Prisma Postgres direct connections - [docs](https://www.prisma.io/docs/postgres/database/direct-connections)
- Drizzle PostgreSQL drivers - [docs](https://orm.drizzle.team/docs/get-started-postgresql)

Prisma Postgres is a serverless database built on [unikernels](https://www.prisma.io/blog/announcing-prisma-postgres-early-access). It has a large free tier, [operation-based pricing](https://www.prisma.io/blog/operations-based-billing) and no cold starts.

You can connect to it using either the [`node-postgres`](https://node-postgres.com/) or [`postgres.js`](https://github.com/porsager/postgres) drivers for PostgreSQL.

Prisma Postgres also has a [serverless driver](https://www.prisma.io/docs/postgres/database/serverless-driver) that will be supported with Drizzle ORM in the future.

#### Step 1 - Install packages

node-postgres (pg)

postgres.js

npm

yarn

pnpm

bun

```
npm i drizzle-orm pg
npm i -D drizzle-kit
```

```
yarn add drizzle-orm pg
yarn add -D drizzle-kit
```

```
pnpm add drizzle-orm pg
pnpm add -D drizzle-kit
```

```
bun add drizzle-orm pg
bun add -D drizzle-kit
```

npm

yarn

pnpm

bun

```
npm i drizzle-orm postres
npm i -D drizzle-kit
```

```
yarn add drizzle-orm postres
yarn add -D drizzle-kit
```

```
pnpm add drizzle-orm postres
pnpm add -D drizzle-kit
```

```
bun add drizzle-orm postres
bun add -D drizzle-kit
```

#### Step 2 - Initialize the driver and make a query

node-postgres (pg)

postgres.js

```
// Make sure to install the 'pg' package
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle({ client: pool });

const result = await db.execute('select 1');
```

```
// Make sure to install the 'postgres' package
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const queryClient = postgres(process.env.DATABASE_URL);
const db = drizzle({ client: queryClient });

const result = await db.execute('select 1');
```

#### What’s next?

**Manage schema**

[Drizzle Schema](https://orm.drizzle.team/docs/sql-schema-declaration) [PostgreSQL data types](https://orm.drizzle.team/docs/column-types/pg) [Indexes and Constraints](https://orm.drizzle.team/docs/indexes-constraints) [Database Views](https://orm.drizzle.team/docs/views) [Database Schemas](https://orm.drizzle.team/docs/schemas) [Sequences](https://orm.drizzle.team/docs/sequences) [Extensions](https://orm.drizzle.team/docs/extensions/pg)

**Query data**

[Relational Queries](https://orm.drizzle.team/docs/rqb) [Select](https://orm.drizzle.team/docs/select) [Insert](https://orm.drizzle.team/docs/insert) [Update](https://orm.drizzle.team/docs/update) [Delete](https://orm.drizzle.team/docs/delete) [Filters](https://orm.drizzle.team/docs/operators) [Joins](https://orm.drizzle.team/docs/joins) [sql\`\` operator](https://orm.drizzle.team/docs/sql)