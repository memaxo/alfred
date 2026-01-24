---
title: Zoom | Better Auth
url:
description: Zoom provider setup and usage.
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

# Zoom

Copy MarkdownOpen in

### [Create a Zoom App from Marketplace](https://www.better-auth.com/docs/authentication/zoom#create-a-zoom-app-from-marketplace)

1. Visit [Zoom Marketplace](https://marketplace.zoom.us/).

2. Hover on the `Develop` button and select `Build App`

3. Select `General App` and click `Create`

### [Configure your Zoom App](https://www.better-auth.com/docs/authentication/zoom#configure-your-zoom-app)

Ensure that you are in the `Basic Information` of your app settings.

1. Under `Select how the app is managed`, choose `User-managed`

2. Under `App Credentials`, copy your `Client ID` and `Client Secret` and store them in a safe location

3. Under `OAuth Information` -\> `OAuth Redirect URL`, add your Callback URL. For example,

```
http://localhost:3000/api/auth/callback/zoom
```

For production, you should set it to the URL of your application. If you change the base
path of the auth routes, you should update the redirect URL accordingly.

Skip to the `Scopes` section, then

1. Click the `Add Scopes` button
2. Search for `user:read:user` (View a user) and select it
3. Add any other scopes your applications needs and click `Done`

### [Configure the provider](https://www.better-auth.com/docs/authentication/zoom#configure-the-provider)

To configure the provider, you need to import the provider and pass it to the `socialProviders` option of the auth instance.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
  socialProviders: {
    zoom: {
      clientId: process.env.ZOOM_CLIENT_ID as string,
      clientSecret: process.env.ZOOM_CLIENT_SECRET as string,
    },
  },
})
```

### [Sign In with Zoom](https://www.better-auth.com/docs/authentication/zoom#sign-in-with-zoom)

To sign in with Zoom, you can use the `signIn.social` function provided by the client.
You will need to specify `zoom` as the provider.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
const authClient =  createAuthClient()

const signIn = async () => {
  const data = await authClient.signIn.social({
    provider: "zoom"
  })
}
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/zoom.mdx)

[Previous Page\\
\\
VK](https://www.better-auth.com/docs/authentication/vk) [Next Page\\
\\
Others](https://www.better-auth.com/docs/authentication/zoom)

### On this page

[Create a Zoom App from Marketplace](https://www.better-auth.com/docs/authentication/zoom#create-a-zoom-app-from-marketplace) [Configure your Zoom App](https://www.better-auth.com/docs/authentication/zoom#configure-your-zoom-app) [Configure the provider](https://www.better-auth.com/docs/authentication/zoom#configure-the-provider) [Sign In with Zoom](https://www.better-auth.com/docs/authentication/zoom#sign-in-with-zoom)
