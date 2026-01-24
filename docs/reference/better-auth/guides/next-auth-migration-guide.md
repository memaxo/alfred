---
title: Migrating from NextAuth.js to Better Auth | Better Auth
url:
description: A step-by-step guide to transitioning from NextAuth.js to Better Auth.
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

# Migrating from NextAuth.js to Better Auth

Copy MarkdownOpen in

In this guide, we’ll walk through the steps to migrate a project from [NextAuth.js](https://authjs.dev/) to Better Auth, ensuring no loss of data or functionality. While this guide focuses on Next.js, it can be adapted for other frameworks as well.

---

## [Before You Begin](https://www.better-auth.com/docs/guides/next-auth-migration-guide#before-you-begin)

Before starting the migration process, set up Better Auth in your project. Follow the [installation guide](https://www.better-auth.com/docs/installation) to get started.

---

### [Mapping Existing Columns](https://www.better-auth.com/docs/guides/next-auth-migration-guide#mapping-existing-columns)

Instead of altering your existing database column names, you can map them to match Better Auth's expected structure. This allows you to retain your current database schema.

#### [User Schema](https://www.better-auth.com/docs/guides/next-auth-migration-guide#user-schema)

Map the following fields in the user schema:

- (next-auth v4) `emailVerified`: datetime → boolean

#### [Session Schema](https://www.better-auth.com/docs/guides/next-auth-migration-guide#session-schema)

Map the following fields in the session schema:

- `expires` → `expiresAt`
- `sessionToken` → `token`
- (next-auth v4) add `createdAt` with datetime type
- (next-auth v4) add `updatedAt` with datetime type

auth.ts

```
export const auth = betterAuth({
    // Other configs
    session: {
        fields: {
            expiresAt: "expires", // Map your existing `expires` field to Better Auth's `expiresAt`
            token: "sessionToken" // Map your existing `sessionToken` field to Better Auth's `token`
        }
    },
});
```

Make sure to have `createdAt` and `updatedAt` fields on your session schema.

#### [Account Schema](https://www.better-auth.com/docs/guides/next-auth-migration-guide#account-schema)

Map these fields in the account schema:

- (next-auth v4) `provider` → `providerId`
- `providerAccountId` → `accountId`
- `refresh_token` → `refreshToken`
- `access_token` → `accessToken`
- (next-auth v3) `access_token_expires` → `accessTokenExpiresAt` and int → datetime
- (next-auth v4) `expires_at` → `accessTokenExpiresAt` and int → datetime
- `id_token` → `idToken`
- (next-auth v4) add `createdAt` with datetime type
- (next-auth v4) add `updatedAt` with datetime type

Remove the `session_state`, `type`, and `token_type` fields, as they are not required by Better Auth.

auth.ts

```
export const auth = betterAuth({
    // Other configs
    account: {
        fields: {
            accountId: "providerAccountId",
            refreshToken: "refresh_token",
            accessToken: "access_token",
            accessTokenExpiresAt: "access_token_expires",
            idToken: "id_token",
        }
    },
});
```

**Note:** If you use ORM adapters, you can map these fields in your schema file.

**Example with Prisma:**

schema.prisma

```
model Session {
    id          String   @id @default(cuid())
    expiresAt   DateTime @map("expires") // Map your existing `expires` field to Better Auth's `expiresAt`
    token       String   @map("sessionToken") // Map your existing `sessionToken` field to Better Auth's `token`
    userId      String
    user        User     @relation(fields: [userId], references: [id])
}
```

Make sure to have `createdAt` and `updatedAt` fields on your account schema.

### [Update the Route Handler](https://www.better-auth.com/docs/guides/next-auth-migration-guide#update-the-route-handler)

In the `app/api/auth` folder, rename the `[...nextauth]` file to `[...all]` to avoid confusion. Then, update the `route.ts` file as follows:

app/api/auth/\[...all\]/route.ts

```
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "~/server/auth";

export const { POST, GET } = toNextJsHandler(auth);
```

### [Update the Client](https://www.better-auth.com/docs/guides/next-auth-migration-guide#update-the-client)

Create a file named `auth-client.ts` in the `lib` folder. Add the following code:

auth-client.ts

```
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    baseURL: process.env.BASE_URL! // Optional if the API base URL matches the frontend
});

export const { signIn, signOut, useSession } = authClient;
```

#### [Social Login Functions](https://www.better-auth.com/docs/guides/next-auth-migration-guide#social-login-functions)

Update your social login functions to use Better Auth. For example, for Discord:

```
import { signIn } from "~/lib/auth-client";

export const signInDiscord = async () => {
    const data = await signIn.social({
        provider: "discord"
    });
    return data;
};
```

#### [Update `useSession` Calls](https://www.better-auth.com/docs/guides/next-auth-migration-guide#update-usesession-calls)

Replace `useSession` calls with Better Auth’s version. Example:

Profile.tsx

```
import { useSession } from "~/lib/auth-client";

export const Profile = () => {
    const { data } = useSession();
    return (
        <div>
            <pre>
                {JSON.stringify(data, null, 2)}
            </pre>
        </div>
    );
};
```

### [Server-Side Session Handling](https://www.better-auth.com/docs/guides/next-auth-migration-guide#server-side-session-handling)

Use the `auth` instance to get session data on the server:

actions.ts

```
"use server";

import { auth } from "~/server/auth";
import { headers } from "next/headers";

export const protectedAction = async () => {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
};
```

### [Middleware](https://www.better-auth.com/docs/guides/next-auth-migration-guide#middleware)

To protect routes with middleware, refer to the [Next.js middleware guide](https://www.better-auth.com/docs/integrations/next#middleware).

## [Wrapping Up](https://www.better-auth.com/docs/guides/next-auth-migration-guide#wrapping-up)

Congratulations! You’ve successfully migrated from NextAuth.js to Better Auth. For a complete implementation with multiple authentication methods, check out the [demo repository](https://github.com/Bekacru/t3-app-better-auth).

Better Auth offers greater flexibility and more features—be sure to explore the [documentation](https://www.better-auth.com/docs) to unlock its full potential.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/next-auth-migration-guide.mdx)

[Previous Page\\
\\
Guides](https://www.better-auth.com/docs/guides) [Next Page\\
\\
Supabase Migration Guide](https://www.better-auth.com/docs/guides/supabase-migration-guide)

### On this page

[Before You Begin](https://www.better-auth.com/docs/guides/next-auth-migration-guide#before-you-begin) [Mapping Existing Columns](https://www.better-auth.com/docs/guides/next-auth-migration-guide#mapping-existing-columns) [User Schema](https://www.better-auth.com/docs/guides/next-auth-migration-guide#user-schema) [Session Schema](https://www.better-auth.com/docs/guides/next-auth-migration-guide#session-schema) [Account Schema](https://www.better-auth.com/docs/guides/next-auth-migration-guide#account-schema) [Update the Route Handler](https://www.better-auth.com/docs/guides/next-auth-migration-guide#update-the-route-handler) [Update the Client](https://www.better-auth.com/docs/guides/next-auth-migration-guide#update-the-client) [Social Login Functions](https://www.better-auth.com/docs/guides/next-auth-migration-guide#social-login-functions) [Update `useSession` Calls](https://www.better-auth.com/docs/guides/next-auth-migration-guide#update-usesession-calls) [Server-Side Session Handling](https://www.better-auth.com/docs/guides/next-auth-migration-guide#server-side-session-handling) [Middleware](https://www.better-auth.com/docs/guides/next-auth-migration-guide#middleware) [Wrapping Up](https://www.better-auth.com/docs/guides/next-auth-migration-guide#wrapping-up)
