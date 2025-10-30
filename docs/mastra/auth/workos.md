---
title: MastraAuthWorkos Class
url: 
description: Documentation for the MastraAuthWorkos class, which authenticates Mastra applications using WorkOS authentication.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/auth/workos#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Authexp.](https://mastra.ai/en/docs/auth "Auth") WorkOS

Copy page

# MastraAuthWorkos Class

The `MastraAuthWorkos` class provides authentication for Mastra using WorkOS. It verifies incoming requests using WorkOS access tokens and integrates with the Mastra server using the `experimental_auth` option.

## Prerequisites [Permalink for this section](https://mastra.ai/en/docs/auth/workos\#prerequisites)

This example uses WorkOS authentication. Make sure to:

1. Create a WorkOS account at [workos.com](https://workos.com/)
2. Set up an Application in your WorkOS Dashboard
3. Configure your redirect URIs and allowed origins
4. Set up Organizations and configure user roles as needed

.env

```nextra-code

WORKOS_API_KEY=sk_live_...
WORKOS_CLIENT_ID=client_...
```

> **Note:** You can find your API key and Client ID in the WorkOS Dashboard under API Keys and Applications respectively.

> For detailed setup instructions, refer to the [WorkOS documentation](https://workos.com/docs) for your specific platform.

## Installation [Permalink for this section](https://mastra.ai/en/docs/auth/workos\#installation)

Before you can use the `MastraAuthWorkos` class you have to install the `@mastra/auth-workos` package.

```nextra-code

npm install @mastra/auth-workos@latest
```

## Usage examples [Permalink for this section](https://mastra.ai/en/docs/auth/workos\#usage-examples)

### Basic usage with environment variables [Permalink for this section](https://mastra.ai/en/docs/auth/workos\#basic-usage-with-environment-variables)

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { MastraAuthWorkos } from '@mastra/auth-workos';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthWorkos(),
  },
});
```

### Custom configuration [Permalink for this section](https://mastra.ai/en/docs/auth/workos\#custom-configuration)

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { MastraAuthWorkos } from '@mastra/auth-workos';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthWorkos({
      apiKey: process.env.WORKOS_API_KEY,
      clientId: process.env.WORKOS_CLIENT_ID
    }),
  },
});
```

## Configuration [Permalink for this section](https://mastra.ai/en/docs/auth/workos\#configuration)

### User Authorization [Permalink for this section](https://mastra.ai/en/docs/auth/workos\#user-authorization)

By default, `MastraAuthWorkos` checks whether the authenticated user has an ‘admin’ role in any of their organization memberships. The authorization process:

1. Retrieves the user’s organization memberships using their user ID
2. Extracts all roles from their memberships
3. Checks if any role has the slug ‘admin’
4. Grants access only if the user has admin role in at least one organization

To customize user authorization, provide a custom `authorizeUser` function:

src/mastra/auth.ts

```nextra-code [counter-reset:line]

import { MastraAuthWorkos } from '@mastra/auth-workos';

const workosAuth = new MastraAuthWorkos({
  apiKey: process.env.WORKOS_API_KEY,
  clientId: process.env.WORKOS_CLIENT_ID,
  authorizeUser: async (user) => {
    return !!user;
  },
});
```

> See the [MastraAuthWorkos](https://mastra.ai/reference/auth/workos) API reference for all available configuration options.

## Client-side setup [Permalink for this section](https://mastra.ai/en/docs/auth/workos\#client-side-setup)

When using WorkOS auth, you’ll need to implement the WorkOS authentication flow to exchange an authorization code for an access token, then use that token with your Mastra requests.

### Installing WorkOS SDK [Permalink for this section](https://mastra.ai/en/docs/auth/workos\#installing-workos-sdk)

First, install the WorkOS SDK in your application:

```nextra-code

npm install @workos-inc/node
```

### Exchanging code for access token [Permalink for this section](https://mastra.ai/en/docs/auth/workos\#exchanging-code-for-access-token)

After users complete the WorkOS authentication flow and return with an authorization code, exchange it for an access token:

lib/auth.ts

```nextra-code [counter-reset:line]

import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

export const authenticateWithWorkos = async (code: string, clientId: string) => {
  const authenticationResponse = await workos.userManagement.authenticateWithCode({
    code,
    clientId,
  });

  return authenticationResponse.accessToken;
};
```

> Refer to the [WorkOS User Management documentation](https://workos.com/docs/authkit/vanilla/nodejs) for more authentication methods and configuration options.

## Configuring `MastraClient` [Permalink for this section](https://mastra.ai/en/docs/auth/workos\#configuring-mastraclient)

When `experimental_auth` is enabled, all requests made with `MastraClient` must include a valid WorkOS access token in the `Authorization` header:

lib/mastra/mastra-client.ts

```nextra-code [counter-reset:line]

import { MastraClient } from "@mastra/client-js";

export const createMastraClient = (accessToken: string) => {
  return new MastraClient({
    baseUrl: "https://<mastra-api-url>",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
};
```

> **Note:** The access token must be prefixed with `Bearer` in the Authorization header.

> See [Mastra Client SDK](https://mastra.ai/docs/server-db/mastra-client) for more configuration options.

### Making authenticated requests [Permalink for this section](https://mastra.ai/en/docs/auth/workos\#making-authenticated-requests)

Once `MastraClient` is configured with the WorkOS access token, you can send authenticated requests:

JavaScript/Node.jscurl

src/api/agents.ts

```nextra-code [counter-reset:line]

import { WorkOS } from '@workos-inc/node';
import { MastraClient } from '@mastra/client-js';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

export const callMastraWithWorkos = async (code: string, clientId: string) => {
  const authenticationResponse = await workos.userManagement.authenticateWithCode({
    code,
    clientId,
  });

  const token = authenticationResponse.accessToken;

  const mastra = new MastraClient({
    baseUrl: "http://localhost:4111",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const weatherAgent = mastra.getAgent("weatherAgent");
  const response = await weatherAgent.generate({
    messages: "What's the weather like in Nairobi",
  });

  return response.text;
};
```

```nextra-code

curl -X POST http://localhost:4111/api/agents/weatherAgent/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-workos-access-token>" \
  -d '{
    "messages": "Weather in London"
  }'
```

[Firebase](https://mastra.ai/en/docs/auth/firebase "Firebase") [Auth0](https://mastra.ai/en/docs/auth/auth0 "Auth0")