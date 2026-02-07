---
title: Dub | Better Auth
url:
description: Better Auth Plugin for Lead Tracking using Dub links and OAuth Linking
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

# Dub

Copy MarkdownOpen in

[Dub](https://dub.co/) is an open source modern link management platform for entrepreneurs, creators, and growth teams.

This plugins allows you to track leads when a user signs up using a Dub link. It also adds OAuth linking support to allow you to build integrations extending Dub's linking management infrastructure.

## [Installation](https://www.better-auth.com/docs/plugins/dub#installation)

### [Install the plugin](https://www.better-auth.com/docs/plugins/dub#install-the-plugin)

First, install the plugin:

npm

bun

yarn

bun

```
npm install @dub/better-auth
```

### [Install the Dub SDK](https://www.better-auth.com/docs/plugins/dub#install-the-dub-sdk)

Next, install the Dub SDK on your server:

npm

bun

yarn

bun

```
npm install dub
```

### [Configure the plugin](https://www.better-auth.com/docs/plugins/dub#configure-the-plugin)

Add the plugin to your auth config:

auth.ts

```
import { betterAuth } from "better-auth"
import { dubAnalytics } from "@dub/better-auth"
import { dub } from "dub"

export const auth = betterAuth({
    plugins: [\
        dubAnalytics({\
            dubClient: new Dub()\
        })\
    ]
})
```

## [Usage](https://www.better-auth.com/docs/plugins/dub#usage)

### [Lead Tracking](https://www.better-auth.com/docs/plugins/dub#lead-tracking)

By default, the plugin will track sign up events as leads. You can disable this by setting `disableLeadTracking` to `true`.

```
import { dubAnalytics } from "@dub/better-auth";
import { betterAuth } from "better-auth";
import { Dub } from "dub";

const dub = new Dub();

const betterAuth = betterAuth({
  plugins: [\
    dubAnalytics({\
      dubClient: dub,\
      disableLeadTracking: true, // Disable lead tracking\
    }),\
  ],
});
```

### [OAuth Linking](https://www.better-auth.com/docs/plugins/dub#oauth-linking)

The plugin supports OAuth for account linking.

First, you need to setup OAuth app in Dub. Dub supports OAuth 2.0 authentication, which is recommended if you build integrations extending Dub’s functionality [Learn more about OAuth](https://dub.co/docs/integrations/quickstart#integrating-via-oauth-2-0-recommended).

Once you get the client ID and client secret, you can configure the plugin.

```
dubAnalytics({
  dubClient: dub,
  oauth: {
    clientId: "your-client-id",
    clientSecret: "your-client-secret",
  },
});
```

And in the client, you need to use the `dubAnalyticsClient` plugin.

```
import { createAuthClient } from "better-auth/client";
import { dubAnalyticsClient } from "@dub/better-auth/client";

const authClient = createAuthClient({
  plugins: [dubAnalyticsClient()],
});
```

To link account with Dub, you need to use the `dub.link`.

ClientServer

POST

/dub/link

```
const { data, error } = await authClient.dub.link({
    callbackURL: "/dashboard", // required
});
```

| Prop          | Description                      | Type     |
| ------------- | -------------------------------- | -------- |
| `callbackURL` | URL to redirect to after linking | `string` |

POST

/dub/link

```
const data = await auth.api.dubLink({
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

## [Options](https://www.better-auth.com/docs/plugins/dub#options)

You can pass the following options to the plugin:

### [`dubClient`](https://www.better-auth.com/docs/plugins/dub#dubclient)

The Dub client instance.

### [`disableLeadTracking`](https://www.better-auth.com/docs/plugins/dub#disableleadtracking)

Disable lead tracking for sign up events.

### [`leadEventName`](https://www.better-auth.com/docs/plugins/dub#leadeventname)

Event name for sign up leads.

### [`customLeadTrack`](https://www.better-auth.com/docs/plugins/dub#customleadtrack)

Custom lead track function.

### [`oauth`](https://www.better-auth.com/docs/plugins/dub#oauth)

Dub OAuth configuration.

### [`oauth.clientId`](https://www.better-auth.com/docs/plugins/dub#oauthclientid)

Client ID for Dub OAuth.

### [`oauth.clientSecret`](https://www.better-auth.com/docs/plugins/dub#oauthclientsecret)

Client secret for Dub OAuth.

### [`oauth.pkce`](https://www.better-auth.com/docs/plugins/dub#oauthpkce)

Enable PKCE for Dub OAuth.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/dub.mdx)

[Previous Page\\
\\
Dodo Payments](https://www.better-auth.com/docs/plugins/dodopayments) [Next Page\\
\\
Community Plugins](https://www.better-auth.com/docs/plugins/community-plugins)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/dub#installation) [Install the plugin](https://www.better-auth.com/docs/plugins/dub#install-the-plugin) [Install the Dub SDK](https://www.better-auth.com/docs/plugins/dub#install-the-dub-sdk) [Configure the plugin](https://www.better-auth.com/docs/plugins/dub#configure-the-plugin) [Usage](https://www.better-auth.com/docs/plugins/dub#usage) [Lead Tracking](https://www.better-auth.com/docs/plugins/dub#lead-tracking) [OAuth Linking](https://www.better-auth.com/docs/plugins/dub#oauth-linking) [Options](https://www.better-auth.com/docs/plugins/dub#options) [`dubClient`](https://www.better-auth.com/docs/plugins/dub#dubclient) [`disableLeadTracking`](https://www.better-auth.com/docs/plugins/dub#disableleadtracking) [`leadEventName`](https://www.better-auth.com/docs/plugins/dub#leadeventname) [`customLeadTrack`](https://www.better-auth.com/docs/plugins/dub#customleadtrack) [`oauth`](https://www.better-auth.com/docs/plugins/dub#oauth) [`oauth.clientId`](https://www.better-auth.com/docs/plugins/dub#oauthclientid) [`oauth.clientSecret`](https://www.better-auth.com/docs/plugins/dub#oauthclientsecret) [`oauth.pkce`](https://www.better-auth.com/docs/plugins/dub#oauthpkce)
