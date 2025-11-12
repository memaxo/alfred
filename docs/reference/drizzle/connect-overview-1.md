---
title: Drizzle ORM - Database connection
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

# Database connection with Drizzle

Drizzle ORM runs SQL queries on your database via **database drivers**.

index.ts

schema.ts

```
import { drizzle } from "drizzle-orm/node-postgres"
import { users } from "./schema"

const db = drizzle(process.env.DATABASE_URL);
const usersCount = await db.$count(users);
```

```
                        ┌──────────────────────┐
                        │   db.$count(users)   │ <--- drizzle query
                        └──────────────────────┘
                            │               ʌ
select count(*) from users -│               │
                            │               │- [{ count: 0 }]
                            v               │
                         ┌─────────────────────┐
                         │    node-postgres    │ <--- database driver
                         └─────────────────────┘
                            │               ʌ
01101000 01100101 01111001 -│               │
                            │               │- 01110011 01110101 01110000
                            v               │
                         ┌────────────────────┐
                         │      Database      │
                         └────────────────────┘
```

```
import { pgTable, integer, text } from "drizzle-orm";

export const users = pgTable("users", {
  id: integer("id").generateAlwaysAsIdentity(),
  name: text("name"),
})
```

Under the hood Drizzle will create a **node-postgres** driver instance which you can access via `db.$client` if necessary

```
import { drizzle } from "drizzle-orm/node-postgres"

const db = drizzle(process.env.DATABASE_URL);
const pool = db.$client;
```

```
// above is equivalent to
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle({ client: pool });
```

Drizzle is by design natively compatible with every **edge** or **serverless** runtime, whenever you’d need access to a serverless database - we’ve got you covered

Neon HTTP

Neon with websockets

Vercel Postgres

PlanetScale HTTP

Cloudflare d1

```
import { drizzle } from "drizzle-orm/neon-http";

const db = drizzle(process.env.DATABASE_URL);
```

```
import { drizzle } from "drizzle-orm/neon-serverless";

const db = drizzle(process.env.DATABASE_URL);
```

```
import { drizzle } from "drizzle-orm/vercel-postgres";

const db = drizzle();
```

```
import { drizzle } from "drizzle-orm/planetscale";

const db = drizzle(process.env.DATABASE_URL);
```

```
import { drizzle } from "drizzle-orm/d1";

const db = drizzle({ connection: env.DB });
```

And yes, we do support runtime specific drivers like [Bun SQLite](https://orm.drizzle.team/docs/connect-bun-sqlite) or [Expo SQLite](https://orm.drizzle.team/docs/connect-expo-sqlite):

```
import { drizzle } from "drizzle-orm/bun-sqlite"

const db = drizzle(); // <--- will create an in-memory db
const db = drizzle("./sqlite.db");
```

```
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

const expo = openDatabaseSync("db.db");
const db = drizzle(expo);
```

#### Database connection URL

Just in case if you’re not familiar with database connection URL concept

```
postgresql://alex:AbC123dEf@ep-cool-darkness-123456.us-east-2.aws.neon.tech/dbname
             └──┘ └───────┘ └─────────────────────────────────────────────┘ └────┘
              ʌ    ʌ          ʌ                                              ʌ
        role -│    │          │- hostname                                    │- database
                   │
                   │- password

```

#### Next steps

Feel free to check out per-driver documentations

**PostgreSQL drivers**

[PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql) [Neon](https://orm.drizzle.team/docs/connect-neon) [Vercel Postgres](https://orm.drizzle.team/docs/connect-vercel-postgres) [Supabase](https://orm.drizzle.team/docs/connect-supabase) [Xata](https://orm.drizzle.team/docs/connect-xata) [PGLite](https://orm.drizzle.team/docs/connect-pglite)

**MySQL drivers**

[MySQL](https://orm.drizzle.team/docs/get-started-mysql) [PlanetsScale](https://orm.drizzle.team/docs/connect-planetscale) [TiDB](https://orm.drizzle.team/docs/connect-tidb)

**SQLite drivers**

[SQLite](https://orm.drizzle.team/docs/get-started-sqlite) [Turso](https://orm.drizzle.team/docs/connect-turso) [Cloudflare D1](https://orm.drizzle.team/docs/connect-cloudflare-d1) [Bun SQLite](https://orm.drizzle.team/docs/connect-bun-sqlite)

**Native SQLite**

[Expo SQLite](https://orm.drizzle.team/docs/get-started/expo-new) [OP SQLite](https://orm.drizzle.team/docs/connect-op-sqlite) [React Native SQLite](https://orm.drizzle.team/docs/connect-react-native-sqlite)

**Others**

[Drizzle Proxy](https://orm.drizzle.team/docs/connect-drizzle-proxy)