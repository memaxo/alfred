---
title: Kick | Better Auth
url: 
description: Kick provider setup and usage.
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

# Kick

Copy MarkdownOpen in

### [Get your Kick Credentials](https://www.better-auth.com/docs/authentication/kick\#get-your-kick-credentials)

To use Kick sign in, you need a client ID and client secret. You can get them from the [Kick Developer Portal](https://kick.com/settings/developer).

Make sure to set the redirect URL to `http://localhost:3000/api/auth/callback/kick` for local development. For production, you should set it to the URL of your application. If you change the base path of the auth routes, you should update the redirect URL accordingly.

### [Configure the provider](https://www.better-auth.com/docs/authentication/kick\#configure-the-provider)

To configure the provider, you need to import the provider and pass it to the `socialProviders` option of the auth instance.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    socialProviders: {
        kick: {
            clientId: process.env.KICK_CLIENT_ID as string,
            clientSecret: process.env.KICK_CLIENT_SECRET as string,
        },
    }
})
```

### [Sign In with Kick](https://www.better-auth.com/docs/authentication/kick\#sign-in-with-kick)

To sign in with Kick, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `kick`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
const authClient =  createAuthClient()

const signIn = async () => {
    const data = await authClient.signIn.social({
        provider: "kick"
    })
}
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/kick.mdx)

[Previous Page\\
\\
Kakao](https://www.better-auth.com/docs/authentication/kakao) [Next Page\\
\\
Microsoft](https://www.better-auth.com/docs/authentication/microsoft)

### On this page

[Get your Kick Credentials](https://www.better-auth.com/docs/authentication/kick#get-your-kick-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/kick#configure-the-provider) [Sign In with Kick](https://www.better-auth.com/docs/authentication/kick#sign-in-with-kick)