---
title: One Tap | Better Auth
url:
description: One Tap plugin for Better Auth
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

# One Tap

Copy MarkdownOpen in

The One Tap plugin allows users to log in with a single tap using Google's One Tap API. The plugin
provides a simple way to integrate One Tap into your application, handling the client-side and server-side logic for you.

## [Installation](https://www.better-auth.com/docs/plugins/one-tap#installation)

### [Add the Server Plugin](https://www.better-auth.com/docs/plugins/one-tap#add-the-server-plugin)

Add the One Tap plugin to your auth configuration:

auth.ts

```
import { betterAuth } from "better-auth";
import { oneTap } from "better-auth/plugins";

export const auth = betterAuth({
    plugins: [\
        oneTap(), // Add the One Tap server plugin\
    ]
});
```

### [Add the Client Plugin](https://www.better-auth.com/docs/plugins/one-tap#add-the-client-plugin)

Add the client plugin and specify where the user should be redirected after sign-in or if additional verification (like 2FA) is needed.

```
import { createAuthClient } from "better-auth/client";
import { oneTapClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [\
    oneTapClient({\
      clientId: "YOUR_CLIENT_ID",\
      // Optional client configuration:\
      autoSelect: false,\
      cancelOnTapOutside: true,\
      context: "signin",\
      additionalOptions: {\
        // Any extra options for the Google initialize method\
      },\
      // Configure prompt behavior and exponential backoff:\
      promptOptions: {\
        baseDelay: 1000,   // Base delay in ms (default: 1000)\
        maxAttempts: 5     // Maximum number of attempts before triggering onPromptNotification (default: 5)\
      }\
    })\
  ]
});
```

### [Usage](https://www.better-auth.com/docs/plugins/one-tap#usage)

To display the One Tap popup, simply call the oneTap method on your auth client:

```
await authClient.oneTap();
```

### [Customizing Redirect Behavior](https://www.better-auth.com/docs/plugins/one-tap#customizing-redirect-behavior)

By default, after a successful login the plugin will hard redirect the user to `/`. You can customize this behavior as follows:

#### [Avoiding a Hard Redirect](https://www.better-auth.com/docs/plugins/one-tap#avoiding-a-hard-redirect)

Pass fetchOptions with an onSuccess callback to handle the login response without a page reload:

```
await authClient.oneTap({
  fetchOptions: {
    onSuccess: () => {
      // For example, use a router to navigate without a full reload:
      router.push("/dashboard");
    }
  }
});
```

#### [Specifying a Custom Callback URL](https://www.better-auth.com/docs/plugins/one-tap#specifying-a-custom-callback-url)

To perform a hard redirect to a different page after login, use the callbackURL option:

```
await authClient.oneTap({
  callbackURL: "/dashboard"
});
```

#### [Handling Prompt Dismissals with Exponential Backoff](https://www.better-auth.com/docs/plugins/one-tap#handling-prompt-dismissals-with-exponential-backoff)

If the user dismisses or skips the prompt, the plugin will retry showing the One Tap prompt using exponential backoff based on your configured promptOptions.

If the maximum number of attempts is reached without a successful sign-in, you can use the onPromptNotification callback to be notified—allowing you to render an alternative UI (e.g., a traditional Google Sign-In button) so users can restart the process manually:

```
await authClient.oneTap({
  onPromptNotification: (notification) => {
    console.warn("Prompt was dismissed or skipped. Consider displaying an alternative sign-in option.", notification);
    // Render your alternative UI here
  }
});
```

### [Client Options](https://www.better-auth.com/docs/plugins/one-tap#client-options)

- **clientId**: The client ID for your Google One Tap API.
- **autoSelect**: Automatically select the account if the user is already signed in. Default is false.
- **context**: The context in which the One Tap API should be used (e.g., "signin"). Default is "signin".
- **cancelOnTapOutside**: Cancel the One Tap popup when the user taps outside it. Default is true.
- additionalOptions: Extra options to pass to Google's initialize method as per the [Google Identity Services docs](https://developers.google.com/identity/gsi/web/reference/js-reference#google.accounts.id.prompt).
- **promptOptions**: Configuration for the prompt behavior and exponential backoff:
- **baseDelay**: Base delay in milliseconds for retries. Default is 1000.
- **maxAttempts**: Maximum number of prompt attempts before invoking the onPromptNotification callback. Default is 5.

### [Server Options](https://www.better-auth.com/docs/plugins/one-tap#server-options)

- **disableSignUp**: Disable the sign-up option, allowing only existing users to sign in. Default is `false`.
- **ClientId**: Optionally, pass a client ID here if it is not provided in your social provider configuration.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/one-tap.mdx)

[Previous Page\\
\\
Generic OAuth](https://www.better-auth.com/docs/plugins/generic-oauth) [Next Page\\
\\
Sign In With Ethereum](https://www.better-auth.com/docs/plugins/siwe)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/one-tap#installation) [Add the Server Plugin](https://www.better-auth.com/docs/plugins/one-tap#add-the-server-plugin) [Add the Client Plugin](https://www.better-auth.com/docs/plugins/one-tap#add-the-client-plugin) [Usage](https://www.better-auth.com/docs/plugins/one-tap#usage) [Customizing Redirect Behavior](https://www.better-auth.com/docs/plugins/one-tap#customizing-redirect-behavior) [Avoiding a Hard Redirect](https://www.better-auth.com/docs/plugins/one-tap#avoiding-a-hard-redirect) [Specifying a Custom Callback URL](https://www.better-auth.com/docs/plugins/one-tap#specifying-a-custom-callback-url) [Handling Prompt Dismissals with Exponential Backoff](https://www.better-auth.com/docs/plugins/one-tap#handling-prompt-dismissals-with-exponential-backoff) [Client Options](https://www.better-auth.com/docs/plugins/one-tap#client-options) [Server Options](https://www.better-auth.com/docs/plugins/one-tap#server-options)
