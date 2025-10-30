---
title: MastraJwtAuth Class
url: 
description: Documentation for the MastraJwtAuth class, which authenticates Mastra applications using JSON Web Tokens.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/auth/jwt#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Authexp.](https://mastra.ai/en/docs/auth "Auth") JSON Web Token

Copy page

# MastraJwtAuth Class

The `MastraJwtAuth` class provides a lightweight authentication mechanism for Mastra using JSON Web Tokens (JWTs). It verifies incoming requests based on a shared secret and integrates with the Mastra server using the `experimental_auth` option.

## Installation [Permalink for this section](https://mastra.ai/en/docs/auth/jwt\#installation)

Before you can use the `MastraJwtAuth` class you have to install the `@mastra/auth` package.

```nextra-code

npm install @mastra/auth@latest
```

## Usage example [Permalink for this section](https://mastra.ai/en/docs/auth/jwt\#usage-example)

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { MastraJwtAuth } from '@mastra/auth';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraJwtAuth({
        secret: process.env.MASTRA_JWT_SECRET
    }),
  },
});
```

> See the [MastraJwtAuth](https://mastra.ai/reference/auth/jwt) API reference for all available configuration options.

## Configuring `MastraClient` [Permalink for this section](https://mastra.ai/en/docs/auth/jwt\#configuring-mastraclient)

When `experimental_auth` is enabled, all requests made with `MastraClient` must include a valid JWT in the `Authorization` header:

lib/mastra/mastra-client.ts

```nextra-code [counter-reset:line]

import { MastraClient } from "@mastra/client-js";

export const mastraClient = new MastraClient({
  baseUrl: "https://<mastra-api-url>",
  headers: {
    Authorization: `Bearer ${process.env.MASTRA_JWT_TOKEN}`
  }
});
```

> See [Mastra Client SDK](https://mastra.ai/docs/server-db/mastra-client) for more configuration options.

### Making authenticated requests [Permalink for this section](https://mastra.ai/en/docs/auth/jwt\#making-authenticated-requests)

Once `MastraClient` is configured, you can send authenticated requests from your frontend application, or use `curl` for quick local testing:

MastraClientcurl

src/components/test-agent.tsx

```nextra-code [counter-reset:line]

import { mastraClient } from "../../lib/mastra-client";

export const TestAgent = () => {
  async function handleClick() {
    const agent = mastraClient.getAgent("weatherAgent");

    const response = await agent.generate({
      messages: "Weather in London"
    });

    console.log(response);
  }

  return <button onClick={handleClick}>Test Agent</button>;
};
```

```nextra-code

curl -X POST http://localhost:4111/api/agents/weatherAgent/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt>" \
  -d '{
    "messages": "Weather in London"
  }'
```

## Creating a JWT [Permalink for this section](https://mastra.ai/en/docs/auth/jwt\#creating-a-jwt)

To authenticate requests to your Mastra server, you’ll need a valid JSON Web Token (JWT) signed with your `MASTRA_JWT_SECRET`.

The easiest way to generate one is using [jwt.io](https://www.jwt.io/):

1. Select **JWT Encoder**.
2. Scroll down to the **Sign JWT: Secret** section.
3. Enter your secret (for example: `supersecretdevkeythatishs256safe!`).
4. Click **Generate example** to create a valid JWT.
5. Copy the generated token and set it as `MASTRA_JWT_TOKEN` in your `.env` file.

[Overview](https://mastra.ai/en/docs/auth "Overview") [Clerk](https://mastra.ai/en/docs/auth/clerk "Clerk")