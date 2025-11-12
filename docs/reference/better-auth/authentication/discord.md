---
title: Discord | Better Auth
url: 
description: Discord provider setup and usage.
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

# Discord

Copy MarkdownOpen in

### [Get your Discord credentials](https://www.better-auth.com/docs/authentication/discord\#get-your-discord-credentials)

To use Discord sign in, you need a client ID and client secret. You can get them from the [Discord Developer Portal](https://discord.com/developers/applications).

Make sure to set the redirect URL to `http://localhost:3000/api/auth/callback/discord` for local development. For production, you should set it to the URL of your application. If you change the base path of the auth routes, you should update the redirect URL accordingly.

### [Configure the provider](https://www.better-auth.com/docs/authentication/discord\#configure-the-provider)

To configure the provider, you need to import the provider and pass it to the `socialProviders` option of the auth instance.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    socialProviders: {
        discord: {
            clientId: process.env.DISCORD_CLIENT_ID as string,
            clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
        },
    },
})
```

### [Sign In with Discord](https://www.better-auth.com/docs/authentication/discord\#sign-in-with-discord)

To sign in with Discord, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `discord`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
const authClient =  createAuthClient()

const signIn = async () => {
    const data = await authClient.signIn.social({
        provider: "discord"
    })
}
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/discord.mdx)

[Previous Page\\
\\
Cognito](https://www.better-auth.com/docs/authentication/cognito) [Next Page\\
\\
Facebook](https://www.better-auth.com/docs/authentication/facebook)

### On this page

[Get your Discord credentials](https://www.better-auth.com/docs/authentication/discord#get-your-discord-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/discord#configure-the-provider) [Sign In with Discord](https://www.better-auth.com/docs/authentication/discord#sign-in-with-discord)