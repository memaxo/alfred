---
title: OAuth Proxy | Better Auth
url:
description: OAuth Proxy plugin for Better Auth
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

# OAuth Proxy

Copy MarkdownOpen in

A proxy plugin, that allows you to proxy OAuth requests. Useful for development and preview deployments where the redirect URL can't be known in advance to add to the OAuth provider.

## [Installation](https://www.better-auth.com/docs/plugins/oauth-proxy#installation)

### [Add the plugin to your **auth** config](https://www.better-auth.com/docs/plugins/oauth-proxy#add-the-plugin-to-your-auth-config)

auth.ts

```
import { betterAuth } from "better-auth"
import { oAuthProxy } from "better-auth/plugins"

export const auth = betterAuth({
    plugins: [\
        oAuthProxy({\
            productionURL: "https://my-main-app.com", // Optional - if the URL isn't inferred correctly\
            currentURL: "http://localhost:3000", // Optional - if the URL isn't inferred correctly\
        }),\
    ]
})
```

### [Add redirect URL to your OAuth provider](https://www.better-auth.com/docs/plugins/oauth-proxy#add-redirect-url-to-your-oauth-provider)

For the proxy server to work properly, you’ll need to pass the redirect URL of your main production app registered with the OAuth provider in your social provider config. This needs to be done for each social provider you want to proxy requests for.

```
export const auth = betterAuth({
   plugins: [\
       oAuthProxy(),\
   ],
   socialProviders: {
        github: {
            clientId: "your-client-id",
            clientSecret: "your-client-secret",
            redirectURI: "https://my-main-app.com/api/auth/callback/github"
        }
   }
})
```

## [How it works](https://www.better-auth.com/docs/plugins/oauth-proxy#how-it-works)

The plugin adds an endpoint to your server that proxies OAuth requests. When you initiate a social sign-in, it sets the redirect URL to this proxy endpoint. After the OAuth provider redirects back to your server, the plugin then forwards the user to the original callback URL.

```
await authClient.signIn.social({
    provider: "github",
    callbackURL: "/dashboard" // the plugin will override this to something like "http://localhost:3000/api/auth/oauth-proxy?callbackURL=/dashboard"
})
```

When the OAuth provider returns the user to your server, the plugin automatically redirects them to the intended callback URL.

To share cookies between the proxy server and your main server it uses URL query parameters to pass the cookies encrypted in the URL. This is secure as the cookies are encrypted and can only be decrypted by the server.

## [Options](https://www.better-auth.com/docs/plugins/oauth-proxy#options)

**currentURL**: The application's current URL is automatically determined by the plugin. It first checks for the request URL if invoked by a client, then it checks the base URL from popular hosting providers, and finally falls back to the `baseURL` in your auth config. If the URL isn’t inferred correctly, you can specify it manually here.

**productionURL**: If this value matches the `baseURL` in your auth config, requests will not be proxied. Defaults to the `BETTER_AUTH_URL` environment variable.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/oauth-proxy.mdx)

[Previous Page\\
\\
Multi Session](https://www.better-auth.com/docs/plugins/multi-session) [Next Page\\
\\
One-Time Token](https://www.better-auth.com/docs/plugins/one-time-token)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/oauth-proxy#installation) [Add the plugin to your **auth** config](https://www.better-auth.com/docs/plugins/oauth-proxy#add-the-plugin-to-your-auth-config) [Add redirect URL to your OAuth provider](https://www.better-auth.com/docs/plugins/oauth-proxy#add-redirect-url-to-your-oauth-provider) [How it works](https://www.better-auth.com/docs/plugins/oauth-proxy#how-it-works) [Options](https://www.better-auth.com/docs/plugins/oauth-proxy#options)
