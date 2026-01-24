---
title: Spotify | Better Auth
url:
description: Spotify provider setup and usage.
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

# Spotify

Copy MarkdownOpen in

### [Get your Spotify Credentials](https://www.better-auth.com/docs/authentication/spotify#get-your-spotify-credentials)

To use Spotify sign in, you need a client ID and client secret. You can get them from the [Spotify Developer Portal](https://developer.spotify.com/dashboard/applications).

Make sure to set the redirect URL to `http://localhost:3000/api/auth/callback/spotify` for local development. For production, you should set it to the URL of your application. If you change the base path of the auth routes, you should update the redirect URL accordingly.

### [Configure the provider](https://www.better-auth.com/docs/authentication/spotify#configure-the-provider)

To configure the provider, you need to import the provider and pass it to the `socialProviders` option of the auth instance.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({

    socialProviders: {
        spotify: {
            clientId: process.env.SPOTIFY_CLIENT_ID as string,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET as string,
        },
    },
})
```

### [Sign In with Spotify](https://www.better-auth.com/docs/authentication/spotify#sign-in-with-spotify)

To sign in with Spotify, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `spotify`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
const authClient =  createAuthClient()

const signIn = async () => {
    const data = await authClient.signIn.social({
        provider: "spotify"
    })
}
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/spotify.mdx)

[Previous Page\\
\\
Roblox](https://www.better-auth.com/docs/authentication/roblox) [Next Page\\
\\
VK](https://www.better-auth.com/docs/authentication/vk)

### On this page

[Get your Spotify Credentials](https://www.better-auth.com/docs/authentication/spotify#get-your-spotify-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/spotify#configure-the-provider) [Sign In with Spotify](https://www.better-auth.com/docs/authentication/spotify#sign-in-with-spotify)
