---
title: Microsoft | Better Auth
url: 
description: Microsoft provider setup and usage.
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

# Microsoft

Copy MarkdownOpen in

Enabling OAuth with Microsoft Azure Entra ID (formerly Active Directory) allows your users to sign in and sign up to your application with their Microsoft account.

### [Get your Microsoft credentials](https://www.better-auth.com/docs/authentication/microsoft\#get-your-microsoft-credentials)

To use Microsoft as a social provider, you need to get your Microsoft credentials. Which involves generating your own Client ID and Client Secret using your Microsoft Entra ID dashboard account.

Make sure to set the redirect URL to `http://localhost:3000/api/auth/callback/microsoft` for local development. For production, you should change it to the URL of your application. If you change the base path of the auth routes, you should update the redirect URL accordingly.

see the [Microsoft Entra ID documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app) for more information.

### [Configure the provider](https://www.better-auth.com/docs/authentication/microsoft\#configure-the-provider)

To configure the provider, you need to pass the `clientId` and `clientSecret` to `socialProviders.microsoft` in your auth configuration.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    socialProviders: {
        microsoft: {
            clientId: process.env.MICROSOFT_CLIENT_ID as string,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
            // Optional
            tenantId: 'common',
            authority: "https://login.microsoftonline.com", // Authentication authority URL
            prompt: "select_account", // Forces account selection
        },
    },
})
```

**Authority URL**: Use the default `https://login.microsoftonline.com` for standard Entra ID scenarios or `https://<tenant-id>.ciamlogin.com` for CIAM (Customer Identity and Access Management) scenarios.

## [Sign In with Microsoft](https://www.better-auth.com/docs/authentication/microsoft\#sign-in-with-microsoft)

To sign in with Microsoft, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `microsoft`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient();

const signIn = async () => {
  const data = await authClient.signIn.social({
    provider: "microsoft",
    callbackURL: "/dashboard", // The URL to redirect to after the sign in
  });
};
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/microsoft.mdx)

[Previous Page\\
\\
Kick](https://www.better-auth.com/docs/authentication/kick) [Next Page\\
\\
PayPal](https://www.better-auth.com/docs/authentication/paypal)

### On this page

[Get your Microsoft credentials](https://www.better-auth.com/docs/authentication/microsoft#get-your-microsoft-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/microsoft#configure-the-provider) [Sign In with Microsoft](https://www.better-auth.com/docs/authentication/microsoft#sign-in-with-microsoft)