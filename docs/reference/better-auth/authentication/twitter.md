---
title: Twitter (X) | Better Auth
url:
description: Twitter provider setup and usage.
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

# Twitter (X)

Copy MarkdownOpen in

### [Get your Twitter Credentials](https://www.better-auth.com/docs/authentication/twitter#get-your-twitter-credentials)

Get your Twitter credentials from the [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard).

Make sure to set the redirect URL to `http://localhost:3000/api/auth/callback/twitter` for local development. For production, you should set it to the URL of your application. If you change the base path of the auth routes, you should update the redirect URL accordingly.

Twitter API v2 now supports email address retrieval. Make sure to request the `user.email` scope when configuring your Twitter app to enable this feature.

### [Configure the provider](https://www.better-auth.com/docs/authentication/twitter#configure-the-provider)

To configure the provider, you need to import the provider and pass it to the `socialProviders` option of the auth instance.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    socialProviders: {
        twitter: {
            clientId: process.env.TWITTER_CLIENT_ID as string,
            clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
        },
    },
})
```

### [Sign In with Twitter](https://www.better-auth.com/docs/authentication/twitter#sign-in-with-twitter)

To sign in with Twitter, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `twitter`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
const authClient =  createAuthClient()

const signIn = async () => {
    const data = await authClient.signIn.social({
        provider: "twitter"
    })
}
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/twitter.mdx)

[Previous Page\\
\\
Twitch](https://www.better-auth.com/docs/authentication/twitch) [Next Page\\
\\
Dropbox](https://www.better-auth.com/docs/authentication/dropbox)

### On this page

[Get your Twitter Credentials](https://www.better-auth.com/docs/authentication/twitter#get-your-twitter-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/twitter#configure-the-provider) [Sign In with Twitter](https://www.better-auth.com/docs/authentication/twitter#sign-in-with-twitter)
