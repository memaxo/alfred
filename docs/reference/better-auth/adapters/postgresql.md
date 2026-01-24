---
title: PostgreSQL | Better Auth
url:
description: Integrate Better Auth with PostgreSQL.
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

# PostgreSQL

Copy MarkdownOpen in

PostgreSQL is a powerful, open-source relational database management system known for its advanced features, extensibility, and support for complex queries and large datasets.
Read more [here](https://www.postgresql.org/).

## [Example Usage](https://www.better-auth.com/docs/adapters/postgresql#example-usage)

Make sure you have PostgreSQL installed and configured.
Then, you can connect it straight into Better Auth.

auth.ts

```
import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
  database: new Pool({
    connectionString: "postgres://user:password@localhost:5432/database",
  }),
});
```

For more information, read Kysely's documentation to the
[PostgresDialect](https://kysely-org.github.io/kysely-apidoc/classes/PostgresDialect.html).

## [Schema generation & migration](https://www.better-auth.com/docs/adapters/postgresql#schema-generation--migration)

The [Better Auth CLI](https://www.better-auth.com/docs/concepts/cli) allows you to generate or migrate
your database schema based on your Better Auth configuration and plugins.

| PostgreSQL Schema Generation | PostgreSQL Schema Migration |
| ---------------------------- | --------------------------- |
| ✅ Supported                 | ✅ Supported                |

Schema Generation

```
npx @better-auth/cli@latest generate
```

Schema Migration

```
npx @better-auth/cli@latest migrate
```

## [Additional Information](https://www.better-auth.com/docs/adapters/postgresql#additional-information)

PostgreSQL is supported under the hood via the [Kysely](https://kysely.dev/) adapter, any database supported by Kysely would also be supported. ( [Read more here](https://www.better-auth.com/docs/adapters/other-relational-databases))

If you're looking for performance improvements or tips, take a look at our guide to [performance optimizations](https://www.better-auth.com/docs/guides/optimizing-for-performance).

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/adapters/postgresql.mdx)

[Previous Page\\
\\
SQLite](https://www.better-auth.com/docs/adapters/sqlite) [Next Page\\
\\
MS SQL](https://www.better-auth.com/docs/adapters/mssql)

### On this page

[Example Usage](https://www.better-auth.com/docs/adapters/postgresql#example-usage) [Schema generation & migration](https://www.better-auth.com/docs/adapters/postgresql#schema-generation--migration) [Additional Information](https://www.better-auth.com/docs/adapters/postgresql#additional-information)
