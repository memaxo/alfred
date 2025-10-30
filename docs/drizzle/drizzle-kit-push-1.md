---
title: Drizzle ORM - `push`
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

# `drizzle-kit push`

This guide assumes familiarity with:

- Get started with Drizzle and `drizzle-kit` \- [read here](https://orm.drizzle.team/docs/get-started)
- Drizzle schema fundamentals - [read here](https://orm.drizzle.team/docs/sql-schema-declaration)
- Database connection basics - [read here](https://orm.drizzle.team/docs/connect-overview)
- Drizzle migrations fundamentals - [read here](https://orm.drizzle.team/docs/migrations)
- Drizzle Kit [overview](https://orm.drizzle.team/docs/kit-overview) and [config file](https://orm.drizzle.team/docs/drizzle-config-file) docs

`drizzle-kit push` lets you literally push your schema and subsequent schema changes directly to the
database while omitting SQL files generation, it’s designed to cover [code first](https://orm.drizzle.team/docs/migrations)
approach of Drizzle migrations.

How it works under the hood?

When you run Drizzle Kit `push` command it will:

1. Read through your Drizzle schema file(s) and compose a json snapshot of your schema
2. Pull(introspect) database schema
3. Based on differences between those two it will generate SQL migrations
4. Apply SQL migrations to the database

```
import * as p from "drizzle-orm/pg-core";

export const users = p.pgTable("users", {
  id: p.serial().primaryKey(),
  name: p.text(),
};
```

```
┌─────────────────────┐
│ ~ drizzle-kit push  │
└─┬───────────────────┘
  │                                           ┌──────────────────────────┐
  └ Pull current datatabase schema ---------> │                          │
                                              │                          │
  ┌ Generate alternations based on diff <---- │         DATABASE         │
  │                                           │                          │
  └ Apply migrations to the database -------> │                          │
                                       │      └──────────────────────────┘
                                       │
  ┌────────────────────────────────────┴────────────────┐
   create table users(id serial primary key, name text);
```

It’s the best approach for rapid prototyping and we’ve seen dozens of teams
and solo developers successfully using it as a primary migrations flow in their production applications.
It pairs exceptionally well with blue/green deployment strategy and serverless databases like
[Planetscale](https://planetscale.com/), [Neon](https://neon.tech/), [Turso](https://turso.tech/drizzle) and others.

* * *

`drizzle-kit push` requires you to specify `dialect`, path to the `schema` file(s) and either
database connection `url` or `user:password@host:port/db` params, you can provide them
either via [drizzle.config.ts](https://orm.drizzle.team/docs/drizzle-config-file) config file or via CLI options:

With config file

With CLI options

```
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  dbCredentials: {
    url: "postgresql://user:password@host:port/dbname",
  },
});
```

```
npx drizzle-kit push
```

```
npx drizzle-kit push --dialect=postgresql --schema=./src/schema.ts --url=postgresql://user:password@host:port/dbname
```

### Schema files path

You can have a single `schema.ts` file or as many schema files as you want spread out across the project.
Drizzle Kit requires you to specify path(s) to them as a [glob](https://www.digitalocean.com/community/tools/glob?comments=true&glob=/**/*.js&matches=false&tests=//%20This%20will%20match%20as%20it%20ends%20with%20%27.js%27&tests=/hello/world.js&tests=//%20This%20won%27t%20match!&tests=/test/some/globs) via `schema` configuration option.

Example 1

Example 2

Example 3

Example 4

```
📦 <project root>
 ├ ...
 ├ 📂 drizzle
 ├ 📂 src
 │ ├ ...
 │ ├ 📜 index.ts
 │ └ 📜 schema.ts
 ├ 📜 drizzle.config.ts
 └ 📜 package.json
```

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
});
```

```
📦 <project root>
 ├ ...
 ├ 📂 drizzle
 ├ 📂 src
 │ ├ 📂 user
 │ │ ├ 📜 handler.ts
 │ │ └ 📜 schema.ts
 │ ├ 📂 posts
 │ │ ├ 📜 handler.ts
 │ │ └ 📜 schema.ts
 │ └ 📜 index.ts
 ├ 📜 drizzle.config.ts
 └ 📜 package.json
```

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/**/schema.ts",
  //or
  schema: ["./src/user/schema.ts", "./src/posts/schema.ts"]
});
```

```
📦 <project root>
 ├ ...
 ├ 📂 drizzle
 ├ 📂 src
 │ ├ 📂 schema
 │ │ ├ 📜 user.ts
 │ │ ├ 📜 post.ts
 │ │ └ 📜 comment.ts
 │ └ 📜 index.ts
 ├ 📜 drizzle.config.ts
 └ 📜 package.json
```

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/*",
});
```

```
📦 <project root>
 ├ ...
 ├ 📂 drizzle
 ├ 📂 src
 │ ├ 📜 userById.ts
 │ ├ 📜 userByEmail.ts
 │ ├ 📜 listUsers.ts
 │ ├ 📜 user.sql.ts
 │ ├ 📜 postById.ts
 │ ├ 📜 listPosts.ts
 │ └ 📜 post.sql.ts
 │ 📜 index.ts
 ├ 📜 drizzle.config.ts
 └ 📜 package.json
```

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/**/*.sql.ts", // Dax's favourite
});
```

### Multiple configuration files in one project

You can have multiple config files in the project, it’s very useful when you have multiple database stages or multiple databases or different databases on the same project:

npm

yarn

pnpm

bun

```
npx drizzle-kit push --config=drizzle-dev.config.ts
npx drizzle-kit push --config=drizzle-prod.config.ts
```

```
yarn drizzle-kit push --config=drizzle-dev.config.ts
yarn drizzle-kit push --config=drizzle-prod.config.ts
```

```
pnpm drizzle-kit push --config=drizzle-dev.config.ts
pnpm drizzle-kit push --config=drizzle-prod.config.ts
```

```
bunx drizzle-kit push --config=drizzle-dev.config.ts
bunx drizzle-kit push --config=drizzle-prod.config.ts
```

```
📦 <project root>
 ├ 📂 drizzle
 ├ 📂 src
 ├ 📜 .env
 ├ 📜 drizzle-dev.config.ts
 ├ 📜 drizzle-prod.config.ts
 ├ 📜 package.json
 └ 📜 tsconfig.json
```

### Specifying database driver

IMPORTANT

**Expo SQLite** and **OP SQLite** are on-device(per-user) databases, there’s no way to `push` migrations there.

For embedded databases Drizzle provides **embedded migrations** \- check out our [get started](https://orm.drizzle.team/docs/get-started/expo-new) guide.

Drizzle Kit does not come with a pre-bundled database driver,
it will automatically pick available database driver from your current project based on the `dialect` \- [see discussion](https://github.com/drizzle-team/drizzle-orm/discussions/2203).

Mostly all drivers of the same dialect share the same set of connection params,
as for exceptions like `aws-data-api`, `pglight` and `d1-http` \- you will have to explicitly specify `driver` param.

AWS Data API

PGLite

Cloudflare D1 HTTP

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  driver: "aws-data-api",
  dbCredentials: {
    database: "database",
    resourceArn: "resourceArn",
    secretArn: "secretArn",
  },
});
```

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  driver: "pglite",
  dbCredentials: {
    // inmemory
    url: ":memory:"

    // or database folder
    url: "./database/"
  },
});
```

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  driver: "d1-http",
  dbCredentials: {
    accountId: "accountId",
    databaseId: "databaseId",
    token: "token",
  },
});
```

### Including tables, schemas and extensions

`drizzle-kit push` will by default manage all tables in `public` schema.
You can configure list of tables, schemas and extensions via `tablesFilters`, `schemaFilter` and `extensionFilters` options.

|  |  |
| --- | --- |
| `tablesFilter` | `glob` based table names filter, e.g. `["users", "user_info"]` or `"user*"`. Default is `"*"` |
| `schemaFilter` | Schema names filter, e.g. `["public", "drizzle"]`. Default is `["public"]` |
| `extensionsFilters` | List of installed database extensions, e.g. `["postgis"]`. Default is `[]` |

Let’s configure drizzle-kit to only operate with **all tables** in **public** schema
and let drizzle-kit know that there’s a **postgis** extension installed,
which creates it’s own tables in public schema, so drizzle can ignore them.

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  dbCredentials: {
    url: "postgresql://user:password@host:port/dbname",
  },
  extensionsFilters: ["postgis"],
  schemaFilter: ["public"],
  tablesFilter: ["*"],
});
```

```
npx drizzle-kit push
```

### Extended list of configurations

`drizzle-kit push` has a list of cli-only options

|  |  |
| --- | --- |
| `verbose` | print all SQL statements prior to execution |
| `strict` | always ask for approval before executing SQL statements |
| `force` | auto-accept all data-loss statements |

npm

yarn

pnpm

bun

```
npx drizzle-kit push --strict --verbose --force
```

```
yarn drizzle-kit push --strict --verbose --force
```

```
pnpm drizzle-kit push --strict --verbose --force
```

```
bunx drizzle-kit push --strict --verbose --force
```

* * *

We recommend configuring `drizzle-kit` through [drizzle.config.ts](https://orm.drizzle.team/docs/drizzle-config-file) file,
yet you can provide all configuration options through CLI if necessary, e.g. in CI/CD pipelines, etc.

|  |  |  |
| --- | --- | --- |
| `dialect` | `required` | Database dialect, one of `postgresql` `mysql` `sqlite` `turso` `singlestore` |
| `schema` | `required` | Path to typescript schema file(s) or folder(s) with multiple schema files |
| `driver` |  | Drivers exceptions `aws-data-api` `d1-http` `pglight` |
| `tablesFilter` |  | Table name filter |
| `schemaFilter` |  | Schema name filter. Default: `["public"]` |
| `extensionsFilters` |  | Database extensions internal database filters |
| `url` |  | Database connection string |
| `user` |  | Database user |
| `password` |  | Database password |
| `host` |  | Host |
| `port` |  | Port |
| `database` |  | Database name |
| `config` |  | Configuration file path, default= `drizzle.config.ts` |

npm

yarn

pnpm

bun

```
npx drizzle-kit push dialect=postgresql schema=src/schema.ts url=postgresql://user:password@host:port/dbname
npx drizzle-kit push dialect=postgresql schema=src/schema.ts driver=pglite url=database/
npx drizzle-kit push dialect=postgresql schema=src/schema.ts --tablesFilter=‘user*’ --extensionsFilters=postgis url=postgresql://user:password@host:port/dbname
```

```
yarn drizzle-kit push dialect=postgresql schema=src/schema.ts url=postgresql://user:password@host:port/dbname
yarn drizzle-kit push dialect=postgresql schema=src/schema.ts driver=pglite url=database/
yarn drizzle-kit push dialect=postgresql schema=src/schema.ts --tablesFilter=‘user*’ --extensionsFilters=postgis url=postgresql://user:password@host:port/dbname
```

```
pnpm drizzle-kit push dialect=postgresql schema=src/schema.ts url=postgresql://user:password@host:port/dbname
pnpm drizzle-kit push dialect=postgresql schema=src/schema.ts driver=pglite url=database/
pnpm drizzle-kit push dialect=postgresql schema=src/schema.ts --tablesFilter=‘user*’ --extensionsFilters=postgis url=postgresql://user:password@host:port/dbname
```

```
bunx drizzle-kit push dialect=postgresql schema=src/schema.ts url=postgresql://user:password@host:port/dbname
bunx drizzle-kit push dialect=postgresql schema=src/schema.ts driver=pglite url=database/
bunx drizzle-kit push dialect=postgresql schema=src/schema.ts --tablesFilter=‘user*’ --extensionsFilters=postgis url=postgresql://user:password@host:port/dbname
```

### Extended example

Let’s declare drizzle schema in the project and push it to the database via `drizzle-kit push` command

```
📦 <project root>
 ├ 📂 src
 │ ├ 📜 schema.ts
 │ └ 📜 index.ts
 ├ 📜 drizzle.config.ts
 └ …
```

drizzle.config.ts

src/schema.ts

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  dbCredentials: {
    url: "postgresql://user:password@host:port/dbname"
  },
});
```

```
import * as p from "drizzle-orm/pg-core";

export const users = p.pgTable("users", {
  id: p.serial().primaryKey(),
  name: p.text(),
})
```

Now let’s run

```
npx drizzle-kit push
```

it will pull existing(empty) schema from the database and generate SQL migration and apply it under the hood

```
CREATE TABLE "users"(
  id serial primary key,
  name text
)
```

DONE ✅