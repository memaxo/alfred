---
title: TanStack Start Integration | Better Auth
url: 
description: Integrate Better Auth with TanStack Start.
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

# TanStack Start Integration

Copy MarkdownOpen in

This integration guide is assuming you are using TanStack Start.

Before you start, make sure you have a Better Auth instance configured. If you haven't done that yet, check out the [installation](https://www.better-auth.com/docs/installation).

### [Mount the handler](https://www.better-auth.com/docs/integrations/tanstack\#mount-the-handler)

We need to mount the handler to a TanStack API endpoint/Server Route.
Create a new file: `/src/routes/api/auth/$.ts`

src/routes/api/auth/$.ts

```
import { auth } from '@/lib/auth' // import your auth instance
import { createServerFileRoute } from '@tanstack/react-start/server'

export const ServerRoute = createServerFileRoute('/api/auth/$').methods({
  GET: ({ request }) => {
    return auth.handler(request)
  },
  POST: ({ request }) => {
    return auth.handler(request)
  },
})
```

If you haven't created your server route handler yet, you can do so by creating a file: `/src/server.ts`

src/server.ts

```
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createRouter } from './router'

export default createStartHandler({
  createRouter,
})(defaultStreamHandler)
```

### [Usage tips](https://www.better-auth.com/docs/integrations/tanstack\#usage-tips)

- We recommend using the client SDK or `authClient` to handle authentication, rather than server actions with `auth.api`.
- When you call functions that need to set cookies (like `signInEmail` or `signUpEmail`), you'll need to handle cookie setting for TanStack Start. Better Auth provides a `tanstackStartCookies` plugin to automatically handle this for you.

src/lib/auth.ts

```
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const auth = betterAuth({
    //...your config
    plugins: [tanstackStartCookies()] // make sure this is the last plugin in the array
})
```

Now, when you call functions that set cookies, they will be automatically set using TanStack Start's cookie handling system.

```
import { auth } from "@/lib/auth"

const signIn = async () => {
    await auth.api.signInEmail({
        body: {
            email: "user@email.com",
            password: "password",
        }
    })
}
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/integrations/tanstack.mdx)

[Previous Page\\
\\
SolidStart](https://www.better-auth.com/docs/integrations/solid-start) [Next Page\\
\\
Backend](https://www.better-auth.com/docs/integrations/tanstack)

### On this page

[Mount the handler](https://www.better-auth.com/docs/integrations/tanstack#mount-the-handler) [Usage tips](https://www.better-auth.com/docs/integrations/tanstack#usage-tips)