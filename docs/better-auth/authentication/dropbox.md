---
title: Dropbox | Better Auth
url: 
description: Dropbox provider setup and usage.
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

# Dropbox

Copy MarkdownOpen in

### [Get your Dropbox credentials](https://www.better-auth.com/docs/authentication/dropbox\#get-your-dropbox-credentials)

To use Dropbox sign in, you need a client ID and client secret. You can get them from the [Dropbox Developer Portal](https://www.dropbox.com/developers). You can Allow "Implicit Grant & PKCE" for the application in the App Console.

Make sure to set the redirect URL to `http://localhost:3000/api/auth/callback/dropbox` for local development. For production, you should set it to the URL of your application. If you change the base path of the auth routes, you should update the redirect URL accordingly.

If you need deeper dive into Dropbox Authentication, you can check out the [official documentation](https://developers.dropbox.com/oauth-guide).

### [Configure the provider](https://www.better-auth.com/docs/authentication/dropbox\#configure-the-provider)

To configure the provider, you need to import the provider and pass it to the `socialProviders` option of the auth instance.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    socialProviders: {
        dropbox: {
            clientId: process.env.DROPBOX_CLIENT_ID as string,
            clientSecret: process.env.DROPBOX_CLIENT_SECRET as string,
        },
    },
})
```

### [Sign In with Dropbox](https://www.better-auth.com/docs/authentication/dropbox\#sign-in-with-dropbox)

To sign in with Dropbox, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `dropbox`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
const authClient =  createAuthClient()

const signIn = async () => {
    const data = await authClient.signIn.social({
        provider: "dropbox"
    })
}
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/dropbox.mdx)

[Previous Page\\
\\
Twitter (X)](https://www.better-auth.com/docs/authentication/twitter) [Next Page\\
\\
Linear](https://www.better-auth.com/docs/authentication/linear)

### On this page

[Get your Dropbox credentials](https://www.better-auth.com/docs/authentication/dropbox#get-your-dropbox-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/dropbox#configure-the-provider) [Sign In with Dropbox](https://www.better-auth.com/docs/authentication/dropbox#sign-in-with-dropbox)