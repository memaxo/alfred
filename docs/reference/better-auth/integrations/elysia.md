---
title: Elysia Integration | Better Auth
url:
description: Integrate Better Auth with Elysia.
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

# Elysia Integration

Copy MarkdownOpen in

This integration guide is assuming you are using Elysia with bun server.

Before you start, make sure you have a Better Auth instance configured. If you haven't done that yet, check out the [installation](https://www.better-auth.com/docs/installation).

### [Mount the handler](https://www.better-auth.com/docs/integrations/elysia#mount-the-handler)

We need to mount the handler to Elysia endpoint.

```
import { Elysia } from "elysia";
import { auth } from "./auth";

const app = new Elysia().mount(auth.handler).listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
```

### [CORS](https://www.better-auth.com/docs/integrations/elysia#cors)

To configure cors, you can use the `cors` plugin from `@elysiajs/cors`.

```
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

import { auth } from "./auth";

const app = new Elysia()
  .use(
    cors({
      origin: "http://localhost:3001",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .mount(auth.handler)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
```

### [Macro](https://www.better-auth.com/docs/integrations/elysia#macro)

You can use [macro](https://elysiajs.com/patterns/macro.html#macro) with [resolve](https://elysiajs.com/essential/handler.html#resolve) to provide session and user information before pass to view.

```
import { Elysia } from "elysia";
import { auth } from "./auth";

// user middleware (compute user and session and pass to routes)
const betterAuth = new Elysia({ name: "better-auth" })
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({
          headers,
        });

        if (!session) return status(401);

        return {
          user: session.user,
          session: session.session,
        };
      },
    },
  });

const app = new Elysia()
  .use(betterAuth)
  .get("/user", ({ user }) => user, {
    auth: true,
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
```

This will allow you to access the `user` and `session` object in all of your routes.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/integrations/elysia.mdx)

[Previous Page\\
\\
Express](https://www.better-auth.com/docs/integrations/express) [Next Page\\
\\
Nitro](https://www.better-auth.com/docs/integrations/nitro)

### On this page

[Mount the handler](https://www.better-auth.com/docs/integrations/elysia#mount-the-handler) [CORS](https://www.better-auth.com/docs/integrations/elysia#cors) [Macro](https://www.better-auth.com/docs/integrations/elysia#macro)
