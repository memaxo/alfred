---
title: Session Management | Better Auth
url:
description: Better Auth session management.
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

# Session Management

Copy MarkdownOpen in

Better Auth manages session using a traditional cookie-based session management. The session is stored in a cookie and is sent to the server on every request. The server then verifies the session and returns the user data if the session is valid.

## [Session table](https://www.better-auth.com/docs/concepts/session-management#session-table)

The session table stores the session data. The session table has the following fields:

- `id`: The session token. Which is also used as the session cookie.
- `userId`: The user ID of the user.
- `expiresAt`: The expiration date of the session.
- `ipAddress`: The IP address of the user.
- `userAgent`: The user agent of the user. It stores the user agent header from the request.

## [Session Expiration](https://www.better-auth.com/docs/concepts/session-management#session-expiration)

The session expires after 7 days by default. But whenever the session is used and the `updateAge` is reached, the session expiration is updated to the current time plus the `expiresIn` value.

You can change both the `expiresIn` and `updateAge` values by passing the `session` object to the `auth` configuration.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    //... other config options
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24 // 1 day (every 1 day the session expiration is updated)
    }
})
```

### [Disable Session Refresh](https://www.better-auth.com/docs/concepts/session-management#disable-session-refresh)

You can disable session refresh so that the session is not updated regardless of the `updateAge` option.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    //... other config options
    session: {
        disableSessionRefresh: true
    }
})
```

## [Session Freshness](https://www.better-auth.com/docs/concepts/session-management#session-freshness)

Some endpoints in Better Auth require the session to be **fresh**. A session is considered fresh if its `createdAt` is within the `freshAge` limit. By default, the `freshAge` is set to **1 day** (60 \* 60 \* 24).

You can customize the `freshAge` value by passing a `session` object in the `auth` configuration:

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    //... other config options
    session: {
        freshAge: 60 * 5 // 5 minutes (the session is fresh if created within the last 5 minutes)
    }
})
```

To **disable the freshness check**, set `freshAge` to `0`:

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    //... other config options
    session: {
        freshAge: 0 // Disable freshness check
    }
})
```

## [Session Management](https://www.better-auth.com/docs/concepts/session-management#session-management)

Better Auth provides a set of functions to manage sessions.

### [Get Session](https://www.better-auth.com/docs/concepts/session-management#get-session)

The `getSession` function retrieves the current active session.

```
import { authClient } from "@/lib/client"

const { data: session } = await authClient.getSession()
```

To learn how to customize the session response check the [Customizing Session Response](https://www.better-auth.com/docs/concepts/session-management#customizing-session-response) section.

### [Use Session](https://www.better-auth.com/docs/concepts/session-management#use-session)

The `useSession` action provides a reactive way to access the current session.

```
import { authClient } from "@/lib/client"

const { data: session } = authClient.useSession()
```

### [List Sessions](https://www.better-auth.com/docs/concepts/session-management#list-sessions)

The `listSessions` function returns a list of sessions that are active for the user.

auth-client.ts

```
import { authClient } from "@/lib/client"

const sessions = await authClient.listSessions()
```

### [Revoke Session](https://www.better-auth.com/docs/concepts/session-management#revoke-session)

When a user signs out of a device, the session is automatically ended. However, you can also end a session manually from any device the user is signed into.

To end a session, use the `revokeSession` function. Just pass the session token as a parameter.

auth-client.ts

```
await authClient.revokeSession({
    token: "session-token"
})
```

### [Revoke Other Sessions](https://www.better-auth.com/docs/concepts/session-management#revoke-other-sessions)

To revoke all other sessions except the current session, you can use the `revokeOtherSessions` function.

auth-client.ts

```
await authClient.revokeOtherSessions()
```

### [Revoke All Sessions](https://www.better-auth.com/docs/concepts/session-management#revoke-all-sessions)

To revoke all sessions, you can use the `revokeSessions` function.

auth-client.ts

```
await authClient.revokeSessions()
```

### [Revoking Sessions on Password Change](https://www.better-auth.com/docs/concepts/session-management#revoking-sessions-on-password-change)

You can revoke all sessions when the user changes their password by passing `revokeOtherSessions` as true on `changePassword` function.

auth.ts

```
await authClient.changePassword({
    newPassword: newPassword,
    currentPassword: currentPassword,
    revokeOtherSessions: true,
})
```

## [Session Caching](https://www.better-auth.com/docs/concepts/session-management#session-caching)

### [Cookie Cache](https://www.better-auth.com/docs/concepts/session-management#cookie-cache)

Calling your database every time `useSession` or `getSession` invoked isn’t ideal, especially if sessions don’t change frequently. Cookie caching handles this by storing session data in a short-lived, signed cookie—similar to how JWT access tokens are used with refresh tokens.

When cookie caching is enabled, the server can check session validity from the cookie itself instead of hitting the database each time. The cookie is signed to prevent tampering, and a short `maxAge` ensures that the session data gets refreshed regularly. If a session is revoked or expires, the cookie will be invalidated automatically.

To turn on cookie caching, just set `session.cookieCache` in your auth config:

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    session: {
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60 // Cache duration in seconds
        }
    }
});
```

If you want to disable returning from the cookie cache when fetching the session, you can pass `disableCookieCache:true` this will force the server to fetch the session from the database and also refresh the cookie cache.

auth-client.ts

```
const session = await authClient.getSession({ query: {
    disableCookieCache: true
}})
```

or on the server

server.ts

```
await auth.api.getSession({
    query: {
        disableCookieCache: true,
    },
    headers: req.headers, // pass the headers
});
```

## [Customizing Session Response](https://www.better-auth.com/docs/concepts/session-management#customizing-session-response)

When you call `getSession` or `useSession`, the session data is returned as a `user` and `session` object. You can customize this response using the `customSession` plugin.

auth.ts

```
import { customSession } from "better-auth/plugins";

export const auth = betterAuth({
    plugins: [\
        customSession(async ({ user, session }) => {\
            const roles = findUserRoles(session.session.userId);\
            return {\
                roles,\
                user: {\
                    ...user,\
                    newField: "newField",\
                },\
                session\
            };\
        }),\
    ],
});
```

This will add `roles` and `user.newField` to the session response.

**Infer on the Client**

auth-client.ts

```
import { customSessionClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth"; // Import the auth instance as a type

const authClient = createAuthClient({
    plugins: [customSessionClient<typeof auth>()],
});

const { data } = authClient.useSession();
const { data: sessionData } = await authClient.getSession();
// data.roles
// data.user.newField
```

### [Caveats on Customizing Session Response](https://www.better-auth.com/docs/concepts/session-management#caveats-on-customizing-session-response)

1. The passed `session` object to the callback does not infer fields added by plugins.

However, as a workaround, you can pull up your auth options and pass it to the plugin to infer the fields.

```
import { betterAuth, BetterAuthOptions } from "better-auth";

const options = {
  //...config options
  plugins: [\
    //...plugins\
  ]
} satisfies BetterAuthOptions;

export const auth = betterAuth({
    ...options,
    plugins: [\
        ...(options.plugins ?? []),\
        customSession(async ({ user, session }, ctx) => {\
            // now both user and session will infer the fields added by plugins and your custom fields\
            return {\
                user,\
                session\
            }\
        }, options), // pass options here\
    ]
})
```

2. When your server and client code are in separate projects or repositories, and you cannot import the `auth` instance as a type reference, type inference for custom session fields will not work on the client side.
3. Session caching, including secondary storage or cookie cache, does not include custom fields. Each time the session is fetched, your custom session function will be called.

**Mutating the list-device-sessions endpoint**
The `/multi-session/list-device-sessions` endpoint from the [multi-session](https://www.better-auth.com/docs/plugins/multi-session) plugin is used to list the devices that the user is signed into.

You can mutate the response of this endpoint by passing the `shouldMutateListDeviceSessionsEndpoint` option to the `customSession` plugin.

By default, we do not mutate the response of this endpoint.

auth.ts

```
import { customSession } from "better-auth/plugins";

export const auth = betterAuth({
    plugins: [\
        customSession(async ({ user, session }, ctx) => {\
            return {\
                user,\
                session\
            }\
        }, {}, { shouldMutateListDeviceSessionsEndpoint: true }),\
    ],
});
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/session-management.mdx)

[Previous Page\\
\\
Rate Limit](https://www.better-auth.com/docs/concepts/rate-limit) [Next Page\\
\\
TypeScript](https://www.better-auth.com/docs/concepts/typescript)

### On this page

[Session table](https://www.better-auth.com/docs/concepts/session-management#session-table) [Session Expiration](https://www.better-auth.com/docs/concepts/session-management#session-expiration) [Disable Session Refresh](https://www.better-auth.com/docs/concepts/session-management#disable-session-refresh) [Session Freshness](https://www.better-auth.com/docs/concepts/session-management#session-freshness) [Session Management](https://www.better-auth.com/docs/concepts/session-management#session-management) [Get Session](https://www.better-auth.com/docs/concepts/session-management#get-session) [Use Session](https://www.better-auth.com/docs/concepts/session-management#use-session) [List Sessions](https://www.better-auth.com/docs/concepts/session-management#list-sessions) [Revoke Session](https://www.better-auth.com/docs/concepts/session-management#revoke-session) [Revoke Other Sessions](https://www.better-auth.com/docs/concepts/session-management#revoke-other-sessions) [Revoke All Sessions](https://www.better-auth.com/docs/concepts/session-management#revoke-all-sessions) [Revoking Sessions on Password Change](https://www.better-auth.com/docs/concepts/session-management#revoking-sessions-on-password-change) [Session Caching](https://www.better-auth.com/docs/concepts/session-management#session-caching) [Cookie Cache](https://www.better-auth.com/docs/concepts/session-management#cookie-cache) [Customizing Session Response](https://www.better-auth.com/docs/concepts/session-management#customizing-session-response) [Caveats on Customizing Session Response](https://www.better-auth.com/docs/concepts/session-management#caveats-on-customizing-session-response)
