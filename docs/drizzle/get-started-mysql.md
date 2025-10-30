---
title: Drizzle ORM - MySQL
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

# Drizzle <> MySQL

To use Drizzle with a MySQL database, you should use the `mysql2` driver

According to the **[official website](https://github.com/sidorares/node-mysql2)**,
`mysql2` is a MySQL client for Node.js with focus on performance.

Drizzle ORM natively supports `mysql2` with `drizzle-orm/mysql2` package.

#### Step 1 - Install packages

npm

yarn

pnpm

bun

```
npm i drizzle-orm mysql2
npm i -D drizzle-kit
```

```
yarn add drizzle-orm mysql2
yarn add -D drizzle-kit
```

```
pnpm add drizzle-orm mysql2
pnpm add -D drizzle-kit
```

```
bun add drizzle-orm mysql2
bun add -D drizzle-kit
```

#### Step 2 - Initialize the driver and make a query

mysql2

mysql with config

```
import { drizzle } from "drizzle-orm/mysql2";

const db = drizzle(process.env.DATABASE_URL);

const response = await db.select().from(...)
```

```
import { drizzle } from "drizzle-orm/mysql2";

// You can specify any property from the mysql2 connection options
const db = drizzle({ connection:{ uri: process.env.DATABASE_URL }});

const response = await db.select().from(...)
```

If you need to provide your existing driver:

Client connection

Pool connection

```
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection({
  host: "host",
  user: "user",
  database: "database",
  ...
});

const db = drizzle({ client: connection });
```

```
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const poolConnection = mysql.createPool({
  host: "host",
  user: "user",
  database: "database",
  ...
});

const db = drizzle({ client: poolConnection });
```

IMPORTANT

For the built in `migrate` function with DDL migrations we and drivers strongly encourage you to use single `client` connection.

For querying purposes feel free to use either `client` or `pool` based on your business demands.

#### What’s next?

**Manage schema**

[Drizzle Schema](https://orm.drizzle.team/docs/sql-schema-declaration) [PostgreSQL data types](https://orm.drizzle.team/docs/column-types/pg) [Indexes and Constraints](https://orm.drizzle.team/docs/indexes-constraints) [Database Views](https://orm.drizzle.team/docs/views) [Database Schemas](https://orm.drizzle.team/docs/schemas) [Sequences](https://orm.drizzle.team/docs/sequences) [Extensions](https://orm.drizzle.team/docs/extensions/pg)

**Query data**

[Relational Queries](https://orm.drizzle.team/docs/rqb) [Select](https://orm.drizzle.team/docs/select) [Insert](https://orm.drizzle.team/docs/insert) [Update](https://orm.drizzle.team/docs/update) [Delete](https://orm.drizzle.team/docs/delete) [Filters](https://orm.drizzle.team/docs/operators) [Joins](https://orm.drizzle.team/docs/joins) [sql\`\` operator](https://orm.drizzle.team/docs/sql)