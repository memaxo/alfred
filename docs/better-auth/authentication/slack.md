---
title: Slack | Better Auth
url: 
description: Slack provider setup and usage.
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

# Slack

Copy MarkdownOpen in

### [Get your Slack credentials](https://www.better-auth.com/docs/authentication/slack\#get-your-slack-credentials)

To use Slack as a social provider, you need to create a Slack app and get your credentials.

1. Go to [Your Apps on Slack API](https://api.slack.com/apps) and click "Create New App"
2. Choose "From scratch" and give your app a name and select a development workspace
3. In your app settings, navigate to "OAuth & Permissions"
4. Under "Redirect URLs", add your redirect URL:
   - For local development: `http://localhost:3000/api/auth/callback/slack`
   - For production: `https://yourdomain.com/api/auth/callback/slack`
5. Copy your Client ID and Client Secret from the "Basic Information" page

Slack requires HTTPS for redirect URLs in production. For local development, you can use tools like [ngrok](https://ngrok.com/) to create a secure tunnel.

### [Configure the provider](https://www.better-auth.com/docs/authentication/slack\#configure-the-provider)

To configure the provider, you need to pass the `clientId` and `clientSecret` to `socialProviders.slack` in your auth configuration.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    socialProviders: {
        slack: {
            clientId: process.env.SLACK_CLIENT_ID as string,
            clientSecret: process.env.SLACK_CLIENT_SECRET as string,
        },
    },
})
```

## [Usage](https://www.better-auth.com/docs/authentication/slack\#usage)

### [Sign In with Slack](https://www.better-auth.com/docs/authentication/slack\#sign-in-with-slack)

To sign in with Slack, you can use the `signIn.social` function provided by the client. The `signIn` function takes an object with the following properties:

- `provider`: The provider to use. It should be set to `slack`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client";
const authClient = createAuthClient();

const signIn = async () => {
  const data = await authClient.signIn.social({ provider: "slack" });
};
```

### [Requesting Additional Scopes](https://www.better-auth.com/docs/authentication/slack\#requesting-additional-scopes)

By default, Slack uses OpenID Connect scopes: `openid`, `profile`, and `email`. You can request additional Slack scopes during sign-in:

auth-client.ts

```
const signInWithSlack = async () => {
  await authClient.signIn.social({
    provider: "slack",
    scopes: ["channels:read", "chat:write"], // Additional Slack API scopes
  });
};
```

### [Workspace-Specific Sign In](https://www.better-auth.com/docs/authentication/slack\#workspace-specific-sign-in)

If you want to restrict sign-in to a specific Slack workspace, you can pass the `team` parameter:

auth.ts

```
socialProviders: {
    slack: {
        clientId: process.env.SLACK_CLIENT_ID as string,
        clientSecret: process.env.SLACK_CLIENT_SECRET as string,
        team: "T1234567890", // Your Slack workspace ID
    },
}
```

### [Using Slack API After Sign In](https://www.better-auth.com/docs/authentication/slack\#using-slack-api-after-sign-in)

After successful authentication, you can access the user's Slack information through the session. The access token can be used to make requests to the Slack API:

```
const session = await authClient.getSession();
if (session?.user) {
  // Access Slack-specific data
  const slackUserId = session.user.id; // This is the Slack user ID
  // The access token is stored securely on the server
}
```

The Slack provider uses OpenID Connect by default, which provides basic user
information. If you need to access other Slack APIs, make sure to request the
appropriate scopes during sign-in.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/slack.mdx)

[Previous Page\\
\\
Salesforce](https://www.better-auth.com/docs/authentication/salesforce) [Next Page\\
\\
Notion](https://www.better-auth.com/docs/authentication/notion)

### On this page

[Get your Slack credentials](https://www.better-auth.com/docs/authentication/slack#get-your-slack-credentials) [Configure the provider](https://www.better-auth.com/docs/authentication/slack#configure-the-provider) [Usage](https://www.better-auth.com/docs/authentication/slack#usage) [Sign In with Slack](https://www.better-auth.com/docs/authentication/slack#sign-in-with-slack) [Requesting Additional Scopes](https://www.better-auth.com/docs/authentication/slack#requesting-additional-scopes) [Workspace-Specific Sign In](https://www.better-auth.com/docs/authentication/slack#workspace-specific-sign-in) [Using Slack API After Sign In](https://www.better-auth.com/docs/authentication/slack#using-slack-api-after-sign-in)