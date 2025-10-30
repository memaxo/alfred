---
title: MastraAuthClerk Class
url: 
description: Documentation for the MastraAuthClerk class, which authenticates Mastra applications using Clerk authentication.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/auth/clerk#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Authexp.](https://mastra.ai/en/docs/auth "Auth") Clerk

Copy page

# MastraAuthClerk Class

The `MastraAuthClerk` class provides authentication for Mastra using Clerk. It verifies incoming requests using Clerk’s authentication system and integrates with the Mastra server using the `experimental_auth` option.

## Prerequisites [Permalink for this section](https://mastra.ai/en/docs/auth/clerk\#prerequisites)

This example uses Clerk authentication. Make sure to add your Clerk credentials to your `.env` file and ensure your Clerk project is properly configured.

.env

```nextra-code

CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWKS_URI=https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json
```

> **Note:** You can find these keys in your Clerk Dashboard under “API Keys”.

## Installation [Permalink for this section](https://mastra.ai/en/docs/auth/clerk\#installation)

Before you can use the `MastraAuthClerk` class you have to install the `@mastra/auth-clerk` package.

```nextra-code

npm install @mastra/auth-clerk@latest
```

## Usage example [Permalink for this section](https://mastra.ai/en/docs/auth/clerk\#usage-example)

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { MastraAuthClerk } from '@mastra/auth-clerk';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthClerk({
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      secretKey: process.env.CLERK_SECRET_KEY,
      jwksUri: process.env.CLERK_JWKS_URI
    }),
  },
});
```

> **Note:** The default `authorizeUser` method allows all authenticated users. To customize user authorization, provide a custom `authorizeUser` function when constructing the provider.

> See the [MastraAuthClerk](https://mastra.ai/reference/auth/clerk) API reference for all available configuration options.

## Client-side setup [Permalink for this section](https://mastra.ai/en/docs/auth/clerk\#client-side-setup)

When using Clerk auth, you’ll need to retrieve the access token from Clerk on the client side and pass it to your Mastra requests.

### Retrieving the access token [Permalink for this section](https://mastra.ai/en/docs/auth/clerk\#retrieving-the-access-token)

Use the Clerk React hooks to authenticate users and retrieve their access token:

lib/auth.ts

```nextra-code [counter-reset:line]

import { useAuth } from "@clerk/nextjs";

export const useClerkAuth = () => {
  const { getToken } = useAuth();

  const getAccessToken = async () => {
    const token = await getToken();
    return token;
  };

  return { getAccessToken };
};
```

> Refer to the [Clerk documentation](https://clerk.com/docs) for more information.

## Configuring `MastraClient` [Permalink for this section](https://mastra.ai/en/docs/auth/clerk\#configuring-mastraclient)

When `experimental_auth` is enabled, all requests made with `MastraClient` must include a valid Clerk access token in the `Authorization` header:

lib/mastra/mastra-client.ts

```nextra-code [counter-reset:line]

import { MastraClient } from "@mastra/client-js";

export const mastraClient = new MastraClient({
  baseUrl: "https://<mastra-api-url>",
  headers: {
    Authorization: `Bearer ${accessToken}`
  }
});
```

> **Note:** The access token must be prefixed with `Bearer` in the Authorization header.
> See [Mastra Client SDK](https://mastra.ai/docs/server-db/mastra-client) for more configuration options.

### Making authenticated requests [Permalink for this section](https://mastra.ai/en/docs/auth/clerk\#making-authenticated-requests)

Once `MastraClient` is configured with the Clerk access token, you can send authenticated requests:

MastraClientcurl

src/components/test-agent.tsx

```nextra-code [counter-reset:line]

"use client";

import { useAuth } from "@clerk/nextjs";
import { MastraClient } from "@mastra/client-js";

export const TestAgent = () => {
  const { getToken } = useAuth();

  async function handleClick() {
    const token = await getToken();

    const client = new MastraClient({
      baseUrl: "http://localhost:4111",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    const weatherAgent = client.getAgent("weatherAgent");
    const response = await weatherAgent.generate({
      messages: "What's the weather like in New York",
    });

    console.log({ response });
  }

  return <button onClick={handleClick}>Test Agent</button>;
};
```

```nextra-code

curl -X POST http://localhost:4111/api/agents/weatherAgent/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-clerk-access-token>" \
  -d '{
    "messages": "Weather in London"
  }'
```

[JSON Web Token](https://mastra.ai/en/docs/auth/jwt "JSON Web Token") [Supabase](https://mastra.ai/en/docs/auth/supabase "Supabase")