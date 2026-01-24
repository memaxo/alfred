---
title: Magic link | Better Auth
url:
description: Magic link plugin
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

# Magic link

Copy MarkdownOpen in

Magic link or email link is a way to authenticate users without a password. When a user enters their email, a link is sent to their email. When the user clicks on the link, they are authenticated.

## [Installation](https://www.better-auth.com/docs/plugins/magic-link#installation)

### [Add the server Plugin](https://www.better-auth.com/docs/plugins/magic-link#add-the-server-plugin)

Add the magic link plugin to your server:

server.ts

```
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";

export const auth = betterAuth({
    plugins: [\
        magicLink({\
            sendMagicLink: async ({ email, token, url }, request) => {\
                // send email to user\
            }\
        })\
    ]
})
```

### [Add the client Plugin](https://www.better-auth.com/docs/plugins/magic-link#add-the-client-plugin)

Add the magic link plugin to your client:

auth-client.ts

```
import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";
export const authClient = createAuthClient({
    plugins: [\
        magicLinkClient()\
    ]
});
```

## [Usage](https://www.better-auth.com/docs/plugins/magic-link#usage)

### [Sign In with Magic Link](https://www.better-auth.com/docs/plugins/magic-link#sign-in-with-magic-link)

To sign in with a magic link, you need to call `signIn.magicLink` with the user's email address. The `sendMagicLink` function is called to send the magic link to the user's email.

ClientServer

POST

/sign-in/magic-link

```
const { data, error } = await authClient.signIn.magicLink({
    email: "user@email.com", // required
    name: "my-name",
    callbackURL: "/dashboard",
    newUserCallbackURL: "/welcome",
    errorCallbackURL: "/error",
});
```

| Prop                  | Description                                                                                                                                                                                           | Type     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `email`               | Email address to send the magic link.                                                                                                                                                                 | `string` |
| `name?`               | User display name. Only used if the user is registering for the first time.                                                                                                                           | `string` |
| `callbackURL?`        | URL to redirect after magic link verification.                                                                                                                                                        | `string` |
| `newUserCallbackURL?` | URL to redirect after new user signup                                                                                                                                                                 | `string` |
| `errorCallbackURL?`   | URL to redirect if an error happen on verification If only callbackURL is provided but without an `errorCallbackURL` then they will be redirected to the callbackURL with an `error` query parameter. | `string` |

POST

/sign-in/magic-link

```
const data = await auth.api.signInMagicLink({
    body: {
        email: "user@email.com", // required
        name: "my-name",
        callbackURL: "/dashboard",
        newUserCallbackURL: "/welcome",
        errorCallbackURL: "/error",
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop                  | Description                                                                                                                                                                                           | Type     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `email`               | Email address to send the magic link.                                                                                                                                                                 | `string` |
| `name?`               | User display name. Only used if the user is registering for the first time.                                                                                                                           | `string` |
| `callbackURL?`        | URL to redirect after magic link verification.                                                                                                                                                        | `string` |
| `newUserCallbackURL?` | URL to redirect after new user signup                                                                                                                                                                 | `string` |
| `errorCallbackURL?`   | URL to redirect if an error happen on verification If only callbackURL is provided but without an `errorCallbackURL` then they will be redirected to the callbackURL with an `error` query parameter. | `string` |

If the user has not signed up, unless `disableSignUp` is set to `true`, the user will be signed up automatically.

### [Verify Magic Link](https://www.better-auth.com/docs/plugins/magic-link#verify-magic-link)

When you send the URL generated by the `sendMagicLink` function to a user, clicking the link will authenticate them and redirect them to the `callbackURL` specified in the `signIn.magicLink` function. If an error occurs, the user will be redirected to the `callbackURL` with an error query parameter.

If no `callbackURL` is provided, the user will be redirected to the root URL.

If you want to handle the verification manually, (e.g, if you send the user a different URL), you can use the `verify` function.

ClientServer

GET

/magic-link/verify

```
const { data, error } = await authClient.magicLink.verify({
    token: "123456", // required
    callbackURL: "/dashboard",
});
```

| Prop           | Description                                                                             | Type     |
| -------------- | --------------------------------------------------------------------------------------- | -------- |
| `token`        | Verification token.                                                                     | `string` |
| `callbackURL?` | URL to redirect after magic link verification, if not provided will return the session. | `string` |

GET

/magic-link/verify

```
const data = await auth.api.magicLinkVerify({
    query: {
        token: "123456", // required
        callbackURL: "/dashboard",
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop           | Description                                                                             | Type     |
| -------------- | --------------------------------------------------------------------------------------- | -------- |
| `token`        | Verification token.                                                                     | `string` |
| `callbackURL?` | URL to redirect after magic link verification, if not provided will return the session. | `string` |

## [Configuration Options](https://www.better-auth.com/docs/plugins/magic-link#configuration-options)

**sendMagicLink**: The `sendMagicLink` function is called when a user requests a magic link. It takes an object with the following properties:

- `email`: The email address of the user.
- `url`: The URL to be sent to the user. This URL contains the token.
- `token`: The token if you want to send the token with custom URL.

and a `request` object as the second parameter.

**expiresIn**: specifies the time in seconds after which the magic link will expire. The default value is `300` seconds (5 minutes).

**disableSignUp**: If set to `true`, the user will not be able to sign up using the magic link. The default value is `false`.

**generateToken**: The `generateToken` function is called to generate a token which is used to uniquely identify the user. The default value is a random string. There is one parameter:

- `email`: The email address of the user.

When using `generateToken`, ensure that the returned string is hard to guess
because it is used to verify who someone actually is in a confidential way. By
default, we return a long and cryptographically secure string.

**storeToken**: The `storeToken` function is called to store the magic link token in the database. The default value is `"plain"`.

The `storeToken` function can be one of the following:

- `"plain"`: The token is stored in plain text.
- `"hashed"`: The token is hashed using the default hasher.
- `{ type: "custom-hasher", hash: (token: string) => Promise<string> }`: The token is hashed using a custom hasher.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/magic-link.mdx)

[Previous Page\\
\\
Phone Number](https://www.better-auth.com/docs/plugins/phone-number) [Next Page\\
\\
Email OTP](https://www.better-auth.com/docs/plugins/email-otp)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/magic-link#installation) [Add the server Plugin](https://www.better-auth.com/docs/plugins/magic-link#add-the-server-plugin) [Add the client Plugin](https://www.better-auth.com/docs/plugins/magic-link#add-the-client-plugin) [Usage](https://www.better-auth.com/docs/plugins/magic-link#usage) [Sign In with Magic Link](https://www.better-auth.com/docs/plugins/magic-link#sign-in-with-magic-link) [Verify Magic Link](https://www.better-auth.com/docs/plugins/magic-link#verify-magic-link) [Configuration Options](https://www.better-auth.com/docs/plugins/magic-link#configuration-options)
