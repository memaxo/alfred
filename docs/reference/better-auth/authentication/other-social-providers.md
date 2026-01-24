---
title: Other Social Providers | Better Auth
url:
description: Other social providers setup and usage.
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

# Other Social Providers

Copy MarkdownOpen in

Better Auth providers out of the box support for the [Generic Oauth Plugin](https://www.better-auth.com/docs/plugins/generic-oauth) which allows you to use any social provider that implements the OAuth2 protocol or OpenID Connect (OIDC) flows.

To use a provider that is not supported out of the box, you can use the [Generic Oauth Plugin](https://www.better-auth.com/docs/plugins/generic-oauth).

## [Installation](https://www.better-auth.com/docs/authentication/other-social-providers#installation)

### [Add the plugin to your auth config](https://www.better-auth.com/docs/authentication/other-social-providers#add-the-plugin-to-your-auth-config)

To use the Generic OAuth plugin, add it to your auth config.

auth.ts

```
import { betterAuth } from "better-auth"
import { genericOAuth } from "better-auth/plugins"

export const auth = betterAuth({
    // ... other config options
    plugins: [\
        genericOAuth({\
            config: [\
                {\
                    providerId: "provider-id",\
                    clientId: "test-client-id",\
                    clientSecret: "test-client-secret",\
                    discoveryUrl: "https://auth.example.com/.well-known/openid-configuration",\
                    // ... other config options\
                },\
                // Add more providers as needed\
            ]\
        })\
    ]
})
```

### [Add the client plugin](https://www.better-auth.com/docs/authentication/other-social-providers#add-the-client-plugin)

Include the Generic OAuth client plugin in your authentication client instance.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { genericOAuthClient } from "better-auth/client/plugins"

const authClient = createAuthClient({
    plugins: [\
        genericOAuthClient()\
    ]
})
```

Read more about installation and usage of the Generic Oauth plugin
[here](https://www.better-auth.com/docs/plugins/generic-oauth#usage).

## [Example usage](https://www.better-auth.com/docs/authentication/other-social-providers#example-usage)

### [Instagram Example](https://www.better-auth.com/docs/authentication/other-social-providers#instagram-example)

auth.ts

```
import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";

export const auth = betterAuth({
  // ... other config options
  plugins: [\
    genericOAuth({\
      config: [\
        {\
          providerId: "instagram",\
          clientId: process.env.INSTAGRAM_CLIENT_ID as string,\
          clientSecret: process.env.INSTAGRAM_CLIENT_SECRET as string,\
          authorizationUrl: "https://api.instagram.com/oauth/authorize",\
          tokenUrl: "https://api.instagram.com/oauth/access_token",\
          scopes: ["user_profile", "user_media"],\
        },\
      ],\
    }),\
  ],
});
```

sign-in.ts

```
const response = await authClient.signIn.oauth2({
  providerId: "instagram",
  callbackURL: "/dashboard", // the path to redirect to after the user is authenticated
});
```

### [Coinbase Example](https://www.better-auth.com/docs/authentication/other-social-providers#coinbase-example)

auth.ts

```
import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";

export const auth = betterAuth({
  // ... other config options
  plugins: [\
    genericOAuth({\
      config: [\
        {\
          providerId: "coinbase",\
          clientId: process.env.COINBASE_CLIENT_ID as string,\
          clientSecret: process.env.COINBASE_CLIENT_SECRET as string,\
          authorizationUrl: "https://www.coinbase.com/oauth/authorize",\
          tokenUrl: "https://api.coinbase.com/oauth/token",\
          scopes: ["wallet:user:read"], // and more...\
        },\
      ],\
    }),\
  ],
});
```

sign-in.ts

```
const response = await authClient.signIn.oauth2({
  providerId: "coinbase",
  callbackURL: "/dashboard", // the path to redirect to after the user is authenticated
});
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/other-social-providers.mdx)

[Previous Page\\
\\
Others](https://www.better-auth.com/docs/authentication/other-social-providers) [Next Page\\
\\
MySQL](https://www.better-auth.com/docs/adapters/mysql)

### On this page

[Installation](https://www.better-auth.com/docs/authentication/other-social-providers#installation) [Add the plugin to your auth config](https://www.better-auth.com/docs/authentication/other-social-providers#add-the-plugin-to-your-auth-config) [Add the client plugin](https://www.better-auth.com/docs/authentication/other-social-providers#add-the-client-plugin) [Example usage](https://www.better-auth.com/docs/authentication/other-social-providers#example-usage) [Instagram Example](https://www.better-auth.com/docs/authentication/other-social-providers#instagram-example) [Coinbase Example](https://www.better-auth.com/docs/authentication/other-social-providers#coinbase-example)
