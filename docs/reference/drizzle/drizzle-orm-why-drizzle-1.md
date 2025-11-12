---
title: Drizzle ORM - Why Drizzle?
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

# Drizzle ORM

Drizzle ORM is a headless TypeScript ORM with a head. 🐲

> Drizzle is a good friend who’s there for you when necessary and doesn’t bother when you need some space.

It looks and feels simple, performs on day _1000_ of your project,

lets you do things your way, and is there when you need it.

**It’s the only ORM with both [relational](https://orm.drizzle.team/docs/rqb) and [SQL-like](https://orm.drizzle.team/docs/select) query APIs**,
providing you the best of both worlds when it comes to accessing your relational data.
Drizzle is lightweight, performant, typesafe, non-lactose, gluten-free, sober, flexible and **serverless-ready by design**.
Drizzle is not just a library, it’s an experience. 🤩

[![Drizzle bestofjs](https://orm.drizzle.team/_astro/bestofjs.Dmfq7AUp_26yiDJ.webp)](https://bestofjs.org/projects/drizzle-orm)

## Headless ORM?

First and foremost, Drizzle is a library and a collection of complementary opt-in tools.

**ORM** stands for _object relational mapping_, and developers tend to call Django-like or Spring-like tools an ORM.
We truly believe it’s a misconception based on legacy nomenclature, and we call them **data frameworks**.

WARNING

With data frameworks you have to build projects **around them** and not **with them**.

**Drizzle** lets you build your project the way you want, without interfering with your project or structure.

Using Drizzle you can define and manage database schemas in TypeScript, access your data in a SQL-like
or relational way, and take advantage of opt-in tools
to push your developer experience _through the roof_. 🤯

## Why SQL-like?

**If you know SQL, you know Drizzle.**

Other ORMs and data frameworks tend to deviate/abstract you away from SQL, which
leads to a double learning curve: needing to know both SQL and the framework’s API.

Drizzle is the opposite.
We embrace SQL and built Drizzle to be SQL-like at its core, so you can have zero to no
learning curve and access to the full power of SQL.

We bring all the familiar **[SQL schema](https://orm.drizzle.team/docs/sql-schema-declaration)**, **[queries](https://orm.drizzle.team/docs/select)**,
**[automatic migrations](https://orm.drizzle.team/docs/migrations)** and **[one more thing](https://orm.drizzle.team/docs/rqb)**. ✨

index.ts

schema.ts

migration.sql

```
// Access your data
await db
	.select()
	.from(countries)
	.leftJoin(cities, eq(cities.countryId, countries.id))
	.where(eq(countries.id, 10))
```

```
// manage your schema
export const countries = pgTable('countries', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 256 }),
});

export const cities = pgTable('cities', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 256 }),
  countryId: integer('country_id').references(() => countries.id),
});
```

```
-- generate migrations
CREATE TABLE IF NOT EXISTS "countries" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256)
);

CREATE TABLE IF NOT EXISTS "cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256),
	"country_id" integer
);

ALTER TABLE "cities" ADD CONSTRAINT "cities_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE no action ON UPDATE no action;
```

## Why not SQL-like?

We’re always striving for a perfectly balanced solution, and while SQL-like does cover 100% of the needs,
there are certain common scenarios where you can query data in a better way.

We’ve built the **[Queries API](https://orm.drizzle.team/docs/rqb)** for you, so you can fetch relational nested data from the database
in the most convenient and performant way, and never think about joins and data mapping.

**Drizzle always outputs exactly 1 SQL query.** Feel free to use it with serverless databases and never worry about performance or roundtrip costs!

```
const result = await db.query.users.findMany({
	with: {
		posts: true
	},
});
```

## Serverless?

The best part is no part. **Drizzle has exactly 0 dependencies!**

![Drizzle is slim an Serverless ready](https://orm.drizzle.team/_astro/drizzle31kb.6Mn-oJyX_ZHNm12.webp)

Drizzle ORM is dialect-specific, slim, performant and serverless-ready **by design**.

We’ve spent a lot of time to make sure you have best-in-class SQL dialect support, including Postgres, MySQL, and others.

Drizzle operates natively through industry-standard database drivers. We support all major **[PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)**, **[MySQL](https://orm.drizzle.team/docs/get-started-mysql)**, **[SQLite](https://orm.drizzle.team/docs/get-started-sqlite)** or **[SingleStore](https://orm.drizzle.team/docs/get-started-singlestore)** drivers out there, and we’re adding new ones **[really fast](https://twitter.com/DrizzleORM/status/1653082492742647811?s=20)**.

## Welcome on board!

More and more companies are adopting Drizzle in production, experiencing immense benefits in both DX and performance.

**We’re always there to help, so don’t hesitate to reach out. We’ll gladly assist you in your Drizzle journey!**

We have an outstanding **[Discord community](https://driz.link/discord)** and welcome all builders to our **[Twitter](https://twitter.com/drizzleorm)**.

Now go build something awesome with Drizzle and your **[PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)**, **[MySQL](https://orm.drizzle.team/docs/get-started-mysql)** or **[SQLite](https://orm.drizzle.team/docs/get-started-sqlite)** database. 🚀

### Video Showcase

[1:37:39\\
\\
![Full Drizzle Course for Beginners](https://orm.drizzle.team/_astro/maxresdefault_Z1IGMuI.webp)\\
\\
Full Drizzle Course for Beginners \\
\\
Code Genix](https://driz.link/yt/vyU5mJGCJMw)

[56:09\\
\\
![Learn Drizzle In 60 Minutes](https://orm.drizzle.team/_astro/maxresdefault_1GXieN.webp)\\
\\
Learn Drizzle In 60 Minutes \\
\\
Web Dev Simplified](https://driz.link/yt/7-NZ0MlPpJA)

[2:55\\
\\
![Drizzle ORM in 100 Seconds](https://orm.drizzle.team/_astro/maxresdefault_ZFrTTy.webp)\\
\\
Drizzle ORM in 100 Seconds \\
\\
Fireship](https://driz.link/yt/i_mAHOhpBSA)

[14:00\\
\\
![Learn Drizzle ORM in 13 mins (crash course)](https://orm.drizzle.team/_astro/maxresdefault_SQnp8.webp)\\
\\
Learn Drizzle ORM in 13 mins (crash course) \\
\\
Neon](https://driz.link/yt/hIYNOiZXQ7Y)

[38:08\\
\\
![Easiest Database Setup in Next.js&nbsp;14 with Turso&nbsp;&&nbsp;Drizzle](https://orm.drizzle.team/_astro/maxresdefault_Z1cL6Bx.webp)\\
\\
Easiest Database Setup in Next.js 14 with Turso & Drizzle \\
\\
Sam Meech-Ward](https://driz.link/yt/4ZhtoOFKFP8)

[5:46:28\\
\\
![Next.js Project with Vercel, Neon, Drizzle, TailwindCSS, FlowBite and more!](https://orm.drizzle.team/_astro/maxresdefault_25Ibv9.webp)\\
\\
Next.js Project with Vercel, Neon, Drizzle, TailwindCSS, FlowBite and more! \\
\\
CodingEntrepreneurs](https://driz.link/yt/NfVELsEZFsA)

[5:46\\
\\
![I Have A New Favorite Database&nbsp;Tool](https://orm.drizzle.team/_astro/maxresdefault_ZyLbD7.webp)\\
\\
I Have A New Favorite Database Tool \\
\\
Theo - t3.gg](https://driz.link/yt/_SLxGYzv6jo)

[33:52\\
\\
![Drizzle ORM First impressions - migrations, relations, queries!](https://orm.drizzle.team/_astro/maxresdefault_2h99IO.webp)\\
\\
Drizzle ORM First impressions - migrations, relations, queries! \\
\\
Marius Espejo](https://driz.link/yt/Qo-RXkSwOtc)

[9:00\\
\\
![I want to learn Drizzle ORM, so I'm starting another next14 project](https://orm.drizzle.team/_astro/maxresdefault_2wtQlW.webp)\\
\\
I want to learn Drizzle ORM, so I'm starting another next14 project \\
\\
Web Dev Cody](https://driz.link/yt/yXNEqyvA0OY)

[5:18\\
\\
![Picking an ORM is Getting Harder...](https://orm.drizzle.team/_astro/maxresdefault_ZYqVlx.webp)\\
\\
Picking an ORM is Getting Harder... \\
\\
Ben Davis](https://driz.link/yt/h7vVhR-dFYo)

[8:49\\
\\
![This New Database Tool is a Game-Changer](https://orm.drizzle.team/_astro/maxresdefault_Z1illgo.webp)\\
\\
This New Database Tool is a Game-Changer \\
\\
Josh tried coding](https://driz.link/yt/8met6WTk0mQ)

[4:23\\
\\
![My Favorite Database Tool Just Got EVEN Better](https://orm.drizzle.team/_astro/maxresdefault_Z18YAVx.webp)\\
\\
My Favorite Database Tool Just Got EVEN Better \\
\\
Josh tried coding](https://driz.link/yt/woWW1T9DXEY)

[11:41:46\\
\\
![SaaS Notion Clone with Realtime cursors, Nextjs 13, Stripe, Drizzle ORM, Tailwind, Supabase, Sockets](https://orm.drizzle.team/_astro/maxresdefault_12aVqp.webp)\\
\\
SaaS Notion Clone with Realtime cursors, Nextjs 13, Stripe, Drizzle ORM, Tailwind, Supabase, Sockets \\
\\
Web Prodigies](https://driz.link/yt/A3l6YYkXzzg)

[12:18\\
\\
![SvelteKit + Drizzle Code Breakdown](https://orm.drizzle.team/_astro/maxresdefault_kaMY9.webp)\\
\\
SvelteKit + Drizzle Code Breakdown \\
\\
Ben Davis](https://driz.link/yt/EQfaw5bDE1s)

[2:01:29\\
\\
![Build a Multi-Tenanted, Role-Based Access Control System](https://orm.drizzle.team/_astro/maxresdefault_22Dfgw.webp)\\
\\
Build a Multi-Tenanted, Role-Based Access Control System \\
\\
TomDoesTech](https://driz.link/yt/b6VhN_HHDiQ)

[5:42\\
\\
![The Prisma killer is finally here](https://orm.drizzle.team/_astro/maxresdefault_Z2gqOga.webp)\\
\\
The Prisma killer is finally here \\
\\
SST](https://driz.link/yt/3tl9XCiQErA)

[1:07:41\\
\\
![Learning Drizzle ORM and working on a next14 project](https://orm.drizzle.team/_astro/maxresdefault_ZLt6MN.webp)\\
\\
Learning Drizzle ORM and working on a next14 project \\
\\
Web Dev Cody](https://driz.link/yt/VQFjyEa8vGE)

[6:01\\
\\
![This Trick Makes My Favorite Database Tool Even Better](https://orm.drizzle.team/_astro/maxresdefault_7LgX1.webp)\\
\\
This Trick Makes My Favorite Database Tool Even Better \\
\\
Josh tried coding](https://driz.link/yt/5G0upg4sxgE)

[26:29\\
\\
![Effortless Auth in Next.js 14: Use Auth.js & Drizzle ORM for Secure Login](https://orm.drizzle.team/_astro/maxresdefault_ZkfOq8.webp)\\
\\
Effortless Auth in Next.js 14: Use Auth.js & Drizzle ORM for Secure Login \\
\\
Sam Meech-Ward](https://driz.link/yt/-JnEuvPmt-Q)