---
title: VK | Better Auth
url: 
description: VK ID Provider
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

# VK

Copy MarkdownOpen in

### [Get your VK ID credentials](https://www.better-auth.com/docs/authentication/vk\#get-your-vk-id-credentials)

To use VK ID sign in, you need a client ID and client secret. You can get them from the [VK ID Developer Portal](https://id.vk.com/about/business/go/docs).

Make sure to set the redirect URL to `http://localhost:3000/api/auth/callback/vk` for local development. For production, you should set it to the URL of your application. If you change the base path of the auth routes, you should update the redirect URL accordingly.

### [Configure the provider](https://www.better-auth.com/docs/authentication/vk\#configure-the-provider)

To configure the provider, you need to import the provider and pass it to the `socialProviders` option of the auth instance.

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  socialProviders: {
    vk: {
      clientId: process.env.VK_CLIENT_ID as string,
      clientSecret: process.env.VK_CLIENT_SECRET as string,
    },
  },
});
```

### [Sign In with VK](https://www.better-auth.com/docs/authentication/vk\#sign-in-with-vk)

To sign in with VK, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `vk`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client";
const authClient = createAuthClient();

const signIn = async () => {
  const data = await authClient.signIn.social({
    provider: "vk",
  });
};
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/vk.mdx)

[Previous Page\\
\\
Spotify](https://www.better-auth.com/docs/authentication/spotify) [Next Page\\
\\
Zoom](https://www.better-auth.com/docs/authentication/zoom)

### On this page

[Get your VK ID credentials](https://www.better-auth.com/docs/authentication/vk#get-your-vk-id-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/vk#configure-the-provider) [Sign In with VK](https://www.better-auth.com/docs/authentication/vk#sign-in-with-vk)