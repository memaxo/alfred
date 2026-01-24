---
title: Twitch | Better Auth
url:
description: Twitch provider setup and usage.
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

# Twitch

Copy MarkdownOpen in

### [Get your Twitch Credentials](https://www.better-auth.com/docs/authentication/twitch#get-your-twitch-credentials)

To use Twitch sign in, you need a client ID and client secret. You can get them from the [Twitch Developer Portal](https://dev.twitch.tv/console/apps).

Make sure to set the redirect URL to `http://localhost:3000/api/auth/callback/twitch` for local development. For production, you should set it to the URL of your application. If you change the base path of the auth routes, you should update the redirect URL accordingly.

### [Configure the provider](https://www.better-auth.com/docs/authentication/twitch#configure-the-provider)

To configure the provider, you need to import the provider and pass it to the `socialProviders` option of the auth instance.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    socialProviders: {
        twitch: {
            clientId: process.env.TWITCH_CLIENT_ID as string,
            clientSecret: process.env.TWITCH_CLIENT_SECRET as string,
        },
    }
})
```

### [Sign In with Twitch](https://www.better-auth.com/docs/authentication/twitch#sign-in-with-twitch)

To sign in with Twitch, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `twitch`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
const authClient =  createAuthClient()

const signIn = async () => {
    const data = await authClient.signIn.social({
        provider: "twitch"
    })
}
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/twitch.mdx)

[Previous Page\\
\\
Tiktok](https://www.better-auth.com/docs/authentication/tiktok) [Next Page\\
\\
Twitter (X)](https://www.better-auth.com/docs/authentication/twitter)

### On this page

[Get your Twitch Credentials](https://www.better-auth.com/docs/authentication/twitch#get-your-twitch-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/twitch#configure-the-provider) [Sign In with Twitch](https://www.better-auth.com/docs/authentication/twitch#sign-in-with-twitch)
