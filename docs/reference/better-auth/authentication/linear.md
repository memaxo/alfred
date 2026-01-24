---
title: Linear | Better Auth
url:
description: Linear provider setup and usage.
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

# Linear

Copy MarkdownOpen in

### [Get your Linear credentials](https://www.better-auth.com/docs/authentication/linear#get-your-linear-credentials)

To use Linear sign in, you need a client ID and client secret. You can get them from the [Linear Developer Portal](https://linear.app/settings/api).

Make sure to set the redirect URL to `http://localhost:3000/api/auth/callback/linear` for local development. For production, you should set it to the URL of your application. If you change the base path of the auth routes, you should update the redirect URL accordingly.

When creating your OAuth application in Linear, you'll need to specify the required scopes. The default scope is `read`, but you can also request additional scopes like `write` if needed.

### [Configure the provider](https://www.better-auth.com/docs/authentication/linear#configure-the-provider)

To configure the provider, you need to import the provider and pass it to the `socialProviders` option of the auth instance.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    socialProviders: {
        linear: {
            clientId: process.env.LINEAR_CLIENT_ID as string,
            clientSecret: process.env.LINEAR_CLIENT_SECRET as string,
        },
    },
})
```

### [Sign In with Linear](https://www.better-auth.com/docs/authentication/linear#sign-in-with-linear)

To sign in with Linear, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `linear`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
const authClient = createAuthClient()

const signIn = async () => {
    const data = await authClient.signIn.social({
        provider: "linear"
    })
}
```

### [Available scopes](https://www.better-auth.com/docs/authentication/linear#available-scopes)

Linear OAuth supports the following scopes:

- `read` (default): Read access for the user's account
- `write`: Write access for the user's account
- `issues:create`: Allows creating new issues and their attachments
- `comments:create`: Allows creating new issue comments
- `timeSchedule:write`: Allows creating and modifying time schedules
- `admin`: Full access to admin level endpoints (use with caution)

You can specify additional scopes when configuring the provider:

auth.ts

```
export const auth = betterAuth({
    socialProviders: {
        linear: {
            clientId: process.env.LINEAR_CLIENT_ID as string,
            clientSecret: process.env.LINEAR_CLIENT_SECRET as string,
            scope: ["read", "write"]
        },
    },
})
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/linear.mdx)

[Previous Page\\
\\
Dropbox](https://www.better-auth.com/docs/authentication/dropbox) [Next Page\\
\\
LinkedIn](https://www.better-auth.com/docs/authentication/linkedin)

### On this page

[Get your Linear credentials](https://www.better-auth.com/docs/authentication/linear#get-your-linear-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/linear#configure-the-provider) [Sign In with Linear](https://www.better-auth.com/docs/authentication/linear#sign-in-with-linear) [Available scopes](https://www.better-auth.com/docs/authentication/linear#available-scopes)
