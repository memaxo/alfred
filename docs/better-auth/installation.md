---
title: Installation | Better Auth
url: 
description: Learn how to configure Better Auth in your project.
language: en
---
[\_helo](https://www.better-auth.com/) [docs](https://www.better-auth.com/docs) [examples](https://www.better-auth.com/docs/examples/next-js) [changelogs](https://www.better-auth.com/changelogs) [blogs](https://www.better-auth.com/blog) [community](https://www.better-auth.com/community)

### Get Started

### Concepts

### Authentication

### Databases

### Integrations

### Plugins

### Guides

### Reference

# Installation

Copy MarkdownOpen in

### [Install the Package](https://www.better-auth.com/docs/installation\#install-the-package)

Let's start by adding Better Auth to your project:

npm

pnpm

yarn

bun

```
npm install better-auth
```

If you're using a separate client and server setup, make sure to install Better Auth in both parts of your project.

### [Set Environment Variables](https://www.better-auth.com/docs/installation\#set-environment-variables)

Create a `.env` file in the root of your project and add the following environment variables:

1. **Secret Key**

Random value used by the library for encryption and generating hashes. **You can generate one using the button below** or you can use something like openssl.

.env

```
BETTER_AUTH_SECRET=
```

Generate Secret

2. **Set Base URL**

.env

```
BETTER_AUTH_URL=http://localhost:3000 # Base URL of your app
```

### [Create A Better Auth Instance](https://www.better-auth.com/docs/installation\#create-a-better-auth-instance)

Create a file named `auth.ts` in one of these locations:

- Project root
- `lib/` folder
- `utils/` folder

You can also nest any of these folders under `src/`, `app/` or `server/` folder. (e.g. `src/lib/auth.ts`, `app/lib/auth.ts`).

And in this file, import Better Auth and create your auth instance. Make sure to export the auth instance with the variable name `auth` or as a `default` export.

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  //...
});
```

### [Configure Database](https://www.better-auth.com/docs/installation\#configure-database)

Better Auth requires a database to store user data.
You can easily configure Better Auth to use SQLite, PostgreSQL, or MySQL, and more!

sqlitepostgresmysql

auth.ts

```
import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

export const auth = betterAuth({
    database: new Database("./sqlite.db"),
})
```

auth.ts

```
import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
    database: new Pool({
        // connection options
    }),
})
```

auth.ts

```
import { betterAuth } from "better-auth";
import { createPool } from "mysql2/promise";

export const auth = betterAuth({
    database: createPool({
        // connection options
    }),
})
```

Alternatively, if you prefer to use an ORM, you can use one of the built-in adapters.

drizzleprismamongodb

auth.ts

```
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db"; // your drizzle instance

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg", // or "mysql", "sqlite"
    }),
});
```

auth.ts

```
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
// If your Prisma file is located elsewhere, you can change the path
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();
export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "sqlite", // or "mysql", "postgresql", ...etc
    }),
});
```

auth.ts

```
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { client } from "@/db"; // your mongodb client

export const auth = betterAuth({
    database: mongodbAdapter(client),
});
```

If your database is not listed above, check out our other supported
[databases](https://www.better-auth.com/docs/adapters/other-relational-databases) for more information,
or use one of the supported ORMs.

### [Create Database Tables](https://www.better-auth.com/docs/installation\#create-database-tables)

Better Auth includes a CLI tool to help manage the schema required by the library.

- **Generate**: This command generates an ORM schema or SQL migration file.

If you're using Kysely, you can apply the migration directly with `migrate` command below. Use `generate` only if you plan to apply the migration manually.

Terminal

```
npx @better-auth/cli generate
```

- **Migrate**: This command creates the required tables directly in the database. (Available only for the built-in Kysely adapter)

Terminal

```
npx @better-auth/cli migrate
```

see the [CLI documentation](https://www.better-auth.com/docs/concepts/cli) for more information.

If you instead want to create the schema manually, you can find the core schema required in the [database section](https://www.better-auth.com/docs/concepts/database#core-schema).

### [Authentication Methods](https://www.better-auth.com/docs/installation\#authentication-methods)

Configure the authentication methods you want to use. Better Auth comes with built-in support for email/password, and social sign-on providers.

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  //...other options
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
});
```

You can use even more authentication methods like [passkey](https://www.better-auth.com/docs/plugins/passkey), [username](https://www.better-auth.com/docs/plugins/username), [magic link](https://www.better-auth.com/docs/plugins/magic-link) and more through plugins.

### [Mount Handler](https://www.better-auth.com/docs/installation\#mount-handler)

To handle API requests, you need to set up a route handler on your server.

Create a new file or route in your framework's designated catch-all route handler. This route should handle requests for the path `/api/auth/*` (unless you've configured a different base path).

Better Auth supports any backend framework with standard Request and Response
objects and offers helper functions for popular frameworks.

next-jsnuxtsvelte-kitremixsolid-starthonoexpresselysiatanstack-startexpo

/app/api/auth/\[...all\]/route.ts

```
import { auth } from "@/lib/auth"; // path to your auth file
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

/server/api/auth/\[...all\].ts

```
import { auth } from "~/utils/auth"; // path to your auth file

export default defineEventHandler((event) => {
    return auth.handler(toWebRequest(event));
});
```

hooks.server.ts

```
import { auth } from "$lib/auth"; // path to your auth file
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from '$app/environment'

export async function handle({ event, resolve }) {
    return svelteKitHandler({ event, resolve, auth, building });
}
```

/app/routes/api.auth.$.ts

```
import { auth } from '~/lib/auth.server' // Adjust the path as necessary
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node"

export async function loader({ request }: LoaderFunctionArgs) {
    return auth.handler(request)
}

export async function action({ request }: ActionFunctionArgs) {
    return auth.handler(request)
}
```

/routes/api/auth/\*all.ts

```
import { auth } from "~/lib/auth"; // path to your auth file
import { toSolidStartHandler } from "better-auth/solid-start";

export const { GET, POST } = toSolidStartHandler(auth);
```

src/index.ts

```
import { Hono } from "hono";
import { auth } from "./auth"; // path to your auth file
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";

const app = new Hono();

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

serve(app);
```

ExpressJS v5 introduced breaking changes to route path matching by switching to `path-to-regexp@6`. Wildcard routes like `*` should now be written using the new named syntax, e.g. `/{*any}`, to properly capture catch-all patterns. This ensures compatibility and predictable behavior across routing scenarios.
See the [Express v5 migration guide](https://expressjs.com/en/guide/migrating-5.html) for details.

As a result, the implementation in ExpressJS v5 should look like this:

```
app.all('/api/auth/{*any}', toNodeHandler(auth));
```

_The name any is arbitrary and can be replaced with any identifier you prefer._

server.ts

```
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";

const app = express();
const port = 8000;

app.all("/api/auth/*", toNodeHandler(auth));

// Mount express json middleware after Better Auth handler
// or only apply it to routes that don't interact with Better Auth
app.use(express.json());

app.listen(port, () => {
    console.log(`Better Auth app listening on port ${port}`);
});
```

This will also work for any other node server framework like express, fastify, hapi, etc., but may require some modifications. See [fastify guide](https://www.better-auth.com/docs/integrations/fastify). Note that CommonJS (cjs) isn't supported.

/pages/api/auth/\[...all\].ts

```
import type { APIRoute } from "astro";
import { auth } from "@/auth"; // path to your auth file

export const GET: APIRoute = async (ctx) => {
    return auth.handler(ctx.request);
};

export const POST: APIRoute = async (ctx) => {
    return auth.handler(ctx.request);
};
```

```
import { Elysia, Context } from "elysia";
import { auth } from "./auth";

const betterAuthView = (context: Context) => {
    const BETTER_AUTH_ACCEPT_METHODS = ["POST", "GET"]
    // validate request method
    if(BETTER_AUTH_ACCEPT_METHODS.includes(context.request.method)) {
        return auth.handler(context.request);
    } else {
        context.error(405)
    }
}

const app = new Elysia().all("/api/auth/*", betterAuthView).listen(3000);

console.log(
`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
```

src/routes/api/auth/$.ts

```
import { auth } from '~/lib/server/auth'
import { createServerFileRoute } from '@tanstack/react-start/server'

export const ServerRoute = createServerFileRoute('/api/auth/$').methods({
GET: ({ request }) => {
    return auth.handler(request)
},
POST: ({ request }) => {
    return auth.handler(request)
},
});
```

app/api/auth/\[...all\]+api.ts

```
import { auth } from '@/lib/server/auth'; // path to your auth file

const handler = auth.handler;
export { handler as GET, handler as POST };
```

### [Create Client Instance](https://www.better-auth.com/docs/installation\#create-client-instance)

The client-side library helps you interact with the auth server. Better Auth comes with a client for all the popular web frameworks, including vanilla JavaScript.

1. Import `createAuthClient` from the package for your framework (e.g., "better-auth/react" for React).
2. Call the function to create your client.
3. Pass the base URL of your auth server. (If the auth server is running on the same domain as your client, you can skip this step.)

If you're using a different base path other than `/api/auth` make sure to pass
the whole URL including the path. (e.g.
`http://localhost:3000/custom-path/auth`)

reactvuesveltesolidvanilla

lib/auth-client.ts

```
import { createAuthClient } from "better-auth/client"
export const authClient = createAuthClient({
    /** The base URL of the server (optional if you're using the same domain) */
    baseURL: "http://localhost:3000"
})
```

lib/auth-client.ts

```
import { createAuthClient } from "better-auth/react"
export const authClient = createAuthClient({
    /** The base URL of the server (optional if you're using the same domain) */
    baseURL: "http://localhost:3000"
})
```

lib/auth-client.ts

```
import { createAuthClient } from "better-auth/vue"
export const authClient = createAuthClient({
    /** The base URL of the server (optional if you're using the same domain) */
    baseURL: "http://localhost:3000"
})
```

lib/auth-client.ts

```
import { createAuthClient } from "better-auth/svelte"
export const authClient = createAuthClient({
    /** The base URL of the server (optional if you're using the same domain) */
    baseURL: "http://localhost:3000"
})
```

lib/auth-client.ts

```
import { createAuthClient } from "better-auth/solid"
export const authClient = createAuthClient({
    /** The base URL of the server (optional if you're using the same domain) */
    baseURL: "http://localhost:3000"
})
```

Tip: You can also export specific methods if you prefer:

```
export const { signIn, signUp, useSession } = createAuthClient()
```

### [🎉 That's it!](https://www.better-auth.com/docs/installation\#-thats-it)

That's it! You're now ready to use better-auth in your application. Continue to [basic usage](https://www.better-auth.com/docs/basic-usage) to learn how to use the auth instance to sign in users.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/installation.mdx)

[Previous Page\\
\\
Comparison](https://www.better-auth.com/docs/comparison) [Next Page\\
\\
Basic Usage](https://www.better-auth.com/docs/basic-usage)

### On this page

[Install the Package](https://www.better-auth.com/docs/installation#install-the-package) [Set Environment Variables](https://www.better-auth.com/docs/installation#set-environment-variables) [Create A Better Auth Instance](https://www.better-auth.com/docs/installation#create-a-better-auth-instance) [Configure Database](https://www.better-auth.com/docs/installation#configure-database) [Create Database Tables](https://www.better-auth.com/docs/installation#create-database-tables) [Authentication Methods](https://www.better-auth.com/docs/installation#authentication-methods) [Mount Handler](https://www.better-auth.com/docs/installation#mount-handler) [Create Client Instance](https://www.better-auth.com/docs/installation#create-client-instance) [🎉 That's it!](https://www.better-auth.com/docs/installation#-thats-it)