---
title: Drizzle ORM - MySQL column types
url: 
description: Drizzle ORM is a lightweight and performant TypeScript ORM with developer experience in mind.
language: en
---

[Drizzle Studio Gateway is now FREE 👀](https://gateway.drizzle.team/)

[**PostgreSQL**](https://orm.drizzle.team/docs/column-types/pg) [**MySQL**](https://orm.drizzle.team/docs/column-types/mysql) [**SQLite**](https://orm.drizzle.team/docs/column-types/sqlite) [**SingleStore**](https://orm.drizzle.team/docs/column-types/singlestore)

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

# MySQL column types

We have native support for all of them, yet if that’s not enough for you, feel free to create **[custom types](https://orm.drizzle.team/docs/custom-types)**.

important

All examples in this part of the documentation do not use database column name aliases, and column names are generated from TypeScript keys.

You can use database aliases in column names if you want, and you can also use the `casing` parameter to define a mapping strategy for Drizzle.

You can read more about it [here](https://orm.drizzle.team/docs/sql-schema-declaration#shape-your-data-schema)

### integer

A signed integer, stored in `0`, `1`, `2`, `3`, `4`, `6`, or `8` bytes depending on the magnitude of the value.

```
import { int, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	int: int()
});
```

```
CREATE TABLE `table` (
	`int` int
);
```

### tinyint

```
import { tinyint, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	tinyint: tinyint()
});
```

```
CREATE TABLE `table` (
	`tinyint` tinyint
);
```

### smallint

```
import { smallint, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	smallint: smallint()
});
```

```
CREATE TABLE `table` (
	`smallint` smallint
);
```

### mediumint

```
import { mediumint, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	mediumint: mediumint()
});
```

```
CREATE TABLE `table` (
	`mediumint` mediumint
);
```

### bigint

```
import { bigint, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	bigint: bigint({ mode: 'number' })
	bigintUnsigned: bigint({ mode: 'number', unsigned: true })
});

bigint('...', { mode: 'number' | 'bigint' });

// You can also specify unsigned option for bigint
bigint('...', { mode: 'number' | 'bigint', unsigned: true })
```

```
CREATE TABLE `table` (
	`bigint` bigint,
	`bigintUnsigned` bigint unsigned
);
```

We’ve omitted config of `M` in `bigint(M)`, since it indicates the display width of the numeric type

## \-\-\-

### real

```
import { real, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	real: real()
});
```

```
CREATE TABLE `table` (
	`real` real
);
```

```
import { real, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	realPrecision: real({ precision: 1,}),
	realPrecisionScale: real({ precision: 1, scale: 1,}),
});
```

```
CREATE TABLE `table` (
	`realPrecision` real(1),
	`realPrecisionScale` real(1, 1)
);
```

### decimal

```
import { decimal, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	decimal: decimal(),
	decimalNum: decimal({ scale: 30, mode: 'number' }),
	decimalBig: decimal({ scale: 30, mode: 'bigint' }),
});
```

```
CREATE TABLE `table` (
	`decimal` decimal,
	`decimalNum` decimal(30),
	`decimalBig` decimal(30)
);
```

```
import { decimal, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	decimalPrecision: decimal({ precision: 1,}),
	decimalPrecisionScale: decimal({ precision: 1, scale: 1,}),
});
```

```
CREATE TABLE `table` (
	`decimalPrecision` decimal(1),
	`decimalPrecisionScale` decimal(1, 1)
);
```

### double

```
import { double, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	double: double('double')
});
```

```
CREATE TABLE `table` (
	`double` double
);
```

```
import { double, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	doublePrecision: double({ precision: 1,}),
	doublePrecisionScale: double({ precision: 1, scale: 1,}),
});
```

```
CREATE TABLE `table` (
	`doublePrecision` double(1),
	`doublePrecisionScale` double(1, 1)
);
```

### float

```
import { float, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	float: float()
});
```

```
CREATE TABLE `table` (
	`float` float
);
```

## \-\-\-

### serial

`SERIAL` is an alias for `BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE`.

```
import { serial, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	serial: serial()
});
```

```
CREATE TABLE `table` (
	`serial` serial AUTO_INCREMENT
);
```

## \-\-\-

### binary

`BINARY(M)` stores a fixed-length byte string of exactly M bytes.

On insert, shorter values are right-padded with `0x00` bytes to reach M bytes; on retrieval, no padding is stripped.
All bytes—including trailing `0x00`—are significant in comparisons, `ORDER BY`, and `DISTINCT`

```
import { binary, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	binary: binary()
});
```

```
CREATE TABLE `table` (
	`binary` binary
);
```

### varbinary

`VARBINARY(M)` stores a variable-length byte string of exactly M bytes.

On insert, shorter values are right-padded with `0x00` bytes to reach M bytes; on retrieval, no padding is stripped.
All bytes—including trailing `0x00`—are significant in comparisons, `ORDER BY`, and `DISTINCT`

```
import { varbinary, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	varbinary: varbinary({ length: 2}),
});
```

```
CREATE TABLE `table` (
	`varbinary` varbinary(2)
);
```

## \-\-\-

### char

```
import { char, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	char: char(),
});
```

```
CREATE TABLE `table` (
	`char` char
);
```

### varchar

You can define `{ enum: ["value1", "value2"] }` config to infer `insert` and `select` types, it **won’t** check runtime values.

```
import { varchar, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	varchar: varchar({ length: 2 }),
});

// will be inferred as text: "value1" | "value2" | null
varchar: varchar({ length: 6, enum: ["value1", "value2"] })
```

```
CREATE TABLE `table` (
	`varchar` varchar(2)
);
```

### text

You can define `{ enum: ["value1", "value2"] }` config to infer `insert` and `select` types, it **won’t** check runtime values.

```
import { text, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	text: text(),
});

// will be inferred as text: "value1" | "value2" | null
text: text({ enum: ["value1", "value2"] });
```

```
CREATE TABLE `table` (
	`text` text
);
```

## \-\-\-

### boolean

```
import { boolean, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	boolean: boolean(),
});
```

```
CREATE TABLE `table` (
	`boolean` boolean
);
```

## \-\-\-

### date

```
import { boolean, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	date: date(),
});
```

```
CREATE TABLE `table` (
	`date` date
);
```

### datetime

```
import { datetime, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	datetime: datetime(),
});

datetime('...', { mode: 'date' | "string"}),
datetime('...', { fsp : 0..6}),
```

```
CREATE TABLE `table` (
	`datetime` datetime
);
```

```
import { datetime, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	datetime: datetime({ mode: 'date', fsp: 6 }),
});
```

```
CREATE TABLE `table` (
	`datetime` datetime(6)
);
```

### time

```
import { time, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	time: time(),
	timefsp: time({ fsp: 6 }),
});

time('...', { fsp: 0..6 }),
```

```
CREATE TABLE `table` (
	`time` time,
	`timefsp` time(6)
);
```

### year

```
import { year, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	year: year(),
});
```

```
CREATE TABLE `table` (
	`year` year
);
```

### timestamp

```
import { timestamp, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	timestamp: timestamp(),
});

timestamp('...', { mode: 'date' | "string"}),
timestamp('...', { fsp : 0..6}),
```

```
CREATE TABLE `table` (
	`timestamp` timestamp
);
```

```
import { timestamp, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	timestamp: timestamp({ mode: 'date', fsp: 6 }),
});
```

```
CREATE TABLE `table` (
	`timestamp` timestamp(6)
);
```

```
import { timestamp, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	timestamp: timestamp().defaultNow(),
});
```

```
CREATE TABLE `table` (
	`timestamp` timestamp DEFAULT (now())
);
```

## \-\-\-

### json

```
import { json, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	json: json(),
});

```

```
CREATE TABLE `table` (
	`json` json
);
```

You can specify `.$type<..>()` for json object inference, it **won’t** check runtime values.
It provides compile time protection for default values, insert and select schemas.

```
// will be inferred as { foo: string }
json: json().$type<{ foo: string }>();

// will be inferred as string[]
json: json().$type<string[]>();

// won't compile
json: json().$type<string[]>().default({});
```

## \-\-\-

### enum

```
import { mysqlEnum, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	popularity: mysqlEnum(['unknown', 'known', 'popular']),
});
```

```
CREATE TABLE `table` (
	`popularity` enum('unknown','known','popular')
);
```

## \-\-\-

### Customizing data type

Every column builder has a `.$type()` method, which allows you to customize the data type of the column. This is useful, for example, with unknown or branded types.

```
type UserId = number & { __brand: 'user_id' };
type Data = {
	foo: string;
	bar: number;
};

const users = mysqlTable('users', {
  id: int().$type<UserId>().primaryKey(),
  jsonField: json().$type<Data>(),
});
```

### Not null

`NOT NULL` constraint dictates that the associated column may not contain a `NULL` value.

```
import { int, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	int: int().notNull(),
});
```

```
CREATE TABLE `table` (
	`int` int NOT NULL
);
```

### Default value

The `DEFAULT` clause specifies a default value to use for the column if no value
is explicitly provided by the user when doing an `INSERT`.
If there is no explicit `DEFAULT` clause attached to a column definition,
then the default value of the column is `NULL`.

An explicit `DEFAULT` clause may specify that the default value is `NULL`,
a string constant, a blob constant, a signed-number, or any constant expression enclosed in parentheses.

```
import { int, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	int: int().default(3),
});
```

```
CREATE TABLE `table` (
	`int` int DEFAULT 3
);
```

When using `$default()` or `$defaultFn()`, which are simply different aliases for the same function,
you can generate defaults at runtime and use these values in all insert queries.
These functions can assist you in utilizing various implementations such as `uuid`, `cuid`, `cuid2`, and many more.

Note: This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`

```
import { varchar, mysqlTable } from "drizzle-orm/mysql-core";
import { createId } from '@paralleldrive/cuid2';

const table = mysqlTable('table', {
	id: varchar({ length: 128 }).$defaultFn(() => createId()),
});
```

When using `$onUpdate()` or `$onUpdateFn()`, which are simply different aliases for the same function,
you can generate defaults at runtime and use these values in all update queries.

Adds a dynamic update value to the column. The function will be called when the row is updated,
and the returned value will be used as the column value if none is provided.
If no default (or $defaultFn) value is provided, the function will be called
when the row is inserted as well, and the returned value will be used as the column value.

Note: This value does not affect the `drizzle-kit` behavior, it is only used at runtime in `drizzle-orm`

```
import { text, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
    alwaysNull: text().$type<string | null>().$onUpdate(() => null),
});
```

### Primary key

```
import { int, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	int: int().primaryKey(),
});
```

```
CREATE TABLE `table` (
	`int` int PRIMARY KEY NOT NULL
);
```

### Auto increment

```
import { int, mysqlTable } from "drizzle-orm/mysql-core";

const table = mysqlTable('table', {
	int: int().autoincrement(),
});
```

```
CREATE TABLE `table` (
	`int` int AUTO_INCREMENT
);
```