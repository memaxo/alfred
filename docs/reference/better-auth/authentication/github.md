---
title: GitHub | Better Auth
url:
description: GitHub provider setup and usage.
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

# GitHub

Copy MarkdownOpen in

### [Get your GitHub credentials](https://www.better-auth.com/docs/authentication/github#get-your-github-credentials)

To use GitHub sign in, you need a client ID and client secret. You can get them from the [GitHub Developer Portal](https://github.com/settings/developers).

Make sure to set the redirect URL to `http://localhost:3000/api/auth/callback/github` for local development. For production, you should set it to the URL of your application. If you change the base path of the auth routes, you should update the redirect URL accordingly.

Important: You MUST include the user:email scope in your GitHub app. See details below.

### [Configure the provider](https://www.better-auth.com/docs/authentication/github#configure-the-provider)

To configure the provider, you need to import the provider and pass it to the `socialProviders` option of the auth instance.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        },
    },
})
```

### [Sign In with GitHub](https://www.better-auth.com/docs/authentication/github#sign-in-with-github)

To sign in with GitHub, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `github`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
const authClient =  createAuthClient()

const signIn = async () => {
    const data = await authClient.signIn.social({
        provider: "github"
    })
}
```

## [Usage](https://www.better-auth.com/docs/authentication/github#usage)

### [Setting up your Github app](https://www.better-auth.com/docs/authentication/github#setting-up-your-github-app)

Github has two types of apps: Github apps and OAuth apps.

For OAuth apps, you don't have to do anything special (just follow the steps above). For Github apps, you DO have to add one more thing, which is enable it to read the user's email:

1. After creating your app, go to _Permissions and Events_ \> _Account Permissions_ \> _Email Addresses_ and select "Read-Only"

2. Save changes.

That's all! Now you can copy the Client ID and Client Secret of your app!

If you get "email_not_found" error, it's because you selected a Github app & did not configure this part!

### [Why don't I have a refresh token?](https://www.better-auth.com/docs/authentication/github#why-dont-i-have-a-refresh-token)

Github doesn't issue refresh tokens for OAuth apps. For regular OAuth apps,
GitHub issues access tokens that remain valid indefinitely unless the user revokes them,
the app revokes them, or they go unused for a year.
There's no need for a refresh token because the access token doesn't expire on a short interval like Google or Discord.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/github.mdx)

[Previous Page\\
\\
Figma](https://www.better-auth.com/docs/authentication/figma) [Next Page\\
\\
Google](https://www.better-auth.com/docs/authentication/google)

### On this page

[Get your GitHub credentials](https://www.better-auth.com/docs/authentication/github#get-your-github-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/github#configure-the-provider) [Sign In with GitHub](https://www.better-auth.com/docs/authentication/github#sign-in-with-github) [Usage](https://www.better-auth.com/docs/authentication/github#usage) [Setting up your Github app](https://www.better-auth.com/docs/authentication/github#setting-up-your-github-app) [Why don't I have a refresh token?](https://www.better-auth.com/docs/authentication/github#why-dont-i-have-a-refresh-token)
