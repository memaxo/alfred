---
title: SQLite – API | Bun Docs
url:
description: The fastest SQLite driver for JavaScript is baked directly into Bun.
language: en
---

Search`` `K`

Ask AI

![ai chat avatar](https://bun.com/logo_avatar.svg)

Intro

[What is Bun?](https://bun.com/docs/index) [Installation](https://bun.com/docs/installation) [Quickstart](https://bun.com/docs/quickstart) [TypeScript](https://bun.com/docs/typescript)

Templating

[`bun init`](https://bun.com/docs/cli/init) [`bun create`](https://bun.com/docs/cli/bun-create)

Runtime

[`bun run`](https://bun.com/docs/cli/run) [File types](https://bun.com/docs/runtime/loaders) [TypeScript](https://bun.com/docs/runtime/typescript) [JSX](https://bun.com/docs/runtime/jsx) [Environment variables](https://bun.com/docs/runtime/env) [Bun APIs](https://bun.com/docs/runtime/bun-apis) [Web APIs](https://bun.com/docs/runtime/web-apis) [Node.js compatibility](https://bun.com/docs/runtime/nodejs-apis) [Single-file executable](https://bun.com/docs/bundler/executables) [Plugins](https://bun.com/docs/runtime/plugins) [Watch mode](https://bun.com/docs/runtime/hot) [Module resolution](https://bun.com/docs/runtime/modules) [Auto-install](https://bun.com/docs/runtime/autoimport) [bunfig.toml](https://bun.com/docs/runtime/bunfig) [Debugger](https://bun.com/docs/runtime/debugger)

Framework APISOON

Package manager

[`bun install`](https://bun.com/docs/cli/install) [`bun add`](https://bun.com/docs/cli/add) [`bun remove`](https://bun.com/docs/cli/remove) [`bun update`](https://bun.com/docs/cli/update) [`bun publish`](https://bun.com/docs/cli/publish) [`bun outdated`](https://bun.com/docs/cli/outdated) [`bun link`](https://bun.com/docs/cli/link) [`bun pm`](https://bun.com/docs/cli/pm) [`bun why`](https://bun.com/docs/cli/why) [Global cache](https://bun.com/docs/install/cache) [Isolated installs](https://bun.com/docs/install/isolated) [Workspaces](https://bun.com/docs/install/workspaces) [Catalogs](https://bun.com/docs/install/catalogs) [Lifecycle scripts](https://bun.com/docs/install/lifecycle) [Filter](https://bun.com/docs/cli/filter) [Lockfile](https://bun.com/docs/install/lockfile) [Scopes and registries](https://bun.com/docs/install/registries) [Overrides and resolutions](https://bun.com/docs/install/overrides) [Patch dependencies](https://bun.com/docs/install/patch) [Audit dependencies](https://bun.com/docs/install/audit) [.npmrc support](https://bun.com/docs/install/npmrc) [Security Scanner API](https://bun.com/docs/install/security-scanner-api)

Bundler

[`Bun.build`](https://bun.com/docs/bundler) [HTML & static sites](https://bun.com/docs/bundler/html) [CSS](https://bun.com/docs/bundler/css) [Fullstack Dev Server](https://bun.com/docs/bundler/fullstack) [Hot reloading](https://bun.com/docs/bundler/hmr) [Loaders](https://bun.com/docs/bundler/loaders) [Plugins](https://bun.com/docs/bundler/plugins) [Macros](https://bun.com/docs/bundler/macros) [vs esbuild](https://bun.com/docs/bundler/vs-esbuild)

Test runner

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite)

[Database](https://bun.com/docs/api/sqlite#database) [Strict mode](https://bun.com/docs/api/sqlite#strict-mode) [Load via ES module import](https://bun.com/docs/api/sqlite#load-via-es-module-import) [`.close(throwOnError: boolean = false)`](https://bun.com/docs/api/sqlite#close-throwonerror-boolean-false) [`using` statement](https://bun.com/docs/api/sqlite#using-statement) [`.serialize()`](https://bun.com/docs/api/sqlite#serialize) [`.query()`](https://bun.com/docs/api/sqlite#query) [WAL mode](https://bun.com/docs/api/sqlite#wal-mode) [Statements](https://bun.com/docs/api/sqlite#statements) [Binding values](https://bun.com/docs/api/sqlite#binding-values) [`.all()`](https://bun.com/docs/api/sqlite#all) [`.get()`](https://bun.com/docs/api/sqlite#get) [`.run()`](https://bun.com/docs/api/sqlite#run) [`.as(Class)` \- Map query results to a class](https://bun.com/docs/api/sqlite#as-class-map-query-results-to-a-class) [`.iterate()` ( `@@iterator`)](https://bun.com/docs/api/sqlite#iterate-iterator) [`.values()`](https://bun.com/docs/api/sqlite#values) [`.finalize()`](https://bun.com/docs/api/sqlite#finalize) [`.toString()`](https://bun.com/docs/api/sqlite#tostring) [Parameters](https://bun.com/docs/api/sqlite#parameters) [Integers](https://bun.com/docs/api/sqlite#integers) [`safeIntegers: true`](https://bun.com/docs/api/sqlite#safeintegers-true) [`safeIntegers: false` (default)](https://bun.com/docs/api/sqlite#safeintegers-false-default) [Transactions](https://bun.com/docs/api/sqlite#transactions) [`.loadExtension()`](https://bun.com/docs/api/sqlite#loadextension) [.fileControl(cmd: number, value: any)](https://bun.com/docs/api/sqlite#filecontrol-cmd-number-value-any) [Reference](https://bun.com/docs/api/sqlite#reference) [Datatypes](https://bun.com/docs/api/sqlite#datatypes)

[FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Bun natively implements a high-performance [SQLite3](https://www.sqlite.org/) driver. To use it import from the built-in `bun:sqlite` module.

```
import { Database } from "bun:sqlite";

const db = new Database(":memory:");
const query = db.query("select 'Hello world' as message;");
query.get(); // => { message: "Hello world" }

```

The API is simple, synchronous, and fast. Credit to [better-sqlite3](https://github.com/JoshuaWise/better-sqlite3) and its contributors for inspiring the API of `bun:sqlite`.

Features include:

- Transactions
- Parameters (named & positional)
- Prepared statements
- Datatype conversions ( `BLOB` becomes `Uint8Array`)
- Map query results to classes without an ORM - `query.as(MyClass)`
- The fastest performance of any SQLite driver for JavaScript
- `bigint` support
- Multi-query statements (e.g. `SELECT 1; SELECT 2;`) in a single call to database.run(query)

The `bun:sqlite` module is roughly 3-6x faster than `better-sqlite3` and 8-9x faster than `deno.land/x/sqlite` for read queries. Each driver was benchmarked against the [Northwind Traders](https://github.com/jpwhite3/northwind-SQLite3/blob/46d5f8a64f396f87cd374d1600dbf521523980e8/Northwind_large.sqlite.zip) dataset. View and run the [benchmark source](https://github.com/oven-sh/bun/tree/main/bench/sqlite).

[![SQLite benchmarks for Bun, better-sqlite3, and deno.land/x/sqlite](https://user-images.githubusercontent.com/709451/168459263-8cd51ca3-a924-41e9-908d-cf3478a3b7f3.png)](https://user-images.githubusercontent.com/709451/168459263-8cd51ca3-a924-41e9-908d-cf3478a3b7f3.png) Benchmarked on an M1 MacBook Pro (64GB) running macOS 12.3.1

## [Database](https://bun.com/docs/api/sqlite#database)

To open or create a SQLite3 database:

```
import { Database } from "bun:sqlite";

const db = new Database("mydb.sqlite");

```

To open an in-memory database:

```
import { Database } from "bun:sqlite";

// all of these do the same thing
const db = new Database(":memory:");
const db = new Database();
const db = new Database("");

```

To open in `readonly` mode:

```
import { Database } from "bun:sqlite";
const db = new Database("mydb.sqlite", { readonly: true });

```

To create the database if the file doesn't exist:

```
import { Database } from "bun:sqlite";
const db = new Database("mydb.sqlite", { create: true });

```

### [Strict mode](https://bun.com/docs/api/sqlite#strict-mode)

Added in Bun v1.1.14

By default, `bun:sqlite` requires binding parameters to include the `$`, `:`, or `@` prefix, and does not throw an error if a parameter is missing.

To instead throw an error when a parameter is missing and allow binding without a prefix, set `strict: true` on the `Database` constructor:

```
import { Database } from "bun:sqlite";

const strict = new Database(
  ":memory:",
  { strict: true }
);

// throws error because of the typo:
const query = strict
  .query("SELECT $message;")
  .all({ message: "Hello world" });

const notStrict = new Database(
  ":memory:"
);
// does not throw error:
notStrict
  .query("SELECT $message;")
  .all({ message: "Hello world" });

```

### [Load via ES module import](https://bun.com/docs/api/sqlite#load-via-es-module-import)

You can also use an import attribute to load a database.

```
import db from "./mydb.sqlite" with { "type": "sqlite" };

console.log(db.query("select * from users LIMIT 1").get());

```

This is equivalent to the following:

```
import { Database } from "bun:sqlite";
const db = new Database("./mydb.sqlite");

```

### [`.close(throwOnError: boolean = false)`](https://bun.com/docs/api/sqlite#close-throwonerror-boolean-false)

To close a database connection, but allow existing queries to finish, call `.close(false)`:

```
const db = new Database();
// ... do stuff
db.close(false);

```

To close the database and throw an error if there are any pending queries, call `.close(true)`:

```
const db = new Database();
// ... do stuff
db.close(true);

```

Note: `close(false)` is called automatically when the database is garbage collected. It is safe to call multiple times but has no effect after the first.

### [`using` statement](https://bun.com/docs/api/sqlite#using-statement)

You can use the `using` statement to ensure that a database connection is closed when the `using` block is exited.

```
import { Database } from "bun:sqlite";

{
  using db = new Database("mydb.sqlite");
  using query = db.query("select 'Hello world' as message;");
  console.log(query.get()); // => { message: "Hello world" }
}

```

### [`.serialize()`](https://bun.com/docs/api/sqlite#serialize)

`bun:sqlite` supports SQLite's built-in mechanism for [serializing](https://www.sqlite.org/c3ref/serialize.html) and [deserializing](https://www.sqlite.org/c3ref/deserialize.html) databases to and from memory.

```
const olddb = new Database("mydb.sqlite");
const contents = olddb.serialize(); // => Uint8Array
const newdb = Database.deserialize(contents);

```

Internally, `.serialize()` calls [`sqlite3_serialize`](https://www.sqlite.org/c3ref/serialize.html).

### [`.query()`](https://bun.com/docs/api/sqlite#query)

Use the `db.query()` method on your `Database` instance to [prepare](https://www.sqlite.org/c3ref/prepare.html) a SQL query. The result is a `Statement` instance that will be cached on the `Database` instance. _The query will not be executed._

```
const query = db.query(`select "Hello world" as message`);

```

**Note** — Use the `.prepare()` method to prepare a query _without_ caching it on the `Database` instance.

```
// compile the prepared statement
const query = db.prepare("SELECT * FROM foo WHERE bar = ?");

```

## [WAL mode](https://bun.com/docs/api/sqlite#wal-mode)

SQLite supports [write-ahead log mode](https://www.sqlite.org/wal.html) (WAL) which dramatically improves performance, especially in situations with many concurrent readers and a single writer. It's broadly recommended to enable WAL mode for most typical applications.

To enable WAL mode, run this pragma query at the beginning of your application:

```
db.exec("PRAGMA journal_mode = WAL;");

```

What is WAL mode

In WAL mode, writes to the database are written directly to a separate file called the "WAL file" (write-ahead log). This file will be later integrated into the main database file. Think of it as a buffer for pending writes. Refer to the [SQLite docs](https://www.sqlite.org/wal.html) for a more detailed overview.

On macOS, WAL files may be persistent by default. This is not a bug, it is how macOS configured the system version of SQLite.

## [Statements](https://bun.com/docs/api/sqlite#statements)

A `Statement` is a _prepared query_, which means it's been parsed and compiled into an efficient binary form. It can be executed multiple times in a performant way.

Create a statement with the `.query` method on your `Database` instance.

```
const query = db.query(`select "Hello world" as message`);

```

Queries can contain parameters. These can be numerical ( `?1`) or named ( `$param` or `:param` or `@param`).

```
const query = db.query(`SELECT ?1, ?2;`);
const query = db.query(`SELECT $param1, $param2;`);

```

Values are bound to these parameters when the query is executed. A `Statement` can be executed with several different methods, each returning the results in a different form.

### [Binding values](https://bun.com/docs/api/sqlite#binding-values)

To bind values to a statement, pass an object to the `.all()`, `.get()`, `.run()`, or `.values()` method.

```
const query = db.query(`select $message;`);
query.all({ $message: "Hello world" });

```

You can bind using positional parameters too:

```
const query = db.query(`select ?1;`);
query.all("Hello world");

```

#### `strict: true` lets you bind values without prefixes

Added in Bun v1.1.14

By default, the `$`, `:`, and `@` prefixes are **included** when binding values to named parameters. To bind without these prefixes, use the `strict` option in the `Database` constructor.

```
import { Database } from "bun:sqlite";

const db = new Database(":memory:", {
  // bind values without prefixes
  strict: true,
});

const query = db.query(`select $message;`);

// strict: true
query.all({ message: "Hello world" });

// strict: false
// query.all({ $message: "Hello world" });

```

### [`.all()`](https://bun.com/docs/api/sqlite#all)

Use `.all()` to run a query and get back the results as an array of objects.

```
const query = db.query(`select $message;`);
query.all({ $message: "Hello world" });
// => [{ message: "Hello world" }]

```

Internally, this calls [`sqlite3_reset`](https://www.sqlite.org/capi3ref.html#sqlite3_reset) and repeatedly calls [`sqlite3_step`](https://www.sqlite.org/capi3ref.html#sqlite3_step) until it returns `SQLITE_DONE`.

### [`.get()`](https://bun.com/docs/api/sqlite#get)

Use `.get()` to run a query and get back the first result as an object.

```
const query = db.query(`select $message;`);
query.get({ $message: "Hello world" });
// => { $message: "Hello world" }

```

Internally, this calls [`sqlite3_reset`](https://www.sqlite.org/capi3ref.html#sqlite3_reset) followed by [`sqlite3_step`](https://www.sqlite.org/capi3ref.html#sqlite3_step) until it no longer returns `SQLITE_ROW`. If the query returns no rows, `undefined` is returned.

### [`.run()`](https://bun.com/docs/api/sqlite#run)

Use `.run()` to run a query and get back `undefined`. This is useful for schema-modifying queries (e.g. `CREATE TABLE`) or bulk write operations.

```
const query = db.query(`create table foo;`);
query.run();
// {
//   lastInsertRowid: 0,
//   changes: 0,
// }

```

Internally, this calls [`sqlite3_reset`](https://www.sqlite.org/capi3ref.html#sqlite3_reset) and calls [`sqlite3_step`](https://www.sqlite.org/capi3ref.html#sqlite3_step) once. Stepping through all the rows is not necessary when you don't care about the results.

Since Bun v1.1.14, `.run()` returns an object with two properties: `lastInsertRowid` and `changes`.

The `lastInsertRowid` property returns the ID of the last row inserted into the database. The `changes` property is the number of rows affected by the query.

### [`.as(Class)` \- Map query results to a class](https://bun.com/docs/api/sqlite#as-class-map-query-results-to-a-class)

Added in Bun v1.1.14

Use `.as(Class)` to run a query and get back the results as instances of a class. This lets you attach methods & getters/setters to results.

```
class Movie {
  title: string;
  year: number;

  get isMarvel() {
    return this.title.includes("Marvel");
  }
}

const query = db.query("SELECT title, year FROM movies").as(Movie);
const movies = query.all();
const first = query.get();
console.log(movies[0].isMarvel); // => true
console.log(first.isMarvel); // => true

```

As a performance optimization, the class constructor is not called, default initializers are not run, and private fields are not accessible. This is more like using `Object.create` than `new`. The class's prototype is assigned to the object, methods are attached, and getters/setters are set up, but the constructor is not called.

The database columns are set as properties on the class instance.

### [`.iterate()` ( `@@iterator`)](https://bun.com/docs/api/sqlite#iterate-iterator)

Use `.iterate()` to run a query and incrementally return results. This is useful for large result sets that you want to process one row at a time without loading all the results into memory.

```
const query = db.query("SELECT * FROM foo");
for (const row of query.iterate()) {
  console.log(row);
}

```

You can also use the `@@iterator` protocol:

```
const query = db.query("SELECT * FROM foo");
for (const row of query) {
  console.log(row);
}

```

This feature was added in Bun v1.1.31.

### [`.values()`](https://bun.com/docs/api/sqlite#values)

Use `values()` to run a query and get back all results as an array of arrays.

```
const query = db.query(`select $message;`);
query.values({ $message: "Hello world" });

query.values(2);
// [\
//   [ "Iron Man", 2008 ],\
//   [ "The Avengers", 2012 ],\
//   [ "Ant-Man: Quantumania", 2023 ],\
// ]

```

Internally, this calls [`sqlite3_reset`](https://www.sqlite.org/capi3ref.html#sqlite3_reset) and repeatedly calls [`sqlite3_step`](https://www.sqlite.org/capi3ref.html#sqlite3_step) until it returns `SQLITE_DONE`.

### [`.finalize()`](https://bun.com/docs/api/sqlite#finalize)

Use `.finalize()` to destroy a `Statement` and free any resources associated with it. Once finalized, a `Statement` cannot be executed again. Typically, the garbage collector will do this for you, but explicit finalization may be useful in performance-sensitive applications.

```
const query = db.query("SELECT title, year FROM movies");
const movies = query.all();
query.finalize();

```

### [`.toString()`](https://bun.com/docs/api/sqlite#tostring)

Calling `toString()` on a `Statement` instance prints the expanded SQL query. This is useful for debugging.

```
import { Database } from "bun:sqlite";

// setup
const query = db.query("SELECT $param;");

console.log(query.toString()); // => "SELECT NULL"

query.run(42);
console.log(query.toString()); // => "SELECT 42"

query.run(365);
console.log(query.toString()); // => "SELECT 365"

```

Internally, this calls [`sqlite3_expanded_sql`](https://www.sqlite.org/capi3ref.html#sqlite3_expanded_sql). The parameters are expanded using the most recently bound values.

## [Parameters](https://bun.com/docs/api/sqlite#parameters)

Queries can contain parameters. These can be numerical ( `?1`) or named ( `$param` or `:param` or `@param`). Bind values to these parameters when executing the query:

Query

Results

Query

```
const query = db.query("SELECT * FROM foo WHERE bar = $bar");
const results = query.all({
  $bar: "bar",
});

```

Results

```
[\
  { "$bar": "bar" }\
]

```

Numbered (positional) parameters work too:

Query

Results

Query

```
const query = db.query("SELECT ?1, ?2");
const results = query.all("hello", "goodbye");

```

Results

```
[\
  {\
    "?1": "hello",\
    "?2": "goodbye"\
  }\
]

```

## [Integers](https://bun.com/docs/api/sqlite#integers)

sqlite supports signed 64 bit integers, but JavaScript only supports signed 52 bit integers or arbitrary precision integers with `bigint`.

`bigint` input is supported everywhere, but by default `bun:sqlite` returns integers as `number` types. If you need to handle integers larger than 2^53, set `safeIntegers` option to `true` when creating a `Database` instance. This also validates that `bigint` passed to `bun:sqlite` do not exceed 64 bits.

By default, `bun:sqlite` returns integers as `number` types. If you need to handle integers larger than 2^53, you can use the `bigint` type.

### [`safeIntegers: true`](https://bun.com/docs/api/sqlite#safeintegers-true)

Added in Bun v1.1.14

When `safeIntegers` is `true`, `bun:sqlite` will return integers as `bigint` types:

```
import { Database } from "bun:sqlite";

const db = new Database(":memory:", { safeIntegers: true });
const query = db.query(
  `SELECT ${BigInt(Number.MAX_SAFE_INTEGER) + 102n} as max_int`,
);
const result = query.get();
console.log(result.max_int); // => 9007199254741093n

```

When `safeIntegers` is `true`, `bun:sqlite` will throw an error if a `bigint` value in a bound parameter exceeds 64 bits:

```
import { Database } from "bun:sqlite";

const db = new Database(":memory:", { safeIntegers: true });
db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, value INTEGER)");

const query = db.query("INSERT INTO test (value) VALUES ($value)");

try {
  query.run({ $value: BigInt(Number.MAX_SAFE_INTEGER) ** 2n });
} catch (e) {
  console.log(e.message); // => BigInt value '81129638414606663681390495662081' is out of range
}

```

### [`safeIntegers: false` (default)](https://bun.com/docs/api/sqlite#safeintegers-false-default)

When `safeIntegers` is `false`, `bun:sqlite` will return integers as `number` types and truncate any bits beyond 53:

```
import { Database } from "bun:sqlite";

const db = new Database(":memory:", { safeIntegers: false });
const query = db.query(
  `SELECT ${BigInt(Number.MAX_SAFE_INTEGER) + 102n} as max_int`,
);
const result = query.get();
console.log(result.max_int); // => 9007199254741092

```

## [Transactions](https://bun.com/docs/api/sqlite#transactions)

Transactions are a mechanism for executing multiple queries in an _atomic_ way; that is, either all of the queries succeed or none of them do. Create a transaction with the `db.transaction()` method:

```
const insertCat = db.prepare("INSERT INTO cats (name) VALUES ($name)");
const insertCats = db.transaction(cats => {
  for (const cat of cats) insertCat.run(cat);
});

```

At this stage, we haven't inserted any cats! The call to `db.transaction()` returns a new function ( `insertCats`) that _wraps_ the function that executes the queries.

To execute the transaction, call this function. All arguments will be passed through to the wrapped function; the return value of the wrapped function will be returned by the transaction function. The wrapped function also has access to the `this` context as defined where the transaction is executed.

```
const insert = db.prepare("INSERT INTO cats (name) VALUES ($name)");
const insertCats = db.transaction(cats => {
  for (const cat of cats) insert.run(cat);
  return cats.length;
});

const count = insertCats([\
  { $name: "Keanu" },\
  { $name: "Salem" },\
  { $name: "Crookshanks" },\
]);

console.log(`Inserted ${count} cats`);

```

The driver will automatically [`begin`](https://www.sqlite.org/lang_transaction.html) a transaction when `insertCats` is called and `commit` it when the wrapped function returns. If an exception is thrown, the transaction will be rolled back. The exception will propagate as usual; it is not caught.

**Nested transactions** — Transaction functions can be called from inside other transaction functions. When doing so, the inner transaction becomes a [savepoint](https://www.sqlite.org/lang_savepoint.html).

View nested transaction example

```
// setup
import { Database } from "bun:sqlite";
const db = Database.open(":memory:");
db.run(
  "CREATE TABLE expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT, dollars INTEGER);",
);
db.run(
  "CREATE TABLE cats (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, age INTEGER)",
);
const insertExpense = db.prepare(
  "INSERT INTO expenses (note, dollars) VALUES (?, ?)",
);
const insert = db.prepare("INSERT INTO cats (name, age) VALUES ($name, $age)");
const insertCats = db.transaction(cats => {
  for (const cat of cats) insert.run(cat);
});

const adopt = db.transaction(cats => {
  insertExpense.run("adoption fees", 20);
  insertCats(cats); // nested transaction
});

adopt([\
  { $name: "Joey", $age: 2 },\
  { $name: "Sally", $age: 4 },\
  { $name: "Junior", $age: 1 },\
]);

```

Transactions also come with `deferred`, `immediate`, and `exclusive` versions.

```
insertCats(cats); // uses "BEGIN"
insertCats.deferred(cats); // uses "BEGIN DEFERRED"
insertCats.immediate(cats); // uses "BEGIN IMMEDIATE"
insertCats.exclusive(cats); // uses "BEGIN EXCLUSIVE"

```

### [`.loadExtension()`](https://bun.com/docs/api/sqlite#loadextension)

To load a [SQLite extension](https://www.sqlite.org/loadext.html), call `.loadExtension(name)` on your `Database` instance

```
import { Database } from "bun:sqlite";

const db = new Database();
db.loadExtension("myext");

```

For macOS users

**MacOS users** By default, macOS ships with Apple's proprietary build of SQLite, which doesn't support extensions. To use extensions, you'll need to install a vanilla build of SQLite.

```
brew install sqlite
```

```
which sqlite # get path to binary
```

To point `bun:sqlite` to the new build, call `Database.setCustomSQLite(path)` before creating any `Database` instances. (On other operating systems, this is a no-op.) Pass a path to the SQLite `.dylib` file, _not_ the executable. With recent versions of Homebrew this is something like `/opt/homebrew/Cellar/sqlite/<version>/libsqlite3.dylib`.

```
import { Database } from "bun:sqlite";

Database.setCustomSQLite("/path/to/libsqlite.dylib");

const db = new Database();
db.loadExtension("myext");

```

### [.fileControl(cmd: number, value: any)](https://bun.com/docs/api/sqlite#filecontrol-cmd-number-value-any)

To use the advanced `sqlite3_file_control` API, call `.fileControl(cmd, value)` on your `Database` instance.

```
import { Database, constants } from "bun:sqlite";

const db = new Database();
// Ensure WAL mode is NOT persistent
// this prevents wal files from lingering after the database is closed
db.fileControl(constants.SQLITE_FCNTL_PERSIST_WAL, 0);

```

`value` can be:

- `number`
- `TypedArray`
- `undefined` or `null`

## [Reference](https://bun.com/docs/api/sqlite#reference)

```
class Database {
  constructor(
    filename: string,
    options?:
      | number
      | {
          readonly?: boolean;
          create?: boolean;
          readwrite?: boolean;
        },
  );

  query<Params, ReturnType>(sql: string): Statement<Params, ReturnType>;
  run(
    sql: string,
    params?: SQLQueryBindings,
  ): { lastInsertRowid: number; changes: number };
  exec = this.run;
}

class Statement<Params, ReturnType> {
  all(params: Params): ReturnType[];
  get(params: Params): ReturnType | undefined;
  run(params: Params): {
    lastInsertRowid: number;
    changes: number;
  };
  values(params: Params): unknown[][];

  finalize(): void; // destroy statement and clean up resources
  toString(): string; // serialize to SQL

  columnNames: string[]; // the column names of the result set
  paramsCount: number; // the number of parameters expected by the statement
  native: any; // the native object representing the statement

  as(Class: new () => ReturnType): this;
}

type SQLQueryBindings =
  | string
  | bigint
  | TypedArray
  | number
  | boolean
  | null
  | Record<string, string | bigint | TypedArray | number | boolean | null>;

```

### [Datatypes](https://bun.com/docs/api/sqlite#datatypes)

| JavaScript type | SQLite type            |
| --------------- | ---------------------- |
| `string`        | `TEXT`                 |
| `number`        | `INTEGER` or `DECIMAL` |
| `boolean`       | `INTEGER` (1 or 0)     |
| `Uint8Array`    | `BLOB`                 |
| `Buffer`        | `BLOB`                 |
| `bigint`        | `INTEGER`              |
| `null`          | `NULL`                 |

[Previous\\
\\
import.meta](https://bun.com/docs/api/import-meta) [Next\\
\\
FileSystemRouter](https://bun.com/docs/api/file-system-router)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/api/sqlite.md)

Powered by

[![inkeep search icon](https://uploads-ssl.webflow.com/63fd919a913cf54ca2d02cda/642ea6563549ced1bb379fea_inkeep-icon-medium-gray.svg)inkeep](https://www.inkeep.com/)

![ai chat avatar](https://bun.com/logo_avatar.svg)

Hi!

I'm an AI assistant trained on documentation, GitHub issues, and other content.

Ask me anything about `Bun`.

### Popular Questions

Can I use Bun with my existing Node.js project?

How is Bun faster than Node.js? How can I benchmark it?

Do I still need a bundler or TypeScript compiler?

---

Powered by

[![inkeep search icon](https://uploads-ssl.webflow.com/63fd919a913cf54ca2d02cda/642ea6563549ced1bb379fea_inkeep-icon-medium-gray.svg)inkeep](https://www.inkeep.com/)

Get help

[Discord](https://bun.com/discord)

[Migration help for organizations](https://t.co/0CA0Neqgts)
