---
title: Drizzle ORM - Cache
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

# Cache

Drizzle sends every query straight to your database by default. There are no hidden actions, no automatic caching
or invalidation - you’ll always see exactly what runs. If you want caching, you must opt in.

By default, Drizzle uses a `explicit` caching strategy (i.e. `global: false`), so nothing is ever cached unless you ask.
This prevents surprises or hidden performance traps in your application.
Alternatively, you can flip on `all` caching ( `global: true`) so that every select will look in cache first.

## Quickstart

### Upstash integration

Drizzle provides an `upstashCache()` helper out of the box. By default, this uses Upstash Redis with automatic configuration if environment variables are set.

```
import { upstashCache } from "drizzle-orm/cache/upstash";
import { drizzle } from "drizzle-orm/...";

const db = drizzle(process.env.DB_URL!, {
  cache: upstashCache(),
});
```

You can also explicitly define your Upstash credentials, enable global caching for all queries by default or pass custom caching options:

```
import { upstashCache } from "drizzle-orm/cache/upstash";
import { drizzle } from "drizzle-orm/...";

const db = drizzle(process.env.DB_URL!, {
  cache: upstashCache({
    // 👇 Redis credentials (optional — can also be pulled from env vars)
    url: '<UPSTASH_URL>',
    token: '<UPSTASH_TOKEN>',

    // 👇 Enable caching for all queries by default (optional)
    global: true,

    // 👇 Default cache behavior (optional)
    config: { ex: 60 }
  })
});
```

## Cache config reference

Drizzle supports the following cache config options for Upstash:

```
export type CacheConfig = {
  /**
   * Expiration in seconds (positive integer)
   */
  ex?: number;
  /**
   * Set an expiration (TTL or time to live) on one or more fields of a given hash key.
   * Used for HEXPIRE command
   */
  hexOptions?: "NX" | "nx" | "XX" | "xx" | "GT" | "gt" | "LT" | "lt";
};
```

## Cache usage examples

Once you’ve configured caching, here’s how the cache behaves:

**Case 1: Drizzle with `global: false` (default, opt-in caching)**

```
import { upstashCache } from "drizzle-orm/cache/upstash";
import { drizzle } from "drizzle-orm/...";

const db = drizzle(process.env.DB_URL!, {
  // 👇 `global: true` is not passed, false by default
  cache: upstashCache({ url: "", token: "" }),
});
```

In this case, the following query won’t read from cache

```
const res = await db.select().from(users);

// Any mutate operation will still trigger the cache's onMutate handler
// and attempt to invalidate any cached queries that involved the affected tables
await db.insert(users).value({ email: "cacheman@upstash.com" });
```

To make this query read from the cache, call `.$withCache()`

```
const res = await db.select().from(users).$withCache();
```

`.$withCache` has a set of options you can use to manage and configure this specific query strategy

```
// rewrite the config for this specific query
.$withCache({ config: {} })

// give this query a custom cache key (instead of hashing query+params under the hood)
.$withCache({ tag: 'custom_key' })

// turn off auto-invalidation for this query
// note: this leads to eventual consistency (explained below)
.$withCache({ autoInvalidate: false })
```

**Eventual consistency example**

This example is only relevant if you manually set `autoInvalidate: false`. By default, `autoInvalidate` is enabled.

You might want to turn off `autoInvalidate` if:

- your data doesn’t change often, and slight staleness is acceptable (e.g. product listings, blog posts)
- you handle cache invalidation manually

In those cases, turning it off can reduce unnecessary cache invalidation. However, in most cases, we recommend keeping the default enabled.

Example: Imagine you cache the following query on `usersTable` with a 3-second TTL:

```
const recent = await db
  .select().from(usersTable)
  .$withCache({ config: { ex: 3 }, autoInvalidate: false });
```

If someone runs `db.insert(usersTable)...` the cache won’t be invalidated immediately. For up to 3 seconds, you’ll keep seeing the old data until it eventually becomes consistent.

**Case 2: Drizzle with `global: true` option**

```
import { upstashCache } from "drizzle-orm/cache/upstash";
import { drizzle } from "drizzle-orm/...";

const db = drizzle(process.env.DB_URL!, {
  cache: upstashCache({ url: "", token: "", global: true }),
});
```

In this case, the following query will read from cache

```
const res = await db.select().from(users);
```

If you want to disable cache for this specific query, call `.$withCache(false)`

```
// disable cache for this query
const res = await db.select().from(users).$withCache(false);
```

You can also use cache instance from a `db` to invalidate specific tables or tags

```
// Invalidate all queries that use the `users` table. You can do this with the Drizzle instance.
await db.$cache.invalidate({ tables: users });
// or
await db.$cache.invalidate({ tables: [users, posts] });

// Invalidate all queries that use the `usersTable`. You can do this by using just the table name.
await db.$cache.invalidate({ tables: "usersTable" });
// or
await db.$cache.invalidate({ tables: ["usersTable", "postsTable"] });

// You can also invalidate custom tags defined in any previously executed select queries.
await db.$cache.invalidate({ tags: "custom_key" });
// or
await db.$cache.invalidate({ tags: ["custom_key", "custom_key1"] });
```

## Custom cache

This example shows how to plug in a custom `cache` in Drizzle: you provide functions to fetch data from the cache, store results back into cache, and invalidate entries whenever a mutation runs.

Cache extension provides this set of config options

```
export type CacheConfig = {
  /** expire time, in seconds */
  ex?: number;
  /** expire time, in milliseconds */
  px?: number;
  /** Unix time (sec) at which the key will expire */
  exat?: number;
  /** Unix time (ms) at which the key will expire */
  pxat?: number;
  /** retain existing TTL when updating a key */
  keepTtl?: boolean;
  /** options for HEXPIRE (hash-field TTL) */
  hexOptions?: 'NX' | 'XX' | 'GT' | 'LT' | 'nx' | 'xx' | 'gt' | 'lt';
};
```

```
const db = drizzle(process.env.DB_URL!, { cache: new TestGlobalCache() });
```

```
import Keyv from "keyv";

export class TestGlobalCache extends Cache {
  private globalTtl: number = 1000;
  // This object will be used to store which query keys were used
  // for a specific table, so we can later use it for invalidation.
  private usedTablesPerKey: Record<string, string[]> = {};

  constructor(private kv: Keyv = new Keyv()) {
    super();
  }

  // For the strategy, we have two options:
  // - 'explicit': The cache is used only when .$withCache() is added to a query.
  // - 'all': All queries are cached globally.
  // The default behavior is 'explicit'.
  override strategy(): "explicit" | "all" {
    return "all";
  }

  // This function accepts query and parameters that cached into key param,
  // allowing you to retrieve response values for this query from the cache.
  override async get(key: string): Promise<any[] | undefined> {
    const res = (await this.kv.get(key)) ?? undefined;
    return res;
  }

  // This function accepts several options to define how cached data will be stored:
  // - 'key': A hashed query and parameters.
  // - 'response': An array of values returned by Drizzle from the database.
  // - 'tables': An array of tables involved in the select queries. This information is needed for cache invalidation.
  //
  // For example, if a query uses the "users" and "posts" tables, you can store this information. Later, when the app executes
  // any mutation statements on these tables, you can remove the corresponding key from the cache.
  // If you're okay with eventual consistency for your queries, you can skip this option.
  override async put(
    key: string,
    response: any,
    tables: string[],
    config?: CacheConfig,
  ): Promise<void> {
    const ttl = config?.px ?? (config?.ex ? config.ex * 1000 : this.globalTtl);

    await this.kv.set(key, response, ttl);

    for (const table of tables) {
      const keys = this.usedTablesPerKey[table];
      if (keys === undefined) {
        this.usedTablesPerKey[table] = [key];
      } else {
        keys.push(key);
      }
    }
  }

  // This function is called when insert, update, or delete statements are executed.
  // You can either skip this step or invalidate queries that used the affected tables.
  //
  // The function receives an object with two keys:
  // - 'tags': Used for queries labeled with a specific tag, allowing you to invalidate by that tag.
  // - 'tables': The actual tables affected by the insert, update, or delete statements,
  //   helping you track which tables have changed since the last cache update.
  override async onMutate(params: {
    tags: string | string[];
    tables: string | string[] | Table<any> | Table<any>[];
  }): Promise<void> {
    const tagsArray = params.tags
      ? Array.isArray(params.tags)
        ? params.tags
        : [params.tags]
      : [];
    const tablesArray = params.tables
      ? Array.isArray(params.tables)
        ? params.tables
        : [params.tables]
      : [];

    const keysToDelete = new Set<string>();

    for (const table of tablesArray) {
      const tableName = is(table, Table)
        ? getTableName(table)
        : (table as string);
      const keys = this.usedTablesPerKey[tableName] ?? [];
      for (const key of keys) keysToDelete.add(key);
    }

    if (keysToDelete.size > 0 || tagsArray.length > 0) {
      for (const tag of tagsArray) {
        await this.kv.delete(tag);
      }

      for (const key of keysToDelete) {
        await this.kv.delete(key);
        for (const table of tablesArray) {
          const tableName = is(table, Table)
            ? getTableName(table)
            : (table as string);
          this.usedTablesPerKey[tableName] = [];
        }
      }
    }
  }
}
```

## Limitations

#### Queries that won’t be handled by the `cache` extension:

- Using cache with raw queries, such as:

```
db.execute(sql`select 1`);
```

- Using cache with `batch` feature in `d1` and `libsql`

```
db.batch([\
    db.insert(users).values(...),\
    db.update(users).set(...).where()\
])
```

- Using cache in transactions

```
await db.transaction(async (tx) => {
  await tx.update(accounts).set(...).where(...);
  await tx.update...
});
```

#### Limitations that are temporary and will be handled soon:

- Using cache with Drizzle Relational Queries

```
await db.query.users.findMany();
```

- Using cache with `better-sqlite3`, `Durable Objects`, `expo sqlite`
- Using cache with AWS Data API drivers
- Using cache with views