---
title: SQLite | Better Auth
url: 
description: Integrate Better Auth with SQLite.
language: en
---
[\_helo](https://www.better-auth.com/) [docs](https://www.better-auth.com/docs) [examples](https://www.better-auth.com/docs/examples/next-js) [changelogs](https://www.better-auth.com/changelogs) [blogs](https://www.better-auth.com/blog) [community](https://www.better-auth.com/community)

### Get Started

### Concepts

### Authentication

### Databases

### Integrations

### Plugins

### Guides

### Reference

# SQLite

Copy MarkdownOpen in

SQLite is a lightweight, serverless, self-contained SQL database engine that is widely used for local data storage in applications.
Read more [here.](https://www.sqlite.org/)

## [Example Usage](https://www.better-auth.com/docs/adapters/sqlite\#example-usage)

Better Auth supports multiple SQLite drivers. Choose the one that best fits your environment:

### [Better-SQLite3 (Recommended)](https://www.better-auth.com/docs/adapters/sqlite\#better-sqlite3-recommended)

The most popular and stable SQLite driver for Node.js:

auth.ts

```
import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

export const auth = betterAuth({
  database: new Database("database.sqlite"),
});
```

For more information, read Kysely's documentation to the
[SqliteDialect](https://kysely-org.github.io/kysely-apidoc/classes/SqliteDialect.html).

### [Node.js Built-in SQLite (Experimental)](https://www.better-auth.com/docs/adapters/sqlite\#nodejs-built-in-sqlite-experimental)

The `node:sqlite` module is still experimental and may change at any time. It requires Node.js 22.5.0 or later.

Starting from Node.js 22.5.0, you can use the built-in [SQLite](https://nodejs.org/api/sqlite.html) module:

auth.ts

```
import { betterAuth } from "better-auth";
import { DatabaseSync } from "node:sqlite";

export const auth = betterAuth({
  database: new DatabaseSync("database.sqlite"),
});
```

To run your application with Node.js SQLite:

```
node your-app.js
```

### [Bun Built-in SQLite](https://www.better-auth.com/docs/adapters/sqlite\#bun-built-in-sqlite)

You can also use the built-in [SQLite](https://bun.com/docs/api/sqlite) module in Bun, which is similar to the Node.js version:

auth.ts

```
import { betterAuth } from "better-auth";
import { Database } from "bun:sqlite";
export const auth = betterAuth({
  database: new Database("database.sqlite"),
});
```

## [Schema generation & migration](https://www.better-auth.com/docs/adapters/sqlite\#schema-generation--migration)

The [Better Auth CLI](https://www.better-auth.com/docs/concepts/cli) allows you to generate or migrate
your database schema based on your Better Auth configuration and plugins.

| SQLite Schema Generation | SQLite Schema Migration |
| --- | --- |
| ✅ Supported | ✅ Supported |

Schema Generation

```
npx @better-auth/cli@latest generate
```

Schema Migration

```
npx @better-auth/cli@latest migrate
```

## [Additional Information](https://www.better-auth.com/docs/adapters/sqlite\#additional-information)

SQLite is supported under the hood via the [Kysely](https://kysely.dev/) adapter, any database supported by Kysely would also be supported. ( [Read more here](https://www.better-auth.com/docs/adapters/other-relational-databases))

If you're looking for performance improvements or tips, take a look at our guide to [performance optimizations](https://www.better-auth.com/docs/guides/optimizing-for-performance).

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/adapters/sqlite.mdx)

[Previous Page\\
\\
MySQL](https://www.better-auth.com/docs/adapters/mysql) [Next Page\\
\\
PostgreSQL](https://www.better-auth.com/docs/adapters/postgresql)

### On this page

[Example Usage](https://www.better-auth.com/docs/adapters/sqlite#example-usage) [Better-SQLite3 (Recommended)](https://www.better-auth.com/docs/adapters/sqlite#better-sqlite3-recommended) [Node.js Built-in SQLite (Experimental)](https://www.better-auth.com/docs/adapters/sqlite#nodejs-built-in-sqlite-experimental) [Bun Built-in SQLite](https://www.better-auth.com/docs/adapters/sqlite#bun-built-in-sqlite) [Schema generation & migration](https://www.better-auth.com/docs/adapters/sqlite#schema-generation--migration) [Additional Information](https://www.better-auth.com/docs/adapters/sqlite#additional-information)