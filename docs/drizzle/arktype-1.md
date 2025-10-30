---
title: Drizzle ORM - drizzle-arktype
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

# drizzle-arktype

`drizzle-arktype` is a plugin for **[Drizzle ORM](https://github.com/drizzle-team/drizzle-orm)** that allows you to generate **[Arktype](https://arktype.io/)** schemas from Drizzle ORM schemas.

### Install the dependencies

npm

yarn

pnpm

bun

```
npm i drizzle-arktype
```

```
yarn add drizzle-arktype
```

```
pnpm add drizzle-arktype
```

```
bun add drizzle-arktype
```

IMPORTANT

This documentation is for `drizzle-arktype@0.1.0` and higher

You must also have Drizzle ORM v0.36.0 or greater and Arktype v2.0.0 or greater installed.

### Select schema

Defines the shape of data queried from the database - can be used to validate API responses.

```
import { pgTable, text, integer } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-arktype';

const users = pgTable('users', {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  name: text().notNull(),
  age: integer().notNull()
});

const userSelectSchema = createSelectSchema(users);

const rows = await db.select({ id: users.id, name: users.name }).from(users).limit(1);
const parsed: { id: number; name: string; age: number } = userSelectSchema(rows[0]); // Error: `age` is not returned in the above query

const rows = await db.select().from(users).limit(1);
const parsed: { id: number; name: string; age: number } = userSelectSchema(rows[0]); // Will parse successfully
```

Views and enums are also supported.

```
import { pgEnum } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-arktype';

const roles = pgEnum('roles', ['admin', 'basic']);
const rolesSchema = createSelectSchema(roles);
const parsed: 'admin' | 'basic' = rolesSchema(...);

const usersView = pgView('users_view').as((qb) => qb.select().from(users).where(gt(users.age, 18)));
const usersViewSchema = createSelectSchema(usersView);
const parsed: { id: number; name: string; age: number } = usersViewSchema(...);
```

### Insert schema

Defines the shape of data to be inserted into the database - can be used to validate API requests.

```
import { pgTable, text, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-arktype';

const users = pgTable('users', {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  name: text().notNull(),
  age: integer().notNull()
});

const userInsertSchema = createInsertSchema(users);

const user = { name: 'John' };
const parsed: { name: string, age: number } = userInsertSchema(user); // Error: `age` is not defined

const user = { name: 'Jane', age: 30 };
const parsed: { name: string, age: number } = userInsertSchema(user); // Will parse successfully
await db.insert(users).values(parsed);
```

### Update schema

Defines the shape of data to be updated in the database - can be used to validate API requests.

```
import { pgTable, text, integer } from 'drizzle-orm/pg-core';
import { createUpdateSchema } from 'drizzle-arktype';
import { parse } from 'arktype';

const users = pgTable('users', {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  name: text().notNull(),
  age: integer().notNull()
});

const userUpdateSchema = createUpdateSchema(users);

const user = { id: 5, name: 'John' };
const parsed: { name?: string | undefined, age?: number | undefined } = userUpdateSchema(user); // Error: `id` is a generated column, it can't be updated

const user = { age: 35 };
const parsed: { name?: string | undefined, age?: number | undefined } = userUpdateSchema(user); // Will parse successfully
await db.update(users).set(parsed).where(eq(users.name, 'Jane'));
```

### Refinements

Each create schema function accepts an additional optional parameter that you can used to extend, modify or completely overwite a field’s schema. Defining a callback function will extend or modify while providing a arktype schema will overwrite it.

```
import { pgTable, text, integer, json } from 'drizzle-orm/pg-core';
import { createSelectSchema } from 'drizzle-arktype';
import { parse, pipe, maxLength, object, string } from 'arktype';

const users = pgTable('users', {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  name: text().notNull(),
  bio: text(),
  preferences: json()
});

const userSelectSchema = createSelectSchema(users, {
  name: (schema) => pipe(schema, maxLength(20)), // Extends schema
  bio: (schema) => pipe(schema, maxLength(1000)), // Extends schema before becoming nullable/optional
  preferences: object({ theme: string() }) // Overwrites the field, including its nullability
});

const parsed: {
  id: number;
  name: string,
  bio?: string | undefined;
  preferences: {
    theme: string;
  };
} = userSelectSchema(...);
```

### Data type reference

```
pg.boolean();

mysql.boolean();

sqlite.integer({ mode: 'boolean' });

// Schema
type.boolean;
```

```
pg.date({ mode: 'date' });
pg.timestamp({ mode: 'date' });

mysql.date({ mode: 'date' });
mysql.datetime({ mode: 'date' });
mysql.timestamp({ mode: 'date' });

sqlite.integer({ mode: 'timestamp' });
sqlite.integer({ mode: 'timestamp_ms' });

// Schema
type.Date;
```

```
pg.date({ mode: 'string' });
pg.timestamp({ mode: 'string' });
pg.cidr();
pg.inet();
pg.interval();
pg.macaddr();
pg.macaddr8();
pg.numeric();
pg.text();
pg.sparsevec();
pg.time();

mysql.binary();
mysql.date({ mode: 'string' });
mysql.datetime({ mode: 'string' });
mysql.decimal();
mysql.time();
mysql.timestamp({ mode: 'string' });
mysql.varbinary();

sqlite.numeric();
sqlite.text({ mode: 'text' });

// Schema
type.string;
```

```
pg.bit({ dimensions: ... });

// Schema
type(`/^[01]{${column.dimensions}}$/`);
```

```
pg.uuid();

// Schema
type(/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iu);
```

```
pg.char({ length: ... });

mysql.char({ length: ... });

// Schema
type.string.exactlyLength(length);
```

```
pg.varchar({ length: ... });

mysql.varchar({ length: ... });

sqlite.text({ mode: 'text', length: ... });

// Schema
type.string.atMostLength(length);
```

```
mysql.tinytext();

// Schema
type.string.atMostLength(255); // unsigned 8-bit integer limit
```

```
mysql.text();

// Schema
type.string.atMostLength(65_535); // unsigned 16-bit integer limit
```

```
mysql.mediumtext();

// Schema
type.string.atMostLength(16_777_215); // unsigned 24-bit integer limit
```

```
mysql.longtext();

// Schema
type.string.atMostLength(4_294_967_295); // unsigned 32-bit integer limit
```

```
pg.text({ enum: ... });
pg.char({ enum: ... });
pg.varchar({ enum: ... });

mysql.tinytext({ enum: ... });
mysql.mediumtext({ enum: ... });
mysql.text({ enum: ... });
mysql.longtext({ enum: ... });
mysql.char({ enum: ... });
mysql.varchar({ enum: ... });
mysql.mysqlEnum(..., ...);

sqlite.text({ mode: 'text', enum: ... });

// Schema
type.enumerated(...enum);
```

```
mysql.tinyint();

// Schema
type.keywords.number.integer.atLeast(-128).atMost(127); // 8-bit integer lower and upper limit
```

```
mysql.tinyint({ unsigned: true });

// Schema
type.keywords.number.integer.atLeast(0).atMost(255); // unsigned 8-bit integer lower and upper limit
```

```
pg.smallint();
pg.smallserial();

mysql.smallint();

// Schema
type.keywords.number.integer.atLeast(-32_768).atMost(32_767); // 16-bit integer lower and upper limit
```

```
mysql.smallint({ unsigned: true });

// Schema
type.keywords.number.integer.atLeast(0).atMost(65_535); // unsigned 16-bit integer lower and upper limit
```

```
pg.real();

mysql.float();

// Schema
type.number.atLeast(-8_388_608).atMost(8_388_607); // 24-bit integer lower and upper limit
```

```
mysql.mediumint();

// Schema
type.keywords.number.integer.atLeast(-8_388_608).atMost(8_388_607); // 24-bit integer lower and upper limit
```

```
mysql.float({ unsigned: true });

// Schema
type.number.atLeast(0).atMost(16_777_215); // unsigned 24-bit integer lower and upper limit
```

```
mysql.mediumint({ unsigned: true });

// Schema
type.keywords.number.integer.atLeast(0).atMost(16_777_215); // unsigned 24-bit integer lower and upper limit
```

```
pg.integer();
pg.serial();

mysql.int();

// Schema
type.keywords.number.integer.atLeast(-2_147_483_648).atMost(2_147_483_647); // 32-bit integer lower and upper limit
```

```
mysql.int({ unsigned: true });

// Schema
type.keywords.number.integer.atLeast(0).atMost(4_294_967_295); // unsgined 32-bit integer lower and upper limit
```

```
pg.doublePrecision();

mysql.double();
mysql.real();

sqlite.real();

// Schema
type.number.atLeast(-140_737_488_355_328).atMost(140_737_488_355_327); // 48-bit integer lower and upper limit
```

```
mysql.double({ unsigned: true });

// Schema
type.number.atLeast(0).atMost(281_474_976_710_655); // unsigned 48-bit integer lower and upper limit
```

```
pg.bigint({ mode: 'number' });
pg.bigserial({ mode: 'number' });

mysql.bigint({ mode: 'number' });
mysql.bigserial({ mode: 'number' });

sqlite.integer({ mode: 'number' });

// Schema
type.keywords.number.integer.atLeast(-9_007_199_254_740_991).atMost(9_007_199_254_740_991); // Javascript min. and max. safe integers
```

```
mysql.serial();

// Schema
type.keywords.number.integer.atLeast(0).atMost(9_007_199_254_740_991); // Javascript max. safe integer
```

```
pg.bigint({ mode: 'bigint' });
pg.bigserial({ mode: 'bigint' });

mysql.bigint({ mode: 'bigint' });

sqlite.blob({ mode: 'bigint' });

// Schema
type.bigint.narrow(
  (value, ctx) => value < -9_223_372_036_854_775_808n ? ctx.mustBe('greater than') : value > 9_223_372_036_854_775_807n ? ctx.mustBe('less than') : true
); // 64-bit integer lower and upper limit
```

```
mysql.bigint({ mode: 'bigint', unsigned: true });

// Schema
type.bigint.narrow(
  (value, ctx) => value < 0n ? ctx.mustBe('greater than') : value > 18_446_744_073_709_551_615n ? ctx.mustBe('less than') : true
); // unsigned 64-bit integer lower and upper limit
```

```
mysql.year();

// Schema
type.keywords.number.integer.atLeast(1_901).atMost(2_155);
```

```
pg.geometry({ type: 'point', mode: 'tuple' });
pg.point({ mode: 'tuple' });

// Schema
type([type.number, type.number]);
```

```
pg.geometry({ type: 'point', mode: 'xy' });
pg.point({ mode: 'xy' });

// Schema
type({ x: type.number, y: type.number });
```

```
pg.halfvec({ dimensions: ... });
pg.vector({ dimensions: ... });

// Schema
type.number.array().exactlyLength(dimensions);
```

```
pg.line({ mode: 'abc' });

// Schema
type({ a: type.number, b: type.number, c: type.number });
```

```
pg.line({ mode: 'tuple' });

// Schema
type([type.number, type.number, type.number]);
```

```
pg.json();
pg.jsonb();

mysql.json();

sqlite.blob({ mode: 'json' });
sqlite.text({ mode: 'json' });

// Schema
type('string | number | boolean | null').or(type('unknown.any[] | Record<string, unknown.any>'));
```

```
sqlite.blob({ mode: 'buffer' });

// Schema
type.instanceOf(Buffer);
```

```
pg.dataType().array(...);

// Schema
baseDataTypeSchema.array().exactlyLength(size);
```