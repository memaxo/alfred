---
title: Prisma | Better Auth
url:
description: Integrate Better Auth with Prisma.
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

# Prisma

Copy MarkdownOpen in

Prisma ORM is an open-source database toolkit that simplifies database access and management in applications by providing a type-safe query builder and an intuitive data modeling interface.
Read more [here](https://www.prisma.io/).

## [Example Usage](https://www.better-auth.com/docs/adapters/prisma#example-usage)

Make sure you have Prisma installed and configured.
Then, you can use the Prisma adapter to connect to your database.

auth.ts

```
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
});
```

If you have configured a custom output directory in your `schema.prisma` file (e.g., `output = "../src/generated/prisma"`), make sure to import the Prisma client from that location instead of `@prisma/client`. Learn more about custom output directories in the [Prisma documentation](https://www.prisma.io/docs/guides/nextjs#21-install-prisma-orm-and-create-your-first-models).

## [Schema generation & migration](https://www.better-auth.com/docs/adapters/prisma#schema-generation--migration)

The [Better Auth CLI](https://www.better-auth.com/docs/concepts/cli) allows you to generate or migrate
your database schema based on your Better Auth configuration and plugins.

| Prisma Schema Generation | Prisma Schema Migration |
| ------------------------ | ----------------------- |
| ✅ Supported             | ❌ Not Supported        |

Schema Generation

```
npx @better-auth/cli@latest generate
```

## [Additional Information](https://www.better-auth.com/docs/adapters/prisma#additional-information)

If you're looking for performance improvements or tips, take a look at our guide to [performance optimizations](https://www.better-auth.com/docs/guides/optimizing-for-performance).

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/adapters/prisma.mdx)

[Previous Page\\
\\
Drizzle](https://www.better-auth.com/docs/adapters/drizzle) [Next Page\\
\\
MongoDB](https://www.better-auth.com/docs/adapters/mongo)

### On this page

[Example Usage](https://www.better-auth.com/docs/adapters/prisma#example-usage) [Schema generation & migration](https://www.better-auth.com/docs/adapters/prisma#schema-generation--migration) [Additional Information](https://www.better-auth.com/docs/adapters/prisma#additional-information)
