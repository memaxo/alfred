---
title: Drizzle ORM - `up`
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

# `drizzle-kit up`

This guide assumes familiarity with:

- Get started with Drizzle and `drizzle-kit` \- [read here](https://orm.drizzle.team/docs/get-started)
- Drizzle schema fundamentals - [read here](https://orm.drizzle.team/docs/sql-schema-declaration)
- Database connection basics - [read here](https://orm.drizzle.team/docs/connect-overview)
- Drizzle migrations fundamentals - [read here](https://orm.drizzle.team/docs/migrations)
- Drizzle Kit [overview](https://orm.drizzle.team/docs/kit-overview) and [config file](https://orm.drizzle.team/docs/drizzle-config-file)
- `drizzle-kit generate` command - [read here](https://orm.drizzle.team/docs/drizzle-kit-generate)

`drizzle-kit up` command lets you upgrade drizzle schema snapshots to a newer version.
It’s required whenever we introduce breaking changes to the json snapshots of the schema and upgrade the internal version.

* * *

`drizzle-kit up` command requires you to specify both `dialect` and database connection credentials,
you can provide them either via [drizzle.config.ts](https://orm.drizzle.team/docs/drizzle-config-file) config file or via CLI options

With config file

As CLI options

```
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
});
```

```
npx drizzle-kit up
```

```
npx drizzle-kit up --dialect=postgresql
```

### Multiple configuration files in one project

You can have multiple config files in the project, it’s very useful when you have multiple database stages or multiple databases on the same project:

npm

yarn

pnpm

bun

```
npx drizzle-kit migrate --config=drizzle-dev.config.ts
npx drizzle-kit migrate --config=drizzle-prod.config.ts
```

```
yarn drizzle-kit migrate --config=drizzle-dev.config.ts
yarn drizzle-kit migrate --config=drizzle-prod.config.ts
```

```
pnpm drizzle-kit migrate --config=drizzle-dev.config.ts
pnpm drizzle-kit migrate --config=drizzle-prod.config.ts
```

```
bunx drizzle-kit migrate --config=drizzle-dev.config.ts
bunx drizzle-kit migrate --config=drizzle-prod.config.ts
```

```
📦 <project root>
 ├ 📂 drizzle
 ├ 📂 src
 ├ 📜 .env
 ├ 📜 drizzle-dev.config.ts
 ├ 📜 drizzle-prod.config.ts
 ├ 📜 package.json
 └ 📜 tsconfig.json
```

### Extended list of configurations

We recommend configuring `drizzle-kit` through [drizzle.config.ts](https://orm.drizzle.team/docs/drizzle-config-file) file,
yet you can provide all configuration options through CLI if necessary, e.g. in CI/CD pipelines, etc.

|  |  |  |
| --- | --- | --- |
| `dialect` | `required` | Database dialect you are using. Can be `postgresql`, `mysql` or `sqlite` |
| `out` |  | Migrations folder, default= `./drizzle` |
| `config` |  | Configuration file path, default= `drizzle.config.ts` |

npm

yarn

pnpm

bun

```
npx drizzle-kit up --dialect=postgresql
npx drizzle-kit up --dialect=postgresql --out=./migrations-folder
```

```
yarn drizzle-kit up --dialect=postgresql
yarn drizzle-kit up --dialect=postgresql --out=./migrations-folder
```

```
pnpm drizzle-kit up --dialect=postgresql
pnpm drizzle-kit up --dialect=postgresql --out=./migrations-folder
```

```
bunx drizzle-kit up --dialect=postgresql
bunx drizzle-kit up --dialect=postgresql --out=./migrations-folder
```

![](https://orm.drizzle.team/_astro/up_mysql.FpcTUeNG_Zl2NXa.webp)