---
title: Drizzle ORM - Native SQLite
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

OP SQLite

New database

Meet Drizzle

[Get started](https://orm.drizzle.team/docs/get-started)

New database

Existing database

PostgreSQL  Neon  Vercel Postgres  Supabase  Xata  PGLite  Nile  Bun SQL  Gel  MySQL  PlanetScale  TiDB  SingleStore  SQLite  Turso  Cloudflare D1  Bun SQLite  Cloudflare Durable Objects  Expo SQLite  OP SQLite

# Get Started with Drizzle and OP-SQLite

This guide assumes familiarity with:

- **OP-SQLite** \- SQLite library for react-native - [read here](https://github.com/OP-Engineering/op-sqlite)

#### Step 1 - Setup a project from Expo Template

npm

yarn

pnpm

bun

```
npx create expo-app --template blank-typescript
```

```
yarn create expo-app --template blank-typescript
```

```
pnpm create expo-app --template blank-typescript
```

```
bunx create expo-app --template blank-typescript
```

You can read more about this template [here](https://docs.expo.dev/more/create-expo/#create-a-new-project).

#### Basic file structure

After installing the template and adding the `db` folder, you’ll find the following content: In the `db/schema.ts` file with drizzle table definitions. The `drizzle` folder contains SQL migration files and snapshots

```
📦 <project root>
 ├ 📂 assets
 ├ 📂 drizzle
 ├ 📂 db
 │  └ 📜 schema.ts
 ├ 📜 .gitignore
 ├ 📜 .npmrc
 ├ 📜 app.json
 ├ 📜 App.tsx
 ├ 📜 babel.config.ts
 ├ 📜 drizzle.config.ts
 ├ 📜 package.json
 └ 📜 tsconfig.json
```

#### Step 2 - Install required packages

npm

yarn

pnpm

bun

```
npm i drizzle-orm @op-engineering/op-sqlite
npm i -D drizzle-kit
```

```
yarn add drizzle-orm @op-engineering/op-sqlite
yarn add -D drizzle-kit
```

```
pnpm add drizzle-orm @op-engineering/op-sqlite
pnpm add -D drizzle-kit
```

```
bun add drizzle-orm @op-engineering/op-sqlite
bun add -D drizzle-kit
```

#### Step 3 - Connect Drizzle ORM to the database

Create a `App.tsx` file in the root directory and initialize the connection:

```
import { open } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';

const opsqliteDb = open({
  name: 'db',
});

const db = drizzle(opsqliteDb);
```

#### Step 4 - Create a table

Create a `schema.ts` file in the `db` directory and declare your table:

```
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable("users_table", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  age: int().notNull(),
  email: text().notNull().unique(),
});
```

#### Step 5 - Setup Drizzle config file

**Drizzle config** \- a configuration file that is used by [Drizzle Kit](https://orm.drizzle.team/docs/kit-overview) and contains all the information about your database connection, migration folder and schema files.

Create a `drizzle.config.ts` file in the root of your project and add the following content:

```
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './db/schema.ts',
  out: './drizzle',
});
```

#### Step 6 - Setup `metro` config

Create a file `metro.config.js` in root folder and add this code inside:

```
const { getDefaultConfig } = require('expo/metro-config');
/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');
module.exports = config;
```

#### Step 7 - Update `babel` config

```
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [["inline-import", { "extensions": [".sql"] }]] // <-- add this
  };
};
```

#### Step 8 - Applying changes to the database

With Expo, you would need to generate migrations using the `drizzle-kit generate` command and then apply them at runtime using the `drizzle-orm` `migrate()` function

Generate migrations:

```
npx drizzle-kit generate
```

#### Step 9 - Apply migrations and query your db:

Let’s **App.tsx** file with migrations and queries to create, read, update, and delete users

```
import { Text, View } from 'react-native';
import { open } from '@op-engineering/op-sqlite';
import { useEffect, useState } from 'react';
import { drizzle } from 'drizzle-orm/op-sqlite';
import { usersTable } from './db/schema';
import { useMigrations } from 'drizzle-orm/op-sqlite/migrator';
import migrations from './drizzle/migrations';

const opsqliteDb = open({
  name: 'db',
});

const db = drizzle(opsqliteDb);

export default function App() {
  const { success, error } = useMigrations(db, migrations);
  const [items, setItems] = useState<typeof usersTable.$inferSelect[] | null>(null);

  useEffect(() => {
    if (!success) return;

    (async () => {
      await db.delete(usersTable);

      await db.insert(usersTable).values([\
        {\
            name: 'John',\
            age: 30,\
            email: 'john@example.com',\
        },\
      ]);

      const users = await db.select().from(usersTable);
      setItems(users);
    })();
  }, [success]);

  if (error) {
    return (
      <View>
        <Text>Migration error: {error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View>
        <Text>Migration is in progress...</Text>
      </View>
    );
  }

  if (items === null || items.length === 0) {
    return (
      <View>
        <Text>Empty</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
      }}
    >
      {items.map((item) => (
        <Text key={item.id}>{item.email}</Text>
      ))}
    </View>
  );
}
```

#### Step 10 - Prebuild and run expo app

npm

yarn

pnpm

bun

```
npx expo run:ios
```

```
yarn expo run:ios
```

```
pnpm expo run:ios
```

```
bun expo run:ios
```