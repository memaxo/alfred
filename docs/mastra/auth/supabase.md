---
title: MastraAuthSupabase Class
url: 
description: Documentation for the MastraAuthSupabase class, which authenticates Mastra applications using Supabase Auth.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/auth/supabase#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Authexp.](https://mastra.ai/en/docs/auth "Auth") Supabase

Copy page

# MastraAuthSupabase Class

The `MastraAuthSupabase` class provides authentication for Mastra using Supabase Auth. It verifies incoming requests using Supabase’s authentication system and integrates with the Mastra server using the `experimental_auth` option.

## Prerequisites [Permalink for this section](https://mastra.ai/en/docs/auth/supabase\#prerequisites)

This example uses Supabase Auth. Make sure to add your Supabase credentials to your `.env` file and ensure your Supabase project is properly configured.

.env

```nextra-code

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

> **Note:** Review your Supabase Row Level Security (RLS) settings to ensure proper data access controls.

## Installation [Permalink for this section](https://mastra.ai/en/docs/auth/supabase\#installation)

Before you can use the `MastraAuthSupabase` class you have to install the `@mastra/auth-supabase` package.

```nextra-code

npm install @mastra/auth-supabase@latest
```

## Usage example [Permalink for this section](https://mastra.ai/en/docs/auth/supabase\#usage-example)

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { MastraAuthSupabase } from '@mastra/auth-supabase';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthSupabase({
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY
    }),
  },
});
```

> **Note:** The default `authorizeUser` method checks the `isAdmin` column in the `users` table in the `public` schema. To customize user authorization, provide a custom `authorizeUser` function when constructing the provider.

> See the [MastraAuthSupabase](https://mastra.ai/reference/auth/supabase) API reference for all available configuration options.

## Client-side setup [Permalink for this section](https://mastra.ai/en/docs/auth/supabase\#client-side-setup)

When using Supabase auth, you’ll need to retrieve the access token from Supabase on the client side and pass it to your Mastra requests.

### Retrieving the access token [Permalink for this section](https://mastra.ai/en/docs/auth/supabase\#retrieving-the-access-token)

Use the Supabase client to authenticate users and retrieve their access token:

lib/auth.ts

```nextra-code [counter-reset:line]

import { createClient } from "@supabase/supabase-js";

const supabase = createClient("<supabase-url>", "<supabase-key>");

const authTokenResponse = await supabase.auth.signInWithPassword({
  email: "<user's email>",
  password: "<user's password>",
});

const accessToken = authTokenResponse.data?.session?.access_token;
```

> Refer to the [Supabase documentation](https://supabase.com/docs/guides/auth) for other authentication methods like OAuth, magic links, and more.

## Configuring `MastraClient` [Permalink for this section](https://mastra.ai/en/docs/auth/supabase\#configuring-mastraclient)

When `experimental_auth` is enabled, all requests made with `MastraClient` must include a valid Supabase access token in the `Authorization` header:

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

### Making authenticated requests [Permalink for this section](https://mastra.ai/en/docs/auth/supabase\#making-authenticated-requests)

Once `MastraClient` is configured with the Supabase access token, you can send authenticated requests:

MastraClientcurl

src/components/test-agent.tsx

```nextra-code [counter-reset:line]

import { mastraClient } from "../../lib/mastra-client";

export const TestAgent = () => {
  async function handleClick() {
    const agent = mastraClient.getAgent("weatherAgent");

    const response = await agent.generate({
      messages: "What's the weather like in New York"
    });

    console.log(response);
  }

  return <button onClick={handleClick}>Test Agent</button>;
};
```

```nextra-code

curl -X POST http://localhost:4111/api/agents/weatherAgent/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-supabase-access-token>" \
  -d '{
    "messages": "Weather in London"
  }'
```

[Clerk](https://mastra.ai/en/docs/auth/clerk "Clerk") [Firebase](https://mastra.ai/en/docs/auth/firebase "Firebase")