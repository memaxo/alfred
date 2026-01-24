---
title: Facebook | Better Auth
url:
description: Facebook provider setup and usage.
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

# Facebook

Copy MarkdownOpen in

### [Get your Facebook credentials](https://www.better-auth.com/docs/authentication/facebook#get-your-facebook-credentials)

To use Facebook sign in, you need a client ID and client Secret. You can get them from the [Facebook Developer Portal](https://developers.facebook.com/).
Select your app, navigate to **App Settings > Basic**, locate the following:

- **App ID**: This is your `clientId`
- **App Secret**: This is your `clientSecret`.

Avoid exposing the `clientSecret` in client-side code (e.g., frontend apps) because it’s sensitive information.

Make sure to set the redirect URL to `http://localhost:3000/api/auth/callback/facebook` for local development. For production, you should set it to the URL of your application. If you change the base path of the auth routes, you should update the redirect URL accordingly.

### [Configure the provider](https://www.better-auth.com/docs/authentication/facebook#configure-the-provider)

To configure the provider, you need to import the provider and pass it to the `socialProviders` option of the auth instance.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    socialProviders: {
        facebook: {
            clientId: process.env.FACEBOOK_CLIENT_ID as string,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
        },
    },
})
```

BetterAuth also supports Facebook Login for Business, all you need
to do is provide the `configId` as listed in **Facebook Login For Business > Configurations** alongside your `clientId` and `clientSecret`. Note that the app must be a Business app and, since BetterAuth expects to have an email address and account id, the configuration must be of the "User access token" type. "System-user access token" is not supported.

### [Sign In with Facebook](https://www.better-auth.com/docs/authentication/facebook#sign-in-with-facebook)

To sign in with Facebook, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `facebook`.

auth-client.ts

```
import { createAuthClient } from "better-auth/auth-client"
const authClient = createAuthClient()

const signIn = async () => {
    const data = await authClient.signIn.social({
        provider: "facebook"
    })
}
```

## [Additional Configuration](https://www.better-auth.com/docs/authentication/facebook#additional-configuration)

### [Scopes](https://www.better-auth.com/docs/authentication/facebook#scopes)

By default, Facebook provides basic user information. If you need additional permissions, you can specify scopes in your auth configuration:

auth.ts

```
export const auth = betterAuth({
    socialProviders: {
        facebook: {
            clientId: process.env.FACEBOOK_CLIENT_ID as string,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
            scopes: ["email", "public_profile", "user_friends"], // Overwrites permissions
            fields: ["user_friends"], // Extending list of fields
        },
    },
})
```

Additional options:

- `scopes`: Access basic account information (overwrites).
  - Default: `"email", "public_profile"`
- `fields`: Extend list of fields to retrieve from the Facebook user profile (assignment).
  - Default: `"id", "name", "email", "picture"`

### [Sign In with Facebook With ID or Access Token](https://www.better-auth.com/docs/authentication/facebook#sign-in-with-facebook-with-id-or-access-token)

To sign in with Facebook using the ID Token, you can use the `signIn.social` function to pass the ID Token.

This is useful when you have the ID Token from Facebook on the client-side and want to use it to sign in on the server.

If ID token is provided no redirection will happen, and the user will be signed in directly.

For limited login, you need to pass `idToken.token`, for only `accessToken` you need to pass `idToken.accessToken` and `idToken.token` together because of (#1183)\[ [https://github.com/better-auth/better-auth/issues/1183](https://github.com/better-auth/better-auth/issues/1183)\].

auth-client.ts

```
const data = await authClient.signIn.social({
    provider: "facebook",
    idToken: {
        ...(platform === 'ios' ?
            { token: idToken }
            : { token: accessToken, accessToken: accessToken }),
    },
})
```

For a complete list of available permissions, refer to the [Permissions Reference](https://developers.facebook.com/docs/permissions).

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/facebook.mdx)

[Previous Page\\
\\
Discord](https://www.better-auth.com/docs/authentication/discord) [Next Page\\
\\
Figma](https://www.better-auth.com/docs/authentication/figma)

### On this page

[Get your Facebook credentials](https://www.better-auth.com/docs/authentication/facebook#get-your-facebook-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/facebook#configure-the-provider) [Sign In with Facebook](https://www.better-auth.com/docs/authentication/facebook#sign-in-with-facebook) [Additional Configuration](https://www.better-auth.com/docs/authentication/facebook#additional-configuration) [Scopes](https://www.better-auth.com/docs/authentication/facebook#scopes) [Sign In with Facebook With ID or Access Token](https://www.better-auth.com/docs/authentication/facebook#sign-in-with-facebook-with-id-or-access-token)
