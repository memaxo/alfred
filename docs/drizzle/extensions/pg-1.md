---
title: Drizzle ORM - PostgreSQL extensions
url: 
description: Drizzle ORM is a lightweight and performant TypeScript ORM with developer experience in mind.
language: en
---

[Drizzle Studio Gateway is now FREE 👀](https://gateway.drizzle.team/)

[**PostgreSQL**](https://orm.drizzle.team/docs/extensions/pg) [**MySQL**](https://orm.drizzle.team/docs/extensions/mysql) [**SQLite**](https://orm.drizzle.team/docs/extensions/sqlite) [**SingleStore**](https://orm.drizzle.team/docs/extensions/singlestore)

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

# PostgreSQL extensions

### `pg_vector`

There is no specific code to create an extension inside the Drizzle schema. We assume that if you are using vector types,
indexes, and queries, you have a PostgreSQL database with the pg\_vector extension installed.

[`pg_vector`](https://github.com/pgvector/pgvector) is open-source vector similarity search for Postgres

Store your vectors with the rest of your data. Supports:

- exact and approximate nearest neighbor search
- single-precision, half-precision, binary, and sparse vectors
- L2 distance, inner product, cosine distance, L1 distance, Hamming distance, and Jaccard distance

#### Column Types

**`vector`**

Store your vectors with the rest of your data

For more info please refer to the official pg\_vector docs **[docs.](https://github.com/pgvector/pgvector)**

```
const table = pgTable('table', {
    embedding: vector({ dimensions: 3 })
})
```

```
CREATE TABLE IF NOT EXISTS "table" (
	"embedding" vector(3)
);
```

#### Indexes

You can now specify indexes for `pg_vector` and utilize `pg_vector` functions for querying, ordering, etc.

Let’s take a few examples of `pg_vector` indexes from the `pg_vector` docs and translate them to Drizzle

#### L2 distance, Inner product and Cosine distance

```
// CREATE INDEX ON items USING hnsw (embedding vector_l2_ops);
// CREATE INDEX ON items USING hnsw (embedding vector_ip_ops);
// CREATE INDEX ON items USING hnsw (embedding vector_cosine_ops);

const table = pgTable('items', {
    embedding: vector({ dimensions: 3 })
}, (table) => [\
  index('l2_index').using('hnsw', table.embedding.op('vector_l2_ops'))\
  index('ip_index').using('hnsw', table.embedding.op('vector_ip_ops'))\
  index('cosine_index').using('hnsw', table.embedding.op('vector_cosine_ops'))\
])
```

#### L1 distance, Hamming distance and Jaccard distance - added in pg\_vector 0.7.0 version

```
// CREATE INDEX ON items USING hnsw (embedding vector_l1_ops);
// CREATE INDEX ON items USING hnsw (embedding bit_hamming_ops);
// CREATE INDEX ON items USING hnsw (embedding bit_jaccard_ops);

const table = pgTable('table', {
    embedding: vector({ dimensions: 3 })
}, (table) => [\
  index('l1_index').using('hnsw', table.embedding.op('vector_l1_ops'))\
  index('hamming_index').using('hnsw', table.embedding.op('bit_hamming_ops'))\
  index('bit_jaccard_index').using('hnsw', table.embedding.op('bit_jaccard_ops'))\
])
```

#### Helper Functions

For queries, you can use predefined functions for vectors or create custom ones using the SQL template operator.

You can also use the following helpers:

```
import { l2Distance, l1Distance, innerProduct,
          cosineDistance, hammingDistance, jaccardDistance } from 'drizzle-orm'

l2Distance(table.column, [3, 1, 2]) // table.column <-> '[3, 1, 2]'
l1Distance(table.column, [3, 1, 2]) // table.column <+> '[3, 1, 2]'

innerProduct(table.column, [3, 1, 2]) // table.column <#> '[3, 1, 2]'
cosineDistance(table.column, [3, 1, 2]) // table.column <=> '[3, 1, 2]'

hammingDistance(table.column, '101') // table.column <~> '101'
jaccardDistance(table.column, '101') // table.column <%> '101'
```

If `pg_vector` has some other functions to use, you can replicate implementation from existing one we have. Here is how it can be done

```
export function l2Distance(
  column: SQLWrapper | AnyColumn,
  value: number[] | string[] | TypedQueryBuilder<any> | string,
): SQL {
  if (is(value, TypedQueryBuilder<any>) || typeof value === 'string') {
    return sql`${column} <-> ${value}`;
  }
  return sql`${column} <-> ${JSON.stringify(value)}`;
}
```

Name it as you wish and change the operator. This example allows for a numbers array, strings array, string, or even a select query. Feel free to create any other type you want or even contribute and submit a PR

#### Examples

Let’s take a few examples of `pg_vector` queries from the `pg_vector` docs and translate them to Drizzle

```
import { l2Distance } from 'drizzle-orm';

// SELECT * FROM items ORDER BY embedding <-> '[3,1,2]' LIMIT 5;
db.select().from(items).orderBy(l2Distance(items.embedding, [3,1,2]))

// SELECT embedding <-> '[3,1,2]' AS distance FROM items;
db.select({ distance: l2Distance(items.embedding, [3,1,2]) })

// SELECT * FROM items ORDER BY embedding <-> (SELECT embedding FROM items WHERE id = 1) LIMIT 5;
const subquery = db.select({ embedding: items.embedding }).from(items).where(eq(items.id, 1));
db.select().from(items).orderBy(l2Distance(items.embedding, subquery)).limit(5)

// SELECT (embedding <#> '[3,1,2]') * -1 AS inner_product FROM items;
db.select({ innerProduct: sql`(${maxInnerProduct(items.embedding, [3,1,2])}) * -1` }).from(items)

// and more!
```

### `postgis`

There is no specific code to create an extension inside the Drizzle schema. We assume that if you are using postgis types, indexes, and queries, you have a PostgreSQL database with the `postgis` extension installed.

As [PostGIS](https://postgis.net/) website mentions:

> PostGIS extends the capabilities of the PostgreSQL relational database by adding support for storing, indexing, and querying geospatial data.

If you are using the `introspect` or `push` commands with the PostGIS extension and don’t want PostGIS tables to be included, you can use [`extensionsFilters`](https://orm.drizzle.team/docs/drizzle-config-file#extensionsfilters) to ignore all the PostGIS tables

#### Column Types

**`geometry`**

Store your geometry data with the rest of your data

For more info please refer to the official PostGIS docs **[docs.](https://postgis.net/workshops/postgis-intro/geometries.html)**

```
const items = pgTable('items', {
  geo: geometry('geo', { type: 'point' }),
  geoObj: geometry('geo_obj', { type: 'point', mode: 'xy' }),
  geoSrid: geometry('geo_options', { type: 'point', mode: 'xy', srid: 4000 }),
});
```

**mode**

Type `geometry` has 2 modes for mappings from the database: `tuple` and `xy`.

- `tuple` will be accepted for insert and mapped on select to a tuple. So, the database geometry will be typed as \[1,2\] with drizzle.
- `xy` will be accepted for insert and mapped on select to an object with x, y coordinates. So, the database geometry will be typed as `{ x: 1, y: 2 }` with drizzle

**type**

The current release has a predefined type: `point`, which is the `geometry(Point)` type in the PostgreSQL PostGIS extension. You can specify any string there if you want to use some other type

#### Indexes

With the available Drizzle indexes API, you should be able to write any indexes for PostGIS

**Examples**

```
// CREATE INDEX custom_idx ON table USING GIST (geom);

const table = pgTable('table', {
  	geo: geometry({ type: 'point' }),
}, (table) => [\
  index('custom_idx').using('gist', table.geo)\
])
```