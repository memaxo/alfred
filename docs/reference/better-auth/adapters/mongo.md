---
title: MongoDB Adapter | Better Auth
url:
description: Integrate Better Auth with MongoDB.
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

# MongoDB Adapter

Copy MarkdownOpen in

MongoDB is a popular NoSQL database that is widely used for building scalable and flexible applications. It provides a flexible schema that allows for easy data modeling and querying.
Read more here: [MongoDB](https://www.mongodb.com/).

## [Example Usage](https://www.better-auth.com/docs/adapters/mongo#example-usage)

Make sure you have MongoDB installed and configured.
Then, you can use the mongodb adapter.

auth.ts

```
import { betterAuth } from "better-auth";
import { MongoClient } from "mongodb";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

const client = new MongoClient("mongodb://localhost:27017/database");
const db = client.db();

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    // Optional: if you don't provide a client, database transactions won't be enabled.
    client
  }),
});
```

## [Schema generation & migration](https://www.better-auth.com/docs/adapters/mongo#schema-generation--migration)

For MongoDB, we don't need to generate or migrate the schema.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/adapters/mongo.mdx)

[Previous Page\\
\\
Prisma](https://www.better-auth.com/docs/adapters/prisma) [Next Page\\
\\
Others](https://www.better-auth.com/docs/adapters/mongo)

### On this page

[Example Usage](https://www.better-auth.com/docs/adapters/mongo#example-usage) [Schema generation & migration](https://www.better-auth.com/docs/adapters/mongo#schema-generation--migration)
