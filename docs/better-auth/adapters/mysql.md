---
title: MySQL | Better Auth
url: 
description: Integrate Better Auth with MySQL.
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

# MySQL

Copy MarkdownOpen in

MySQL is a popular open-source relational database management system (RDBMS) that is widely used for building web applications and other types of software. It provides a flexible and scalable database solution that allows for efficient storage and retrieval of data.
Read more here: [MySQL](https://www.mysql.com/).

## [Example Usage](https://www.better-auth.com/docs/adapters/mysql\#example-usage)

Make sure you have MySQL installed and configured.
Then, you can connect it straight into Better Auth.

auth.ts

```
import { betterAuth } from "better-auth";
import { createPool } from "mysql2/promise";

export const auth = betterAuth({
  database: createPool({
    host: "localhost",
    user: "root",
    password: "password",
    database: "database",
  }),
});
```

For more information, read Kysely's documentation to the
[MySQLDialect](https://kysely-org.github.io/kysely-apidoc/classes/MysqlDialect.html).

## [Schema generation & migration](https://www.better-auth.com/docs/adapters/mysql\#schema-generation--migration)

The [Better Auth CLI](https://www.better-auth.com/docs/concepts/cli) allows you to generate or migrate
your database schema based on your Better Auth configuration and plugins.

| MySQL Schema Generation | MySQL Schema Migration |
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

## [Additional Information](https://www.better-auth.com/docs/adapters/mysql\#additional-information)

MySQL is supported under the hood via the [Kysely](https://kysely.dev/) adapter, any database supported by Kysely would also be supported. ( [Read more here](https://www.better-auth.com/docs/adapters/other-relational-databases))

If you're looking for performance improvements or tips, take a look at our guide to [performance optimizations](https://www.better-auth.com/docs/guides/optimizing-for-performance).

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/adapters/mysql.mdx)

[Previous Page\\
\\
Other Social Providers](https://www.better-auth.com/docs/authentication/other-social-providers) [Next Page\\
\\
SQLite](https://www.better-auth.com/docs/adapters/sqlite)

### On this page

[Example Usage](https://www.better-auth.com/docs/adapters/mysql#example-usage) [Schema generation & migration](https://www.better-auth.com/docs/adapters/mysql#schema-generation--migration) [Additional Information](https://www.better-auth.com/docs/adapters/mysql#additional-information)