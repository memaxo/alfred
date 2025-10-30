---
title: Drizzle ORM - Turso
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

# Drizzle <> Turso

This guide assumes familiarity with:

- Database [connection basics](https://orm.drizzle.team/docs/connect-overview) with Drizzle
- Turso Database - [website](https://docs.turso.tech/introduction)
- LibSQL driver - [website](https://docs.turso.tech/sdk/ts/reference) & [GitHub](https://github.com/tursodatabase/libsql-client-ts)

According to the **[official website](https://turso.tech/drizzle)**,
Turso is a **[libSQL](https://github.com/libsql/libsql)** powered edge SQLite database as a service.

Drizzle ORM natively supports libSQL driver.
We embrace SQL dialects and dialect specific drivers and syntax and mirror most popular
SQLite-like `all`, `get`, `values` and `run` query methods syntax.

#### Step 1 - Install packages

npm

yarn

pnpm

bun

```
npm i drizzle-orm @libsql/client
npm i -D drizzle-kit
```

```
yarn add drizzle-orm @libsql/client
yarn add -D drizzle-kit
```

```
pnpm add drizzle-orm @libsql/client
pnpm add -D drizzle-kit
```

```
bun add drizzle-orm @libsql/client
bun add -D drizzle-kit
```

#### Step 2 - Initialize the driver

Drizzle has native support for all `@libsql/client` driver variations:

|  |  |
| --- | --- |
| `@libsql/client` | defaults to `node` import, automatically changes to `web` if `target` or `platform` is set for bundler, e.g. `esbuild --platform=browser` |
| `@libsql/client/node` | `node` compatible module, supports `:memory:`, `file`, `wss`, `http` and `turso` connection protocols |
| `@libsql/client/web` | module for fullstack web frameworks like `next`, `nuxt`, `astro`, etc. |
| `@libsql/client/http` | module for `http` and `https` connection protocols |
| `@libsql/client/ws` | module for `ws` and `wss` connection protocols |
| `@libsql/client/sqlite3` | module for `:memory:` and `file` connection protocols |
| `@libsql/client-wasm` | Separate experimental package for WASM |

default

node

web

http

web sockets

wasm

```
import { drizzle } from 'drizzle-orm/libsql';

const db = drizzle({ connection: {
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
}});
```

```
import { drizzle } from 'drizzle-orm/libsql/node';

const db = drizzle({ connection: {
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
}});
```

```
import { drizzle } from 'drizzle-orm/libsql/web';

const db = drizzle({ connection: {
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
}});
```

```
import { drizzle } from 'drizzle-orm/libsql/http';

const db = drizzle({ connection: {
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
}});
```

```
import { drizzle } from 'drizzle-orm/libsql/ws';

const db = drizzle({ connection: {
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
}});
```

```
import { drizzle } from 'drizzle-orm/libsql/wasm';

const db = drizzle({ connection: {
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
}});
```

If you need to provide your existing driver:

default

web

```
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
});

const db = drizzle({ client });

const result = await db.select().from(users).all()
```

```
import { drizzle } from 'drizzle-orm/libsql/web';
import { createClient } from '@libsql/client/web';

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
});

const db = drizzle({ client });

const result = await db.select().from(users).all()
```

#### Step 3 - make a query

```
import { drizzle } from 'drizzle-orm/libsql';
import * as s from 'drizzle-orm/sqlite-core';

const db = drizzle({ connection: {
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
}});

const users = s.sqliteTable("users", {
  id: s.integer(),
  name: s.text(),
})

const result = await db.select().from(users);
```

#### What’s next?

**Manage schema**

[Drizzle Schema](https://orm.drizzle.team/docs/sql-schema-declaration) [PostgreSQL data types](https://orm.drizzle.team/docs/column-types/pg) [Indexes and Constraints](https://orm.drizzle.team/docs/indexes-constraints) [Database Views](https://orm.drizzle.team/docs/views) [Database Schemas](https://orm.drizzle.team/docs/schemas) [Sequences](https://orm.drizzle.team/docs/sequences) [Extensions](https://orm.drizzle.team/docs/extensions/pg)

**Query data**

[Relational Queries](https://orm.drizzle.team/docs/rqb) [Select](https://orm.drizzle.team/docs/select) [Insert](https://orm.drizzle.team/docs/insert) [Update](https://orm.drizzle.team/docs/update) [Delete](https://orm.drizzle.team/docs/delete) [Filters](https://orm.drizzle.team/docs/operators) [Joins](https://orm.drizzle.team/docs/joins) [sql\`\` operator](https://orm.drizzle.team/docs/sql)