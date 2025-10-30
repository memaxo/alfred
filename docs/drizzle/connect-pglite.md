---
title: Drizzle ORM - PGLite
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

# Drizzle <> PGlite

This guide assumes familiarity with:

- Database [connection basics](https://orm.drizzle.team/docs/connect-overview) with Drizzle
- ElectricSQL - [website](https://electric-sql.com/)
- PgLite driver - [docs](https://pglite.dev/) & [GitHub](https://github.com/electric-sql/pglite)

According to the **[official repo](https://github.com/electric-sql/pglite)**, PGlite is a WASM Postgres build packaged into a TypeScript client library that enables you to run Postgres in the browser, Node.js and Bun, with no need to install any other dependencies. It is only 2.6mb gzipped.

It can be used as an ephemeral in-memory database, or with persistence either to the file system (Node/Bun) or indexedDB (Browser).

Unlike previous “Postgres in the browser” projects, PGlite does not use a Linux virtual machine - it is simply Postgres in WASM.

#### Step 1 - Install packages

npm

yarn

pnpm

bun

```
npm i drizzle-orm @electric-sql/pglite
npm i -D drizzle-kit
```

```
yarn add drizzle-orm @electric-sql/pglite
yarn add -D drizzle-kit
```

```
pnpm add drizzle-orm @electric-sql/pglite
pnpm add -D drizzle-kit
```

```
bun add drizzle-orm @electric-sql/pglite
bun add -D drizzle-kit
```

#### Step 2 - Initialize the driver and make a query

In-Memory

In directory

With extra config options

```
import { drizzle } from 'drizzle-orm/pglite';

const db = drizzle();

await db.select().from(...);
```

```
import { drizzle } from 'drizzle-orm/pglite';

const db = drizzle('path-to-dir');

await db.select().from(...);
```

```
import { drizzle } from 'drizzle-orm/pglite';

// connection is a native PGLite configuration
const db = drizzle({ connection: { dataDir: 'path-to-dir' }});

await db.select().from(...);
```

If you need to provide your existing driver:

```
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

// In-memory Postgres
const client = new PGlite();
const db = drizzle({ client });

await db.select().from(users);
```

#### What’s next?

**Manage schema**

[Drizzle Schema](https://orm.drizzle.team/docs/sql-schema-declaration) [PostgreSQL data types](https://orm.drizzle.team/docs/column-types/pg) [Indexes and Constraints](https://orm.drizzle.team/docs/indexes-constraints) [Database Views](https://orm.drizzle.team/docs/views) [Database Schemas](https://orm.drizzle.team/docs/schemas) [Sequences](https://orm.drizzle.team/docs/sequences) [Extensions](https://orm.drizzle.team/docs/extensions/pg)

**Query data**

[Relational Queries](https://orm.drizzle.team/docs/rqb) [Select](https://orm.drizzle.team/docs/select) [Insert](https://orm.drizzle.team/docs/insert) [Update](https://orm.drizzle.team/docs/update) [Delete](https://orm.drizzle.team/docs/delete) [Filters](https://orm.drizzle.team/docs/operators) [Joins](https://orm.drizzle.team/docs/joins) [sql\`\` operator](https://orm.drizzle.team/docs/sql)