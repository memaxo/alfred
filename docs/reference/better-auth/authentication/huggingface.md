---
title: Hugging Face | Better Auth
url:
description: Hugging Face provider setup and usage.
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

# Hugging Face

Copy MarkdownOpen in

### [Get your Hugging Face credentials](https://www.better-auth.com/docs/authentication/huggingface#get-your-hugging-face-credentials)

To use Hugging Face sign in, you need a client ID and client secret. [Hugging Face OAuth documentation](https://huggingface.co/docs/hub/oauth). Make sure the created oauth app on Hugging Face has the "email" scope.

Make sure to set the redirect URL to `http://localhost:3000/api/auth/callback/huggingface` for local development. For production, you should set it to the URL of your application. If you change the base path of the auth routes, you should update the redirect URL accordingly.

### [Configure the provider](https://www.better-auth.com/docs/authentication/huggingface#configure-the-provider)

To configure the provider, you need to import the provider and pass it to the `socialProviders` option of the auth instance.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    socialProviders: {
        huggingface: {
            clientId: process.env.HUGGINGFACE_CLIENT_ID as string,
            clientSecret: process.env.HUGGINGFACE_CLIENT_SECRET as string,
        },
    },
})
```

### [Sign In with Hugging Face](https://www.better-auth.com/docs/authentication/huggingface#sign-in-with-hugging-face)

To sign in with Hugging Face, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `huggingface`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
const authClient =  createAuthClient()

const signIn = async () => {
    const data = await authClient.signIn.social({
        provider: "huggingface"
    })
}
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/huggingface.mdx)

[Previous Page\\
\\
LINE](https://www.better-auth.com/docs/authentication/line) [Next Page\\
\\
Kakao](https://www.better-auth.com/docs/authentication/kakao)

### On this page

[Get your Hugging Face credentials](https://www.better-auth.com/docs/authentication/huggingface#get-your-hugging-face-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/huggingface#configure-the-provider) [Sign In with Hugging Face](https://www.better-auth.com/docs/authentication/huggingface#sign-in-with-hugging-face)
