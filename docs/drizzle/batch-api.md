---
title: Drizzle ORM - Batch
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

# Batch API

**LibSQL Batch API explanation**:
_[source](https://docs.turso.tech/sdk/ts/reference#batch-transactions)_

> With the libSQL client library, a batch is one or more SQL statements executed in order in an implicit transaction.
> The transaction is controlled by the libSQL backend. If all of the statements are successful,
> the transaction is committed. If any of the statements fail, the entire transaction is rolled back and no changes are made.

**D1 Batch API explanation**:
_[source](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)_

> Batching sends multiple SQL statements inside a single call to the database.
> This can have a huge performance impact as it reduces latency from network round trips to D1.
> D1 operates in auto-commit. Our implementation guarantees that each statement in the list will execute and commit,
> sequentially, non-concurrently.
> Batched statements are SQL transactions. If a statement in the sequence fails,
> then an error is returned for that specific statement, and it aborts or rolls back the entire sequence.

Drizzle ORM provides APIs to run SQL statements in batch for `LibSQL`, `Neon` and `D1`:

```
const batchResponse: BatchResponse = await db.batch([\
	db.insert(usersTable).values({ id: 1, name: 'John' }).returning({ id: usersTable.id }),\
	db.update(usersTable).set({ name: 'Dan' }).where(eq(usersTable.id, 1)),\
	db.query.usersTable.findMany({}),\
	db.select().from(usersTable).where(eq(usersTable.id, 1)),\
	db.select({ id: usersTable.id, invitedBy: usersTable.invitedBy }).from(usersTable),\
]);
```

Type for `batchResponse` in this example would be:

libSQL

Neon

D1

```
type BatchResponse = [\
	{\
		id: number;\
	}[],\
	ResultSet,\
	{\
		id: number;\
		name: string;\
		verified: number;\
		invitedBy: number | null;\
	}[],\
	{\
		id: number;\
		name: string;\
		verified: number;\
		invitedBy: number | null;\
	}[],\
	{\
		id: number;\
		invitedBy: number | null;\
	}[],\
]
```

```
type BatchResponse = [\
	{\
		id: number;\
	}[],\
	NeonHttpQueryResult,\
	{\
		id: number;\
		name: string;\
		verified: number;\
		invitedBy: number | null;\
	}[],\
	{\
		id: number;\
		name: string;\
		verified: number;\
		invitedBy: number | null;\
	}[],\
	{\
		id: number;\
		invitedBy: number | null;\
	}[],\
]
```

```
type BatchResponse = [\
  {\
    id: number;\
  }[],\
  D1Result,\
  {\
    id: number;\
    name: string;\
    verified: number;\
    invitedBy: number | null;\
  }[],\
  {\
    id: number;\
    name: string;\
    verified: number;\
    invitedBy: number | null;\
  }[],\
  {\
    id: number;\
    invitedBy: number | null;\
  }[],\
]
```

All possible builders that can be used inside `db.batch`:

```
db.all(),
db.get(),
db.values(),
db.run(),
db.execute(),
db.query.<table>.findMany(),
db.query.<table>.findFirst(),
db.select()...,
db.update()...,
db.delete()...,
db.insert()...,
```