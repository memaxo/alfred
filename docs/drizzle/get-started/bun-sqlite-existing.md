---
title: Drizzle ORM - SQLite
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

Bun SQLite

Existing database

Meet Drizzle

[Get started](https://orm.drizzle.team/docs/get-started)

New database

Existing database

PostgreSQL  Neon  Vercel Postgres  Supabase  Xata  PGLite  Nile  Bun SQL  Gel  MySQL  PlanetScale  TiDB  SingleStore  SQLite  Turso  Cloudflare D1  Bun SQLite  Cloudflare Durable Objects  Expo SQLite  OP SQLite

# Get Started with Drizzle and Bun:SQLite in existing project

This guide assumes familiarity with:

- **dotenv** \- package for managing environment variables - [read here](https://www.npmjs.com/package/dotenv)
- **tsx** \- package for running TypeScript files - [read here](https://tsx.is/)
- **bun** \- javaScript all-in-one toolkit - [read here](https://bun.sh/)
- **bun:sqlite** \- native implementation of a high-performance SQLite3 driver - [read here](https://bun.sh/docs/api/sqlite)

#### Basic file structure

This is the basic file structure of the project. In the `src/db` directory, we have table definition in `schema.ts`. In `drizzle` folder there are sql migration file and snapshots.

```
📦 <project root>
 ├ 📂 drizzle
 ├ 📂 src
 │   ├ 📂 db
 │   │  └ 📜 schema.ts
 │   └ 📜 index.ts
 ├ 📜 .env
 ├ 📜 drizzle.config.ts
 ├ 📜 package.json
 └ 📜 tsconfig.json
```

#### Step 1 - Install required packages

npm

yarn

pnpm

bun

```
npm i drizzle-orm dotenv
npm i -D drizzle-kit tsx @types/bun
```

```
yarn add drizzle-orm dotenv
yarn add -D drizzle-kit tsx @types/bun
```

```
pnpm add drizzle-orm dotenv
pnpm add -D drizzle-kit tsx @types/bun
```

```
bun add drizzle-orm dotenv
bun add -D drizzle-kit tsx @types/bun
```

#### Step 2 - Setup connection variables

Create a `.env` file in the root of your project and add your database connection variable:

```
DB_FILE_NAME=
```

important

For example, if you have an SQLite database file in the root of your project, you can use this example:

```
DB_FILE_NAME=mydb.sqlite
```

#### Step 3 - Setup Drizzle config file

**Drizzle config** \- a configuration file that is used by [Drizzle Kit](https://orm.drizzle.team/docs/kit-overview) and contains all the information about your database connection, migration folder and schema files.

Create a `drizzle.config.ts` file in the root of your project and add the following content:

```
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_FILE_NAME!,
  },
});
```

#### Step 4 - Introspect your database

Drizzle Kit provides a CLI command to introspect your database and generate a schema file with migrations. The schema file contains all the information about your database tables, columns, relations, and indices.

For example, you have such table in your database:

```
CREATE TABLE `users_table` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`age` integer NOT NULL,
	`email` text NOT NULL UNIQUE
);
```

Pull your database schema:

```
npx drizzle-kit pull
```

The result of introspection will be a `schema.ts` file, `meta` folder with snapshots of your database schema,
sql file with the migration and `relations.ts` file for [relational queries](https://orm.drizzle.team/docs/rqb).

Here is an example of the generated `schema.ts` file:

```
// table schema generated by introspection
import {
  sqliteTable,
  uniqueIndex,
  integer,
  text,
} from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable(
  "users_table",
  {
    id: integer().primaryKey({ autoIncrement: true }).notNull(),
    name: text().notNull(),
    age: integer().notNull(),
    email: text().notNull(),
  },
  (table) => [\
    uniqueIndex("users_table_email_unique").on(table.email)\
  ]
);
```

Learn more about introspection in the [documentation](https://orm.drizzle.team/docs/drizzle-kit-pull).

#### Step 5 - Transfer code to your actual schema file

We recommend transferring the generated code from `drizzle/schema.ts` and `drizzle/relations.ts` to the actual schema file. In this guide we transferred code to `src/db/schema.ts`. Generated files for schema and relations can be deleted. This way you can manage your schema in a more structured way.

```
 ├ 📂 drizzle
 │ ├ 📂 meta
 │ ├ 📜 migration.sql
 │ ├ 📜 relations.ts ────────┐
 │ └ 📜 schema.ts ───────────┤
 ├ 📂 src                    │
 │ ├ 📂 db                   │
 │ │ ├ 📜 relations.ts <─────┤
 │ │ └ 📜 schema.ts <────────┘
 │ └ 📜 index.ts
 └ …
```

#### Step 6 - Connect Drizzle ORM to the database

Create a `index.ts` file in the `src` directory and initialize the connection:

bun:sqlite

bun:sqlite with config

```
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/bun-sqlite';

const db = drizzle(process.env.DB_FILE_NAME!);
```

```
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/bun-sqlite';

// You can specify any property from the bun:sql connection options
const db = drizzle({ connection: { source: process.env.DB_FILE_NAME! }});
```

If you need to provide your existing driver:

```
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';

const sqlite = new Database(process.env.DB_FILE_NAME!);
const db = drizzle({ client: sqlite });
```

#### Step 7 - Query the database

Let’s **update** the `src/index.ts` file with queries to create, read, update, and delete users

```
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import { usersTable } from './db/schema';

const db = drizzle(process.env.DB_FILE_NAME!);

async function main() {
  const user: typeof usersTable.$inferInsert = {
    name: 'John',
    age: 30,
    email: 'john@example.com',
  };

  await db.insert(usersTable).values(user);
  console.log('New user created!')

  const users = await db.select().from(usersTable);
  console.log('Getting all users from the database: ', users)
  /*
  const users: {
    id: number;
    name: string;
    age: number;
    email: string;
  }[]
  */

  await db
    .update(usersTable)
    .set({
      age: 31,
    })
    .where(eq(usersTable.email, user.email));
  console.log('User info updated!')

  await db.delete(usersTable).where(eq(usersTable.email, user.email));
  console.log('User deleted!')
}

main();
```

#### Step 8 - Run index.ts file

To run a script with `bun`, use the following command:

```
bun src/index.ts
```

#### Step 9 - Update your table schema (optional)

If you want to update your table schema, you can do it in the `schema.ts` file. For example, let’s add a new column `phone` to the `users_table`:

```
// table schema generated by introspection
import {
  sqliteTable,
  uniqueIndex,
  integer,
  text,
} from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable(
  "users_table",
  {
    id: integer().primaryKey({ autoIncrement: true }).notNull(),
    name: text().notNull(),
    age: integer().notNull(),
    email: text().notNull(),
    phone: text(),
  },
  (table) => [\
    uniqueIndex("users_table_email_unique").on(table.email)\
  ]
);
```

#### Step 9 - Applying changes to the database (optional)

You can directly apply changes to your database using the `drizzle-kit push` command. This is a convenient method for quickly testing new schema designs or modifications in a local development environment, allowing for rapid iterations without the need to manage migration files:

```
npx drizzle-kit push
```

Read more about the push command in [documentation](https://orm.drizzle.team/docs/drizzle-kit-push).

Tips

Alternatively, you can generate migrations using the `drizzle-kit generate` command and then apply them using the `drizzle-kit migrate` command:

Generate migrations:

```
npx drizzle-kit generate
```

Apply migrations:

```
npx drizzle-kit migrate
```

Read more about migration process in [documentation](https://orm.drizzle.team/docs/kit-overview).

#### Step 10 - Query the database with a new field (optional)

```
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import { usersTable } from './db/schema';

const db = drizzle(process.env.DB_FILE_NAME!);

async function main() {
  const user: typeof usersTable.$inferInsert = {
    name: 'John',
    age: 30,
    email: 'john@example.com',
    phone: '123-456-7890',
  };

  await db.insert(usersTable).values(user);
  console.log('New user created!')

  const users = await db.select().from(usersTable);
  console.log('Getting all users from the database: ', users)
  /*
  const users: {
    id: number;
    name: string;
    age: number;
    email: string;
    phone: string | null;
  }[]
  */

  await db
    .update(usersTable)
    .set({
      age: 31,
    })
    .where(eq(usersTable.email, user.email));
  console.log('User info updated!')

  await db.delete(usersTable).where(eq(usersTable.email, user.email));
  console.log('User deleted!')
}

main();
```