---
title: MastraAuthAuth0 Class
url: 
description: Documentation for the MastraAuthAuth0 class, which authenticates Mastra applications using Auth0 authentication.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/auth/auth0#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Authexp.](https://mastra.ai/en/docs/auth "Auth") Auth0

Copy page

# MastraAuthAuth0 Class

The `MastraAuthAuth0` class provides authentication for Mastra using Auth0. It verifies incoming requests using Auth0-issued JWT tokens and integrates with the Mastra server using the `experimental_auth` option.

## Prerequisites [Permalink for this section](https://mastra.ai/en/docs/auth/auth0\#prerequisites)

This example uses Auth0 authentication. Make sure to:

1. Create an Auth0 account at [auth0.com](https://auth0.com/)
2. Set up an Application in your Auth0 Dashboard
3. Configure an API in your Auth0 Dashboard with an identifier (audience)
4. Configure your application’s allowed callback URLs, web origins, and logout URLs

.env

```nextra-code

AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=your-api-identifier
```

> **Note:** You can find your domain in the Auth0 Dashboard under Applications > Settings. The audience is the identifier of your API configured in Auth0 Dashboard > APIs.

> For detailed setup instructions, refer to the [Auth0 quickstarts](https://auth0.com/docs/quickstarts) for your specific platform.

## Installation [Permalink for this section](https://mastra.ai/en/docs/auth/auth0\#installation)

Before you can use the `MastraAuthAuth0` class you have to install the `@mastra/auth-auth0` package.

```nextra-code

npm install @mastra/auth-auth0@latest
```

## Usage examples [Permalink for this section](https://mastra.ai/en/docs/auth/auth0\#usage-examples)

### Basic usage with environment variables [Permalink for this section](https://mastra.ai/en/docs/auth/auth0\#basic-usage-with-environment-variables)

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { MastraAuthAuth0 } from '@mastra/auth-auth0';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthAuth0(),
  },
});
```

### Custom configuration [Permalink for this section](https://mastra.ai/en/docs/auth/auth0\#custom-configuration)

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { MastraAuthAuth0 } from '@mastra/auth-auth0';

export const mastra = new Mastra({
  // ..
  server: {
    experimental_auth: new MastraAuthAuth0({
      domain: process.env.AUTH0_DOMAIN,
      audience: process.env.AUTH0_AUDIENCE
    }),
  },
});
```

## Configuration [Permalink for this section](https://mastra.ai/en/docs/auth/auth0\#configuration)

### User Authorization [Permalink for this section](https://mastra.ai/en/docs/auth/auth0\#user-authorization)

By default, `MastraAuthAuth0` allows all authenticated users who have valid Auth0 tokens for the specified audience. The token verification ensures that:

1. The token is properly signed by Auth0
2. The token is not expired
3. The token audience matches your configured audience
4. The token issuer matches your Auth0 domain

To customize user authorization, provide a custom `authorizeUser` function:

src/mastra/auth.ts

```nextra-code [counter-reset:line]

import { MastraAuthAuth0 } from '@mastra/auth-auth0';

const auth0Provider = new MastraAuthAuth0({
  authorizeUser: async (user) => {
    // Custom authorization logic
    return user.email?.endsWith('@yourcompany.com') || false;
  }
});
```

> See the [MastraAuthAuth0](https://mastra.ai/reference/auth/auth0) API reference for all available configuration options.

## Client-side setup [Permalink for this section](https://mastra.ai/en/docs/auth/auth0\#client-side-setup)

When using Auth0 auth, you’ll need to set up the Auth0 React SDK, authenticate users, and retrieve their access tokens to pass to your Mastra requests.

### Setting up Auth0 React SDK [Permalink for this section](https://mastra.ai/en/docs/auth/auth0\#setting-up-auth0-react-sdk)

First, install and configure the Auth0 React SDK in your application:

```nextra-code

npm install @auth0/auth0-react
```

src/auth0-provider.tsx

```nextra-code [counter-reset:line]

import React from 'react';
import { Auth0Provider } from '@auth0/auth0-react';

const Auth0ProviderWithHistory = ({ children }) => {
  return (
    <Auth0Provider
      domain={process.env.REACT_APP_AUTH0_DOMAIN}
      clientId={process.env.REACT_APP_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: process.env.REACT_APP_AUTH0_AUDIENCE,
        scope: "read:current_user update:current_user_metadata"
      }}
    >
      {children}
    </Auth0Provider>
  );
};

export default Auth0ProviderWithHistory;
```

### Retrieving access tokens [Permalink for this section](https://mastra.ai/en/docs/auth/auth0\#retrieving-access-tokens)

Use the Auth0 React SDK to authenticate users and retrieve their access tokens:

lib/auth.ts

```nextra-code [counter-reset:line]

import { useAuth0 } from '@auth0/auth0-react';

export const useAuth0Token = () => {
  const { getAccessTokenSilently } = useAuth0();

  const getAccessToken = async () => {
    const token = await getAccessTokenSilently();
    return token;
  };

  return { getAccessToken };
};
```

> Refer to the [Auth0 React SDK documentation](https://auth0.com/docs/libraries/auth0-react) for more authentication methods and configuration options.

## Configuring `MastraClient` [Permalink for this section](https://mastra.ai/en/docs/auth/auth0\#configuring-mastraclient)

When `experimental_auth` is enabled, all requests made with `MastraClient` must include a valid Auth0 access token in the `Authorization` header:

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

### Making authenticated requests [Permalink for this section](https://mastra.ai/en/docs/auth/auth0\#making-authenticated-requests)

Once `MastraClient` is configured with the Auth0 access token, you can send authenticated requests:

React Componentcurl

src/components/mastra-api-test.tsx

```nextra-code [counter-reset:line]

import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { MastraClient } from '@mastra/client-js';

export const MastraApiTest = () => {
  const { getAccessTokenSilently } = useAuth0();
  const [result, setResult] = useState(null);

  const callMastraApi = async () => {
    const token = await getAccessTokenSilently();

    const mastra = new MastraClient({
      baseUrl: "http://localhost:4111",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const weatherAgent = mastra.getAgent("weatherAgent");
    const response = await weatherAgent.generate({
      messages: "What's the weather like in New York"
    });

    setResult(response.text);
  };

  return (
    <div>
      <button onClick={callMastraApi}>
        Test Mastra API
      </button>

      {result && (
        <div className="result">
          <h6>Result:</h6>
          <pre>{result}</pre>
        </div>
      )}
    </div>
  );
};
```

```nextra-code

curl -X POST http://localhost:4111/api/agents/weatherAgent/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-auth0-access-token>" \
  -d '{
    "messages": "Weather in London"
  }'
```

[WorkOS](https://mastra.ai/en/docs/auth/workos "WorkOS") [Overview](https://mastra.ai/en/docs/voice/overview "Overview")