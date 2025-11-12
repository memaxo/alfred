---
title: MS SQL | Better Auth
url: 
description: Integrate Better Auth with MS SQL.
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

# MS SQL

Copy MarkdownOpen in

Microsoft SQL Server is a relational database management system developed by Microsoft, designed for enterprise-level data storage, management, and analytics with robust security and scalability features.
Read more [here](https://en.wikipedia.org/wiki/Microsoft_SQL_Server).

## [Example Usage](https://www.better-auth.com/docs/adapters/mssql\#example-usage)

Make sure you have MS SQL installed and configured.
Then, you can connect it straight into Better Auth.

auth.ts

```
import { betterAuth } from "better-auth";
import { MssqlDialect } from "kysely";
import * as Tedious from 'tedious'
import * as Tarn from 'tarn'

const dialect = new MssqlDialect({
  tarn: {
    ...Tarn,
    options: {
      min: 0,
      max: 10,
    },
  },
  tedious: {
    ...Tedious,
    connectionFactory: () => new Tedious.Connection({
      authentication: {
        options: {
          password: 'password',
          userName: 'username',
        },
        type: 'default',
      },
      options: {
        database: 'some_db',
        port: 1433,
        trustServerCertificate: true,
      },
      server: 'localhost',
    }),
  },
})

export const auth = betterAuth({
  database: {
    dialect,
    type: "mssql"
  }
});

```

For more information, read Kysely's documentation to the [MssqlDialect](https://kysely-org.github.io/kysely-apidoc/classes/MssqlDialect.html).

## [Schema generation & migration](https://www.better-auth.com/docs/adapters/mssql\#schema-generation--migration)

The [Better Auth CLI](https://www.better-auth.com/docs/concepts/cli) allows you to generate or migrate
your database schema based on your Better Auth configuration and plugins.

| MS SQL Schema Generation | MS SQL Schema Migration |
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

## [Additional Information](https://www.better-auth.com/docs/adapters/mssql\#additional-information)

MS SQL is supported under the hood via the [Kysely](https://kysely.dev/) adapter, any database supported by Kysely would also be supported. ( [Read more here](https://www.better-auth.com/docs/adapters/other-relational-databases))

If you're looking for performance improvements or tips, take a look at our guide to [performance optimizations](https://www.better-auth.com/docs/guides/optimizing-for-performance).

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/adapters/mssql.mdx)

[Previous Page\\
\\
PostgreSQL](https://www.better-auth.com/docs/adapters/postgresql) [Next Page\\
\\
Other Relational Databases](https://www.better-auth.com/docs/adapters/other-relational-databases)

### On this page

[Example Usage](https://www.better-auth.com/docs/adapters/mssql#example-usage) [Schema generation & migration](https://www.better-auth.com/docs/adapters/mssql#schema-generation--migration) [Additional Information](https://www.better-auth.com/docs/adapters/mssql#additional-information)