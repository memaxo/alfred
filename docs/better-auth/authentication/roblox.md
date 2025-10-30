---
title: Roblox | Better Auth
url: 
description: Roblox provider setup and usage.
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

# Roblox

Copy MarkdownOpen in

### [Get your Roblox Credentials](https://www.better-auth.com/docs/authentication/roblox\#get-your-roblox-credentials)

Get your Roblox credentials from the [Roblox Creator Hub](https://create.roblox.com/dashboard/credentials?activeTab=OAuthTab).

Make sure to set the redirect URL to `http://localhost:3000/api/auth/callback/roblox` for local development. For production, you should set it to the URL of your application. If you change the base path of the auth routes, you should update the redirect URL accordingly.

The Roblox API does not provide email addresses. As a workaround, the user's `email` field uses the `preferred_username` value instead.

### [Configure the provider](https://www.better-auth.com/docs/authentication/roblox\#configure-the-provider)

To configure the provider, you need to import the provider and pass it to the `socialProviders` option of the auth instance.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    socialProviders: {
        roblox: {
            clientId: process.env.ROBLOX_CLIENT_ID as string,
            clientSecret: process.env.ROBLOX_CLIENT_SECRET as string,
        },
    },
})
```

### [Sign In with Roblox](https://www.better-auth.com/docs/authentication/roblox\#sign-in-with-roblox)

To sign in with Roblox, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `roblox`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
const authClient =  createAuthClient()

const signIn = async () => {
    const data = await authClient.signIn.social({
        provider: "roblox"
    })
}
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/roblox.mdx)

[Previous Page\\
\\
Reddit](https://www.better-auth.com/docs/authentication/reddit) [Next Page\\
\\
Spotify](https://www.better-auth.com/docs/authentication/spotify)

### On this page

[Get your Roblox Credentials](https://www.better-auth.com/docs/authentication/roblox#get-your-roblox-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/roblox#configure-the-provider) [Sign In with Roblox](https://www.better-auth.com/docs/authentication/roblox#sign-in-with-roblox)