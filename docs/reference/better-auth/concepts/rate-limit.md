---
title: Rate Limit | Better Auth
url: 
description: How to limit the number of requests a user can make to the server in a given time period.
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

# Rate Limit

Copy MarkdownOpen in

Better Auth includes a built-in rate limiter to help manage traffic and prevent abuse. By default, in production mode, the rate limiter is set to:

- Window: 60 seconds
- Max Requests: 100 requests

Server-side requests made using `auth.api` aren't affected by rate limiting. Rate limits only apply to client-initiated requests.

You can easily customize these settings by passing the rateLimit object to the betterAuth function.

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
    rateLimit: {
        window: 10, // time window in seconds
        max: 100, // max requests in the window
    },
})
```

Rate limiting is disabled in development mode by default. In order to enable it, set `enabled` to `true`:

auth.ts

```
export const auth = betterAuth({
    rateLimit: {
        enabled: true,
        //...other options
    },
})
```

In addition to the default settings, Better Auth provides custom rules for specific paths. For example:

- `/sign-in/email`: Is limited to 3 requests within 10 seconds.

In addition, plugins also define custom rules for specific paths. For example, `twoFactor` plugin has custom rules:

- `/two-factor/verify`: Is limited to 3 requests within 10 seconds.

These custom rules ensure that sensitive operations are protected with stricter limits.

## [Configuring Rate Limit](https://www.better-auth.com/docs/concepts/rate-limit\#configuring-rate-limit)

### [Connecting IP Address](https://www.better-auth.com/docs/concepts/rate-limit\#connecting-ip-address)

Rate limiting uses the connecting IP address to track the number of requests made by a user. The
default header checked is `x-forwarded-for`, which is commonly used in production environments. If
you are using a different header to track the user's IP address, you'll need to specify it.

auth.ts

```
export const auth = betterAuth({
    //...other options
    advanced: {
        ipAddress: {
          ipAddressHeaders: ["cf-connecting-ip"], // Cloudflare specific header example
      },
    },
    rateLimit: {
        enabled: true,
        window: 60, // time window in seconds
        max: 100, // max requests in the window
    },
})
```

### [Rate Limit Window](https://www.better-auth.com/docs/concepts/rate-limit\#rate-limit-window)

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
    //...other options
    rateLimit: {
        window: 60, // time window in seconds
        max: 100, // max requests in the window
    },
})
```

You can also pass custom rules for specific paths.

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
    //...other options
    rateLimit: {
        window: 60, // time window in seconds
        max: 100, // max requests in the window
        customRules: {
            "/sign-in/email": {
                window: 10,
                max: 3,
            },
            "/two-factor/*": async (request)=> {
                // custom function to return rate limit window and max
                return {
                    window: 10,
                    max: 3,
                }
            }
        },
    },
})
```

If you like to disable rate limiting for a specific path, you can set it to `false` or return `false` from the custom rule function.

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
    //...other options
    rateLimit: {
        customRules: {
            "/get-session": false,
        },
    },
})
```

### [Storage](https://www.better-auth.com/docs/concepts/rate-limit\#storage)

By default, rate limit data is stored in memory, which may not be suitable for many use cases, particularly in serverless environments. To address this, you can use a database, secondary storage, or custom storage for storing rate limit data.

**Using Database**

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
    //...other options
    rateLimit: {
        storage: "database",
        modelName: "rateLimit", //optional by default "rateLimit" is used
    },
})
```

Make sure to run `migrate` to create the rate limit table in your database.

```
npx @better-auth/cli migrate
```

**Using Secondary Storage**

If a [Secondary Storage](https://www.better-auth.com/docs/concepts/database#secondary-storage) has been configured you can use that to store rate limit data.

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
    //...other options
    rateLimit: {
		storage: "secondary-storage"
    },
})
```

**Custom Storage**

If none of the above solutions suits your use case you can implement a `customStorage`.

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
    //...other options
    rateLimit: {
        customStorage: {
            get: async (key) => {
                // get rate limit data
            },
            set: async (key, value) => {
                // set rate limit data
            },
        },
    },
})
```

## [Handling Rate Limit Errors](https://www.better-auth.com/docs/concepts/rate-limit\#handling-rate-limit-errors)

When a request exceeds the rate limit, Better Auth returns the following header:

- `X-Retry-After`: The number of seconds until the user can make another request.

To handle rate limit errors on the client side, you can manage them either globally or on a per-request basis. Since Better Auth clients wrap over Better Fetch, you can pass `fetchOptions` to handle rate limit errors

**Global Handling**

auth-client.ts

```
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
    fetchOptions: {
        onError: async (context) => {
            const { response } = context;
            if (response.status === 429) {
                const retryAfter = response.headers.get("X-Retry-After");
                console.log(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
            }
        },
    }
})
```

**Per Request Handling**

auth-client.ts

```
import { authClient } from "./auth-client";

await authClient.signIn.email({
    fetchOptions: {
        onError: async (context) => {
            const { response } = context;
            if (response.status === 429) {
                const retryAfter = response.headers.get("X-Retry-After");
                console.log(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
            }
        },
    }
})
```

### [Schema](https://www.better-auth.com/docs/concepts/rate-limit\#schema)

If you are using a database to store rate limit data you need this schema:

Table Name: `rateLimit`

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| id | string | PK | Database ID |
| key | string | - | Unique identifier for each rate limit key |
| count | integer | - | Time window in seconds |
| lastRequest | bigint | - | Max requests in the window |

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/rate-limit.mdx)

[Previous Page\\
\\
OAuth](https://www.better-auth.com/docs/concepts/oauth) [Next Page\\
\\
Sessions](https://www.better-auth.com/docs/concepts/session-management)

### On this page

[Configuring Rate Limit](https://www.better-auth.com/docs/concepts/rate-limit#configuring-rate-limit) [Connecting IP Address](https://www.better-auth.com/docs/concepts/rate-limit#connecting-ip-address) [Rate Limit Window](https://www.better-auth.com/docs/concepts/rate-limit#rate-limit-window) [Storage](https://www.better-auth.com/docs/concepts/rate-limit#storage) [Handling Rate Limit Errors](https://www.better-auth.com/docs/concepts/rate-limit#handling-rate-limit-errors) [Schema](https://www.better-auth.com/docs/concepts/rate-limit#schema)