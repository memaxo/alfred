---
title: LinkedIn | Better Auth
url: 
description: LinkedIn Provider
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

# LinkedIn

Copy MarkdownOpen in

### [Get your LinkedIn credentials](https://www.better-auth.com/docs/authentication/linkedin\#get-your-linkedin-credentials)

To use LinkedIn sign in, you need a client ID and client secret. You can get them from the [LinkedIn Developer Portal](https://www.linkedin.com/developers/).

Make sure to set the redirect URL to `http://localhost:3000/api/auth/callback/linkedin` for local development. For production, you should set it to the URL of your application. If you change the base path of the auth routes, you should update the redirect URL accordingly.

In the LinkedIn portal under products you need the **Sign In with LinkedIn using OpenID Connect** product.

There are some different Guides here:
[Authorization Code Flow (3-legged OAuth) (Outdated)](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow) [Sign In with LinkedIn using OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2?context=linkedin%2Fconsumer%2Fcontext)

### [Configure the provider](https://www.better-auth.com/docs/authentication/linkedin\#configure-the-provider)

To configure the provider, you need to import the provider and pass it to the `socialProviders` option of the auth instance.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    socialProviders: {
        linkedin: {
            clientId: process.env.LINKEDIN_CLIENT_ID as string,
            clientSecret: process.env.LINKEDIN_CLIENT_SECRET as string,
        },
    },
})
```

### [Sign In with LinkedIn](https://www.better-auth.com/docs/authentication/linkedin\#sign-in-with-linkedin)

To sign in with LinkedIn, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `linkedin`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
const authClient =  createAuthClient()

const signIn = async () => {
    const data = await authClient.signIn.social({
        provider: "linkedin"
    })
}
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/linkedin.mdx)

[Previous Page\\
\\
Linear](https://www.better-auth.com/docs/authentication/linear) [Next Page\\
\\
GitLab](https://www.better-auth.com/docs/authentication/gitlab)

### On this page

[Get your LinkedIn credentials](https://www.better-auth.com/docs/authentication/linkedin#get-your-linkedin-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/linkedin#configure-the-provider) [Sign In with LinkedIn](https://www.better-auth.com/docs/authentication/linkedin#sign-in-with-linkedin)