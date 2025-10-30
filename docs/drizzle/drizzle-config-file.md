---
title: Drizzle ORM - drizzle.config.ts
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

# Drizzle Kit configuration file

This guide assumes familiarity with:

- Get started with Drizzle and `drizzle-kit` \- [read here](https://orm.drizzle.team/docs/get-started)
- Drizzle schema fundamentals - [read here](https://orm.drizzle.team/docs/sql-schema-declaration)
- Database connection basics - [read here](https://orm.drizzle.team/docs/connect-overview)
- Drizzle migrations fundamentals - [read here](https://orm.drizzle.team/docs/migrations)
- Drizzle Kit [overview](https://orm.drizzle.team/docs/kit-overview) and [config file](https://orm.drizzle.team/docs/drizzle-config-file)

Drizzle Kit lets you declare configuration options in `TypeScript` or `JavaScript` configuration files.

```
📦 <project root>
 ├ ...
 ├ 📂 drizzle
 ├ 📂 src
 ├ 📜 drizzle.config.ts
 └ 📜 package.json
```

drizzle.config.ts

drizzle.config.js

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
});
```

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
});
```

Example of an extended config file

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  dialect: "postgresql",
  schema: "./src/schema.ts",

  driver: "pglite",
  dbCredentials: {
    url: "./database/",
  },

  extensionsFilters: ["postgis"],
  schemaFilter: "public",
  tablesFilter: "*",

  introspect: {
    casing: "camel",
  },

  migrations: {
    prefix: "timestamp",
    table: "__drizzle_migrations__",
    schema: "public",
  },

  entities: {
    roles: {
      provider: '',
      exclude: [],
      include: []
    }
  },

  breakpoints: true,
  strict: true,
  verbose: true,
});
```

Expand

### Multiple configuration files

You can have multiple config files in the project, it’s very useful when you have multiple database stages or multiple databases or different databases on the same project:

npm

yarn

pnpm

bun

```
npx drizzle-kit generate --config=drizzle-dev.config.ts
npx drizzle-kit generate --config=drizzle-prod.config.ts
```

```
yarn drizzle-kit generate --config=drizzle-dev.config.ts
yarn drizzle-kit generate --config=drizzle-prod.config.ts
```

```
pnpm drizzle-kit generate --config=drizzle-dev.config.ts
pnpm drizzle-kit generate --config=drizzle-prod.config.ts
```

```
bunx drizzle-kit generate --config=drizzle-dev.config.ts
bunx drizzle-kit generate --config=drizzle-prod.config.ts
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

### Migrations folder

`out` param lets you define folder for your migrations, it’s optional and `drizzle` by default.

It’s very useful since you can have many separate schemas for different databases in the same project
and have different migration folders for them.

Migration folder contains `.sql` migration files and `_meta` folder which is used by `drizzle-kit`

```
📦 <project root>
 ├ ...
 ├ 📂 drizzle
 │ ├ 📂 _meta
 │ ├ 📜 user.ts
 │ ├ 📜 post.ts
 │ └ 📜 comment.ts
 ├ 📂 src
 ├ 📜 drizzle.config.ts
 └ 📜 package.json
```

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql", // "mysql" | "sqlite" | "postgresql" | "turso" | "singlestore"
  schema: "./src/schema/*",
  out: "./drizzle",
});
```

## \-\-\-

### `dialect`

Dialect of the database you’re using

|  |  |
| --- | --- |
| type | `postgresql` `mysql` `sqlite` `turso` `singlestore` |
| default | — |
| commands | `generate` `migrate` `push` `pull` `check` `up` |

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
});
```

### `schema`

[`glob`](https://www.digitalocean.com/community/tools/glob?comments=true&glob=/**/*.js&matches=false&tests=//%20This%20will%20match%20as%20it%20ends%20with%20%27.js%27&tests=/hello/world.js&tests=//%20This%20won%27t%20match!&tests=/test/some/globs)
based path to drizzle schema file(s) or folder(s) contaning schema files.

|  |  |
| --- | --- |
| type | `string` `string[]` |
| default | — |
| commands | `generate` `push` |

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

### `out`

Defines output folder of your SQL migration files, json snapshots of your schema and `schema.ts` from `drizzle-kit pull` command.

|  |  |
| --- | --- |
| type | `string` `string[]` |
| default | `drizzle` |
| commands | `generate` `migrate` `push` `pull` `check` `up` |

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
});
```

### `driver`

Drizzle Kit automatically picks available database driver from your current project based on the provided `dialect`,
yet some vendor specific databases require a different subset of connection params.

`driver` option let’s you explicitely pick those exceptions drivers.

|  |  |
| --- | --- |
| type | `aws-data-api` `d1-http` `pglight` |
| default | — |
| commands | `migrate` `push` `pull` |

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

## \-\-\-

### `dbCredentials`

Database connection credentials in a form of `url`,
`user:password@host:port/db` params or exceptions drivers( `aws-data-api` `d1-http` `pglight` ) specific connection options.

|  |  |
| --- | --- |
| type | union of drivers connection options |
| default | — |
| commands | `migrate` `push` `pull` |

PostgreSQL

MySQL

SQLite

Turso

Cloudflare D1

AWS Data API

PGLite

```
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: {
    url: "postgres://user:password@host:port/db",
  }
});
```

```
import { defineConfig } from 'drizzle-kit'

// via connection params
export default defineConfig({
  dialect: "postgresql",
  dbCredentials: {
    host: "host",
    port: 5432,
    user: "user",
    password: "password",
    database: "dbname",
    ssl: true, // can be boolean | "require" | "allow" | "prefer" | "verify-full" | options from node:tls
  }
});
```

```
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: "mysql",
  dbCredentials: {
    url: "mysql://user:password@host:port/db",
  }
});
```

```
import { defineConfig } from 'drizzle-kit'

// via connection params
export default defineConfig({
  dialect: "mysql",
  dbCredentials: {
    host: "host",
    port: 5432,
    user: "user",
    password: "password",
    database: "dbname",
    ssl: "...", // can be: string | SslOptions (ssl options from mysql2 package)
  }
});
```

```
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: "sqlite",
  dbCredentials: {
    url: ":memory:", // inmemory database
    // or
    url: "sqlite.db",
    // or
    url: "file:sqlite.db" // file: prefix is required by libsql
  }
});
```

```
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: "turso",
  dbCredentials: {
    url: "libsql://acme.turso.io" // remote Turso database url
    authToken: "...",

    // or if you need local db

    url: ":memory:", // inmemory database
    // or
    url: "file:sqlite.db", // file: prefix is required by libsql
  }
});
```

```
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: "",
    databaseId: "",
    token: "",
  }
});
```

```
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: "postgresql",
  driver: "aws-data-api",
  dbCredentials: {
    database: "database",
    resourceArn: "resourceArn",
    secretArn: "secretArn",
  },
});
```

```
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: "postgresql",
  driver: "pglite",
  dbCredentials: {
    url: "./database/", // database folder path
  }
});
```

### `migrations`

When running `drizzle-kit migrate` \- drizzle will records about
successfully applied migrations in your database in log table named `__drizzle_migrations` in `public` schema(PostgreSQL only).

`migrations` config options lets you change both migrations log `table` name and `schema`.

|  |  |
| --- | --- |
| type | `{ table: string, schema: string }` |
| default | `{ table: "__drizzle_migrations", schema: "drizzle" }` |
| commands | `migrate` |

```
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  migrations: {
    table: 'my-migrations-table', // `__drizzle_migrations` by default
    schema: 'public', // used in PostgreSQL only, `drizzle` by default
  },
});
```

### `introspect`

Configuration for `drizzle-kit pull` command.

`casing` is responsible for in-code column keys casing

|  |  |
| --- | --- |
| type | `{ casing: "preserve" | "camel" }` |
| default | `{ casing: "camel" }` |
| commands | `pull` |

camel

preserve

```
import * as p from "drizzle-orm/pg-core"

export const users = p.pgTable("users", {
  id: p.serial(),
  firstName: p.text("first-name"),
  lastName: p.text("LastName"),
  email: p.text(),
  phoneNumber: p.text("phone_number"),
});
```

```
SELECT a.attname AS column_name, format_type(a.atttypid, a.atttypmod) as data_type FROM pg_catalog.pg_attribute a;
```

```
 column_name   | data_type
---------------+------------------------
 id            | serial
 first-name    | text
 LastName      | text
 email         | text
 phone_number  | text
```

```
import * as p from "drizzle-orm/pg-core"

export const users = p.pgTable("users", {
  id: p.serial(),
  "first-name": p.text("first-name"),
  LastName: p.text("LastName"),
  email: p.text(),
  phone_number: p.text("phone_number"),
});
```

```
SELECT a.attname AS column_name, format_type(a.atttypid, a.atttypmod) as data_type FROM pg_catalog.pg_attribute a;
```

```
 column_name   | data_type
---------------+------------------------
 id            | serial
 first-name    | text
 LastName      | text
 email         | text
 phone_number  | text
```

## \-\-\-

### `tablesFilter`

If you want to run multiple projects with one database - check out [our guide](https://orm.drizzle.team/docs/goodies#multi-project-schema).

`drizzle-kit push` and `drizzle-kit pull` will by default manage all tables in `public` schema.
You can configure list of tables, schemas and extensions via `tablesFilters`, `schemaFilter` and `extensionFilters` options.

`tablesFilter` option lets you specify [`glob`](https://www.digitalocean.com/community/tools/glob?comments=true&glob=/**/*.js&matches=false&tests=//%20This%20will%20match%20as%20it%20ends%20with%20%27.js%27&tests=/hello/world.js&tests=//%20This%20won%27t%20match!&tests=/test/some/globs)
based table names filter, e.g. `["users", "user_info"]` or `"user*"`

|  |  |
| --- | --- |
| type | `string` `string[]` |
| default | — |
| commands | `generate` `push` `pull` |

```
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  tablesFilter: ["users", "posts", "project1_*"],
});
```

### `schemaFilter`

If you want to run multiple projects with one database - check out [our guide](https://orm.drizzle.team/docs/goodies#multi-project-schema).

`drizzle-kit push` and `drizzle-kit pull` will by default manage all tables in `public` schema.
You can configure list of tables, schemas and extensions via `tablesFilters`, `schemaFilter` and `extensionFilters` options.

`schemaFilter` option lets you specify list of schemas for Drizzle Kit to manage

|  |  |
| --- | --- |
| type | `string[]` |
| default | `["public"]` |
| commands | `push` `pull` |

```
export default defineConfig({
  dialect: "postgresql",
  schemaFilter: ["public", "schema1", "schema2"],
});
```

### `extensionsFilters`

Some extensions like [`postgis`](https://postgis.net/), when installed on the database, create its own tables in public schema.
Those tables have to be ignored by `drizzle-kit push` or `drizzle-kit pull`.

`extensionsFilters` option lets you declare list of installed extensions for drizzle kit to ignore their tables in the schema.

|  |  |
| --- | --- |
| type | `["postgis"]` |
| default | `[]` |
| commands | `push` `pull` |

```
export default defineConfig({
  dialect: "postgresql",
  extensionsFilters: ["postgis"],
});
```

## \-\-\-

### `entities`

This configuration is created to set up management settings for specific `entities` in the database.

For now, it only includes `roles`, but eventually all database entities will migrate here, such as `tables`, `schemas`, `extensions`, `functions`, `triggers`, etc

#### `roles`

If you are using Drizzle Kit to manage your schema and especially the defined roles, there may be situations where you have some roles that are not defined in the Drizzle schema.
In such cases, you may want Drizzle Kit to skip those `roles` without the need to write each role in your Drizzle schema and mark it with `.existing()`.

The `roles` option lets you:

- Enable or disable role management with Drizzle Kit.
- Exclude specific roles from management by Drizzle Kit.
- Include specific roles for management by Drizzle Kit.
- Enable modes for providers like `Neon` and `Supabase`, which do not manage their specific roles.
- Combine all the options above

|  |  |
| --- | --- |
| type | `boolean | { provider: "neon" | "supabase", include: string[], exclude: string[]}` |
| default | `false` |
| commands | `push` `pull` `generate` |

By default, `drizzle-kit` won’t manage roles for you, so you will need to enable that. in `drizzle.config.ts`

```
export default defineConfig({
  dialect: "postgresql",
  entities: {
    roles: true
  }
});
```

**You have a role `admin` and want to exclude it from the list of manageable roles**

```
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  ...
  entities: {
    roles: {
      exclude: ['admin']
    }
  }
});
```

**You have a role `admin` and want to include to the list of manageable roles**

```
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  ...
  entities: {
    roles: {
      include: ['admin']
    }
  }
});
```

**If you are using `Neon` and want to exclude roles defined by `Neon`, you can use the provider option**

```
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  ...
  entities: {
    roles: {
      provider: 'neon'
    }
  }
});
```

**If you are using `Supabase` and want to exclude roles defined by `Supabase`, you can use the provider option**

```
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  ...
  entities: {
    roles: {
      provider: 'supabase'
    }
  }
});
```

important

You may encounter situations where Drizzle is slightly outdated compared to new roles specified by database providers,
so you may need to use both the `provider` option and `exclude` additional roles. You can easily do this with Drizzle:

```
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  ...
  entities: {
    roles: {
      provider: 'supabase',
      exclude: ['new_supabase_role']
    }
  }
});
```

## \-\-\-

### `strict`

Prompts confirmation to run printed SQL statements when running `drizzle-kit push` command.

|  |  |
| --- | --- |
| type | `boolean` |
| default | `false` |
| commands | `push` |

```
export default defineConfig({
  dialect: "postgresql",
  strict: false,
});
```

### `verbose`

Print all SQL statements during `drizzle-kit push` command.

|  |  |
| --- | --- |
| type | `boolean` |
| default | `true` |
| commands | `generate` `pull` |

```
export default defineConfig({
  dialect: "postgresql",
  verbose: false,
});
```

### `breakpoints`

Drizzle Kit will automatically embed `--> statement-breakpoint` into generated SQL migration files,
that’s necessary for databases that do not support multiple DDL alternation statements in one transaction(MySQL and SQLite).

`breakpoints` option flag lets you switch it on and off

|  |  |
| --- | --- |
| type | `boolean` |
| default | `true` |
| commands | `generate` `pull` |

```
export default defineConfig({
  dialect: "postgresql",
  breakpoints: false,
});
```