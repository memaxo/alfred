---
title: Bearer Token Authentication | Better Auth
url:
description: Authenticate API requests using Bearer tokens instead of browser cookies
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

# Bearer Token Authentication

Copy MarkdownOpen in

The Bearer plugin enables authentication using Bearer tokens as an alternative to browser cookies. It intercepts requests, adding the Bearer token to the Authorization header before forwarding them to your API.

Use this cautiously; it is intended only for APIs that don't support cookies or require Bearer tokens for authentication. Improper implementation could easily lead to security vulnerabilities.

## [Installing the Bearer Plugin](https://www.better-auth.com/docs/plugins/bearer#installing-the-bearer-plugin)

Add the Bearer plugin to your authentication setup:

auth.ts

```
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";

export const auth = betterAuth({
    plugins: [bearer()]
});
```

## [How to Use Bearer Tokens](https://www.better-auth.com/docs/plugins/bearer#how-to-use-bearer-tokens)

### [1\. Obtain the Bearer Token](https://www.better-auth.com/docs/plugins/bearer#1-obtain-the-bearer-token)

After a successful sign-in, you'll receive a session token in the response headers. Store this token securely (e.g., in `localStorage`):

auth-client.ts

```
const { data } = await authClient.signIn.email({
    email: "user@example.com",
    password: "securepassword"
}, {
  onSuccess: (ctx)=>{
    const authToken = ctx.response.headers.get("set-auth-token") // get the token from the response headers
    // Store the token securely (e.g., in localStorage)
    localStorage.setItem("bearer_token", authToken);
  }
});
```

You can also set this up globally in your auth client:

auth-client.ts

```
export const authClient = createAuthClient({
    fetchOptions: {
        onSuccess: (ctx) => {
            const authToken = ctx.response.headers.get("set-auth-token") // get the token from the response headers
            // Store the token securely (e.g., in localStorage)
            if(authToken){
              localStorage.setItem("bearer_token", authToken);
            }
        }
    }
});
```

You may want to clear the token based on the response status code or other conditions:

### [2\. Configure the Auth Client](https://www.better-auth.com/docs/plugins/bearer#2-configure-the-auth-client)

Set up your auth client to include the Bearer token in all requests:

auth-client.ts

```
export const authClient = createAuthClient({
    fetchOptions: {
        auth: {
           type:"Bearer",
           token: () => localStorage.getItem("bearer_token") || "" // get the token from localStorage
        }
    }
});
```

### [3\. Make Authenticated Requests](https://www.better-auth.com/docs/plugins/bearer#3-make-authenticated-requests)

Now you can make authenticated API calls:

auth-client.ts

```
// This request is automatically authenticated
const { data } = await authClient.listSessions();
```

### [4\. Per-Request Token (Optional)](https://www.better-auth.com/docs/plugins/bearer#4-per-request-token-optional)

You can also provide the token for individual requests:

auth-client.ts

```
const { data } = await authClient.listSessions({
    fetchOptions: {
        headers: {
            Authorization: `Bearer ${token}`
        }
    }
});
```

### [5\. Using Bearer Tokens Outside the Auth Client](https://www.better-auth.com/docs/plugins/bearer#5-using-bearer-tokens-outside-the-auth-client)

The Bearer token can be used to authenticate any request to your API, even when not using the auth client:

api-call.ts

```
const token = localStorage.getItem("bearer_token");

const response = await fetch("https://api.example.com/data", {
  headers: {
    Authorization: `Bearer ${token}`
  }
});

const data = await response.json();
```

And in the server, you can use the `auth.api.getSession` function to authenticate requests:

server.ts

```
import { auth } from "@/auth";

export async function handler(req, res) {
  const session = await auth.api.getSession({
    headers: req.headers
  });

  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Process authenticated request
  // ...
}
```

## [Options](https://www.better-auth.com/docs/plugins/bearer#options)

**requireSignature** (boolean): Require the token to be signed. Default: `false`.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/bearer.mdx)

[Previous Page\\
\\
Utility](https://www.better-auth.com/docs/plugins/bearer) [Next Page\\
\\
Device Authorization](https://www.better-auth.com/docs/plugins/device-authorization)

### On this page

[Installing the Bearer Plugin](https://www.better-auth.com/docs/plugins/bearer#installing-the-bearer-plugin) [How to Use Bearer Tokens](https://www.better-auth.com/docs/plugins/bearer#how-to-use-bearer-tokens) [1\. Obtain the Bearer Token](https://www.better-auth.com/docs/plugins/bearer#1-obtain-the-bearer-token) [2\. Configure the Auth Client](https://www.better-auth.com/docs/plugins/bearer#2-configure-the-auth-client) [3\. Make Authenticated Requests](https://www.better-auth.com/docs/plugins/bearer#3-make-authenticated-requests) [4\. Per-Request Token (Optional)](https://www.better-auth.com/docs/plugins/bearer#4-per-request-token-optional) [5\. Using Bearer Tokens Outside the Auth Client](https://www.better-auth.com/docs/plugins/bearer#5-using-bearer-tokens-outside-the-auth-client) [Options](https://www.better-auth.com/docs/plugins/bearer#options)
