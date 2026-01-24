---
title: One-Time Token Plugin | Better Auth
url:
description: Generate and verify single-use token
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

# One-Time Token Plugin

Copy MarkdownOpen in

The One-Time Token (OTT) plugin provides functionality to generate and verify secure, single-use session tokens. These are commonly used for across domains authentication.

## [Installation](https://www.better-auth.com/docs/plugins/one-time-token#installation)

### [Add the plugin to your auth config](https://www.better-auth.com/docs/plugins/one-time-token#add-the-plugin-to-your-auth-config)

To use the One-Time Token plugin, add it to your auth config.

auth.ts

```
import { betterAuth } from "better-auth";
import { oneTimeToken } from "better-auth/plugins/one-time-token";

export const auth = betterAuth({
    plugins: [\
      oneTimeToken()\
    ]
    // ... other auth config
});
```

### [Add the client plugin](https://www.better-auth.com/docs/plugins/one-time-token#add-the-client-plugin)

Next, include the one-time-token client plugin in your authentication client instance.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { oneTimeTokenClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [\
        oneTimeTokenClient()\
    ]
})
```

## [Usage](https://www.better-auth.com/docs/plugins/one-time-token#usage)

### [1\. Generate a Token](https://www.better-auth.com/docs/plugins/one-time-token#1-generate-a-token)

Generate a token using `auth.api.generateOneTimeToken` or `authClient.oneTimeToken.generate`

ClientServer

GET

/one-time-token/generate

```
const { data, error } = await authClient.oneTimeToken.generate();
```

GET

/one-time-token/generate

```
const data = await auth.api.generateOneTimeToken({
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

This will return a `token` that is attached to the current session which can be used to verify the one-time token. By default, the token will expire in 3 minutes.

### [2\. Verify the Token](https://www.better-auth.com/docs/plugins/one-time-token#2-verify-the-token)

When the user clicks the link or submits the token, use the `auth.api.verifyOneTimeToken` or `authClient.oneTimeToken.verify` method in another API route to validate it.

ClientServer

POST

/one-time-token/verify

```
const { data, error } = await authClient.oneTimeToken.verify({
    token: "some-token", // required
});
```

| Prop    | Description          | Type     |
| ------- | -------------------- | -------- |
| `token` | The token to verify. | `string` |

POST

/one-time-token/verify

```
const data = await auth.api.verifyOneTimeToken({
    body: {
        token: "some-token", // required
    },
});
```

| Prop    | Description          | Type     |
| ------- | -------------------- | -------- |
| `token` | The token to verify. | `string` |

This will return the session that was attached to the token.

## [Options](https://www.better-auth.com/docs/plugins/one-time-token#options)

These options can be configured when adding the `oneTimeToken` plugin:

- **`disableClientRequest`** (boolean): Optional. If `true`, the token will only be generated on the server side. Default: `false`.
- **`expiresIn`** (number): Optional. The duration for which the token is valid in minutes. Default: `3`.

```
oneTimeToken({
    expiresIn: 10 // 10 minutes
})
```

- **`generateToken`**: A custom token generator function that takes `session` object and a `ctx` as paramters.

- **`storeToken`**: Optional. This option allows you to configure how the token is stored in your database.
  - **`plain`**: The token is stored in plain text. (Default)
  - **`hashed`**: The token is hashed using the default hasher.
  - **`custom-hasher`**: A custom hasher function that takes a token and returns a hashed token.

Note: It will not affect the token that's sent, it will only affect the token stored in your database.

Examples:

No hashing (default)

```
oneTimeToken({
    storeToken: "plain"
})
```

built-in hasher

```
oneTimeToken({
    storeToken: "hashed"
})
```

custom hasher

```
oneTimeToken({
    storeToken: {
        type: "custom-hasher",
        hash: async (token) => {
            return myCustomHasher(token);
        }
    }
})
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/one-time-token.mdx)

[Previous Page\\
\\
OAuth Proxy](https://www.better-auth.com/docs/plugins/oauth-proxy) [Next Page\\
\\
Open API](https://www.better-auth.com/docs/plugins/open-api)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/one-time-token#installation) [Add the plugin to your auth config](https://www.better-auth.com/docs/plugins/one-time-token#add-the-plugin-to-your-auth-config) [Add the client plugin](https://www.better-auth.com/docs/plugins/one-time-token#add-the-client-plugin) [Usage](https://www.better-auth.com/docs/plugins/one-time-token#usage) [1\. Generate a Token](https://www.better-auth.com/docs/plugins/one-time-token#1-generate-a-token) [2\. Verify the Token](https://www.better-auth.com/docs/plugins/one-time-token#2-verify-the-token) [Options](https://www.better-auth.com/docs/plugins/one-time-token#options)
