---
title: OIDC Provider | Better Auth
url:
description: Open ID Connect plugin for Better Auth that allows you to have your own OIDC provider.
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

# OIDC Provider

Copy MarkdownOpen in

The **OIDC Provider Plugin** enables you to build and manage your own OpenID Connect (OIDC) provider, granting full control over user authentication without relying on third-party services like Okta or Azure AD. It also allows other services to authenticate users through your OIDC provider.

**Key Features**:

- **Client Registration**: Register clients to authenticate with your OIDC provider.
- **Dynamic Client Registration**: Allow clients to register dynamically.
- **Trusted Clients**: Configure hard-coded trusted clients with optional consent bypass.
- **Authorization Code Flow**: Support the Authorization Code Flow.
- **Public Clients**: Support public clients for SPA, mobile apps, CLI tools, etc.
- **JWKS Endpoint**: Publish a JWKS endpoint to allow clients to verify tokens. (Not fully implemented)
- **Refresh Tokens**: Issue refresh tokens and handle access token renewal using the `refresh_token` grant.
- **OAuth Consent**: Implement OAuth consent screens for user authorization, with an option to bypass consent for trusted applications.
- **UserInfo Endpoint**: Provide a UserInfo endpoint for clients to retrieve user details.

This plugin is in active development and may not be suitable for production use. Please report any issues or bugs on [GitHub](https://github.com/better-auth/better-auth).

## [Installation](https://www.better-auth.com/docs/plugins/oidc-provider#installation)

### [Mount the Plugin](https://www.better-auth.com/docs/plugins/oidc-provider#mount-the-plugin)

Add the OIDC plugin to your auth config. See [OIDC Configuration](https://www.better-auth.com/docs/plugins/oidc-provider#oidc-configuration) on how to configure the plugin.

auth.ts

```
import { betterAuth } from "better-auth";
import { oidcProvider } from "better-auth/plugins";

const auth = betterAuth({
    plugins: [oidcProvider({\
        loginPage: "/sign-in", // path to the login page\
        // ...other options\
    })]
})
```

### [Migrate the Database](https://www.better-auth.com/docs/plugins/oidc-provider#migrate-the-database)

Run the migration or generate the schema to add the necessary fields and tables to the database.

migrategenerate

```
npx @better-auth/cli migrate
```

```
npx @better-auth/cli generate
```

See the [Schema](https://www.better-auth.com/docs/plugins/oidc-provider#schema) section to add the fields manually.

### [Add the Client Plugin](https://www.better-auth.com/docs/plugins/oidc-provider#add-the-client-plugin)

Add the OIDC client plugin to your auth client config.

```
import { createAuthClient } from "better-auth/client";
import { oidcClient } from "better-auth/client/plugins"
const authClient = createAuthClient({
    plugins: [oidcClient({\
        // Your OIDC configuration\
    })]
})
```

## [Usage](https://www.better-auth.com/docs/plugins/oidc-provider#usage)

Once installed, you can utilize the OIDC Provider to manage authentication flows within your application.

### [Register a New Client](https://www.better-auth.com/docs/plugins/oidc-provider#register-a-new-client)

To register a new OIDC client, use the `oauth2.register` method.

#### [Simple Example](https://www.better-auth.com/docs/plugins/oidc-provider#simple-example)

```
const application = await client.oauth2.register({
    client_name: "My Client",
    redirect_uris: ["https://client.example.com/callback"],
});
```

#### [Full Method](https://www.better-auth.com/docs/plugins/oidc-provider#full-method)

ClientServer

POST

/oauth2/register

```
const { data, error } = await authClient.oauth2.register({
    redirect_uris: ["https://client.example.com/callback"], // required
    token_endpoint_auth_method: "client_secret_basic",
    grant_types: ["authorization_code"],
    response_types: ["code"],
    client_name: "My App",
    client_uri: "https://client.example.com",
    logo_uri: "https://client.example.com/logo.png",
    scope: "profile email",
    contacts: ["admin@example.com"],
    tos_uri: "https://client.example.com/tos",
    policy_uri: "https://client.example.com/policy",
    jwks_uri: "https://client.example.com/jwks",
    jwks: {"keys": [{"kty": "RSA", "alg": "RS256", "use": "sig", "n": "...", "e": "..."}]},
    metadata: {"key": "value"},
    software_id: "my-software",
    software_version: "1.0.0",
    software_statement,
});
```

| Prop                          | Description                                                   | Type                   |
| ----------------------------- | ------------------------------------------------------------- | ---------------------- | --------------------- | --------------------- | -------------------- | --------------- | --------------------------------------------- | --------------------------------------------------- |
| `redirect_uris`               | A list of redirect URIs.                                      | `string[]`             |
| `token_endpoint_auth_method?` | The authentication method for the token endpoint.             | `"none"                | "client_secret_basic" | "client_secret_post"` |
| `grant_types?`                | The grant types supported by the application.                 | `("authorization_code" | "implicit"            | "password"            | "client_credentials" | "refresh_token" | "urn:ietf:params:oauth:grant-type:jwt-bearer" | "urn:ietf:params:oauth:grant-type:saml2-bearer")[]` |
| `response_types?`             | The response types supported by the application.              | `("code"               | "token")[]`           |
| `client_name?`                | The name of the application.                                  | `string`               |
| `client_uri?`                 | The URI of the application.                                   | `string`               |
| `logo_uri?`                   | The URI of the application logo.                              | `string`               |
| `scope?`                      | The scopes supported by the application. Separated by spaces. | `string`               |
| `contacts?`                   | The contact information for the application.                  | `string[]`             |
| `tos_uri?`                    | The URI of the application terms of service.                  | `string`               |
| `policy_uri?`                 | The URI of the application privacy policy.                    | `string`               |
| `jwks_uri?`                   | The URI of the application JWKS.                              | `string`               |
| `jwks?`                       | The JWKS of the application.                                  | `Record<string, any>`  |
| `metadata?`                   | The metadata of the application.                              | `Record<string, any>`  |
| `software_id?`                | The software ID of the application.                           | `string`               |
| `software_version?`           | The software version of the application.                      | `string`               |
| `software_statement?`         | The software statement of the application.                    | `string`               |

POST

/oauth2/register

```
const data = await auth.api.registerOAuthApplication({
    body: {
        redirect_uris: ["https://client.example.com/callback"], // required
        token_endpoint_auth_method: "client_secret_basic",
        grant_types: ["authorization_code"],
        response_types: ["code"],
        client_name: "My App",
        client_uri: "https://client.example.com",
        logo_uri: "https://client.example.com/logo.png",
        scope: "profile email",
        contacts: ["admin@example.com"],
        tos_uri: "https://client.example.com/tos",
        policy_uri: "https://client.example.com/policy",
        jwks_uri: "https://client.example.com/jwks",
        jwks: {"keys": [{"kty": "RSA", "alg": "RS256", "use": "sig", "n": "...", "e": "..."}]},
        metadata: {"key": "value"},
        software_id: "my-software",
        software_version: "1.0.0",
        software_statement,
    },
});
```

| Prop                          | Description                                                   | Type                   |
| ----------------------------- | ------------------------------------------------------------- | ---------------------- | --------------------- | --------------------- | -------------------- | --------------- | --------------------------------------------- | --------------------------------------------------- |
| `redirect_uris`               | A list of redirect URIs.                                      | `string[]`             |
| `token_endpoint_auth_method?` | The authentication method for the token endpoint.             | `"none"                | "client_secret_basic" | "client_secret_post"` |
| `grant_types?`                | The grant types supported by the application.                 | `("authorization_code" | "implicit"            | "password"            | "client_credentials" | "refresh_token" | "urn:ietf:params:oauth:grant-type:jwt-bearer" | "urn:ietf:params:oauth:grant-type:saml2-bearer")[]` |
| `response_types?`             | The response types supported by the application.              | `("code"               | "token")[]`           |
| `client_name?`                | The name of the application.                                  | `string`               |
| `client_uri?`                 | The URI of the application.                                   | `string`               |
| `logo_uri?`                   | The URI of the application logo.                              | `string`               |
| `scope?`                      | The scopes supported by the application. Separated by spaces. | `string`               |
| `contacts?`                   | The contact information for the application.                  | `string[]`             |
| `tos_uri?`                    | The URI of the application terms of service.                  | `string`               |
| `policy_uri?`                 | The URI of the application privacy policy.                    | `string`               |
| `jwks_uri?`                   | The URI of the application JWKS.                              | `string`               |
| `jwks?`                       | The JWKS of the application.                                  | `Record<string, any>`  |
| `metadata?`                   | The metadata of the application.                              | `Record<string, any>`  |
| `software_id?`                | The software ID of the application.                           | `string`               |
| `software_version?`           | The software version of the application.                      | `string`               |
| `software_statement?`         | The software statement of the application.                    | `string`               |

This endpoint supports [RFC7591](https://datatracker.ietf.org/doc/html/rfc7591) compliant client registration.

Once the application is created, you will receive a `client_id` and `client_secret` that you can display to the user.

### [Trusted Clients](https://www.better-auth.com/docs/plugins/oidc-provider#trusted-clients)

For first-party applications and internal services, you can configure trusted clients directly in your OIDC provider configuration. Trusted clients bypass database lookups for better performance and can optionally skip consent screens for improved user experience.

auth.ts

```
import { betterAuth } from "better-auth";
import { oidcProvider } from "better-auth/plugins";

const auth = betterAuth({
    plugins: [\
      oidcProvider({\
        loginPage: "/sign-in",\
        trustedClients: [\
            {\
                clientId: "internal-dashboard",\
                clientSecret: "secure-secret-here",\
                name: "Internal Dashboard",\
                type: "web",\
                redirectURLs: ["https://dashboard.company.com/auth/callback"],\
                disabled: false,\
                skipConsent: true, // Skip consent for this trusted client\
                metadata: { internal: true }\
            },\
            {\
                clientId: "mobile-app",\
                clientSecret: "mobile-secret",\
                name: "Company Mobile App",\
                type: "native",\
                redirectURLs: ["com.company.app://auth"],\
                disabled: false,\
                skipConsent: false, // Still require consent if needed\
                metadata: {}\
            }\
        ]\
    })]
})
```

### [UserInfo Endpoint](https://www.better-auth.com/docs/plugins/oidc-provider#userinfo-endpoint)

The OIDC Provider includes a UserInfo endpoint that allows clients to retrieve information about the authenticated user. This endpoint is available at `/oauth2/userinfo` and requires a valid access token.

GET

/oauth2/userinfo

client-app.ts

```
// Example of how a client would use the UserInfo endpoint
const response = await fetch('https://your-domain.com/api/auth/oauth2/userinfo', {
  headers: {
    'Authorization': 'Bearer ACCESS_TOKEN'
  }
});

const userInfo = await response.json();
// userInfo contains user details based on the scopes granted
```

The UserInfo endpoint returns different claims based on the scopes that were granted during authorization:

- With `openid` scope: Returns the user's ID ( `sub` claim)
- With `profile` scope: Returns name, picture, given_name, family_name
- With `email` scope: Returns email and email_verified

The `getAdditionalUserInfoClaim` function receives the user object, requested scopes array, and the client, allowing you to conditionally include claims based on the scopes granted during authorization. These additional claims will be included in both the UserInfo endpoint response and the ID token.

### [Consent Screen](https://www.better-auth.com/docs/plugins/oidc-provider#consent-screen)

When a user is redirected to the OIDC provider for authentication, they may be prompted to authorize the application to access their data. This is known as the consent screen. By default, Better Auth will display a sample consent screen. You can customize the consent screen by providing a `consentPage` option during initialization.

**Note**: Trusted clients with `skipConsent: true` will bypass the consent screen entirely, providing a seamless experience for first-party applications.

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
    plugins: [oidcProvider({\
        consentPage: "/path/to/consent/page"\
    })]
})
```

The plugin will redirect the user to the specified path with `consent_code`, `client_id` and `scope` query parameters. You can use this information to display a custom consent screen. Once the user consents, you can call `oauth2.consent` to complete the authorization.

POST

/oauth2/consent

The consent endpoint supports two methods for passing the consent code:

**Method 1: URL Parameter**

consent-page.ts

```
// Get the consent code from the URL
const params = new URLSearchParams(window.location.search);

// Submit consent with the code in the request body
const consentCode = params.get('consent_code');
if (!consentCode) {
	throw new Error('Consent code not found in URL parameters');
}

const res = await client.oauth2.consent({
	accept: true, // or false to deny
	consent_code: consentCode,
});
```

**Method 2: Cookie-Based**

consent-page.ts

```
// The consent code is automatically stored in a signed cookie
// Just submit the consent decision
const res = await client.oauth2.consent({
	accept: true, // or false to deny
	// consent_code not needed when using cookie-based flow
});
```

Both methods are fully supported. The URL parameter method works well with mobile apps and third-party contexts, while the cookie-based method provides a simpler implementation for web applications.

### [Handling Login](https://www.better-auth.com/docs/plugins/oidc-provider#handling-login)

When a user is redirected to the OIDC provider for authentication, if they are not already logged in, they will be redirected to the login page. You can customize the login page by providing a `loginPage` option during initialization.

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
    plugins: [oidcProvider({\
        loginPage: "/sign-in"\
    })]
})
```

You don't need to handle anything from your side; when a new session is created, the plugin will handle continuing the authorization flow.

## [Configuration](https://www.better-auth.com/docs/plugins/oidc-provider#configuration)

### [OIDC Metadata](https://www.better-auth.com/docs/plugins/oidc-provider#oidc-metadata)

Customize the OIDC metadata by providing a configuration object during initialization.

auth.ts

```
import { betterAuth } from "better-auth";
import { oidcProvider } from "better-auth/plugins";

export const auth = betterAuth({
    plugins: [oidcProvider({\
        metadata: {\
            issuer: "https://your-domain.com",\
            authorization_endpoint: "/custom/oauth2/authorize",\
            token_endpoint: "/custom/oauth2/token",\
            // ...other custom metadata\
        }\
    })]
})
```

### [JWKS Endpoint](https://www.better-auth.com/docs/plugins/oidc-provider#jwks-endpoint)

The OIDC Provider plugin can integrate with the JWT plugin to provide asymmetric key signing for ID tokens verifiable at a JWKS endpoint.

To make your plugin OIDC compliant, you **MUST** disable the `/token` endpoint, the OAuth equivalent is located at `/oauth2/token` instead.

auth.ts

```
import { betterAuth } from "better-auth";
import { oidcProvider } from "better-auth/plugins";
import { jwt } from "better-auth/plugins";

export const auth = betterAuth({
    disabledPaths: [\
        "/token",\
    ],
    plugins: [\
        jwt(), // Make sure to add the JWT plugin\
        oidcProvider({\
            useJWTPlugin: true, // Enable JWT plugin integration\
            loginPage: "/sign-in",\
            // ... other options\
        })\
    ]
})
```

When `useJWTPlugin: false` (default), ID tokens are signed with the application secret.

### [Dynamic Client Registration](https://www.better-auth.com/docs/plugins/oidc-provider#dynamic-client-registration)

If you want to allow clients to register dynamically, you can enable this feature by setting the `allowDynamicClientRegistration` option to `true`.

auth.ts

```
const auth = betterAuth({
    plugins: [oidcProvider({\
        allowDynamicClientRegistration: true,\
    })]
})
```

This will allow clients to register using the `/register` endpoint to be publicly available.

## [Schema](https://www.better-auth.com/docs/plugins/oidc-provider#schema)

The OIDC Provider plugin adds the following tables to the database:

### [OAuth Application](https://www.better-auth.com/docs/plugins/oidc-provider#oauth-application)

Table Name: `oauthApplication`

| Field Name   | Type    | Key | Description                                                              |
| ------------ | ------- | --- | ------------------------------------------------------------------------ |
| id           | string  | PK  | Database ID of the OAuth client                                          |
| clientId     | string  | PK  | Unique identifier for each OAuth client                                  |
| clientSecret | string  | ?   | Secret key for the OAuth client. Optional for public clients using PKCE. |
| name         | string  | -   | Name of the OAuth client                                                 |
| redirectURLs | string  | -   | Comma-separated list of redirect URLs                                    |
| metadata     | string  | ?   | Additional metadata for the OAuth client                                 |
| type         | string  | -   | Type of OAuth client (e.g., web, mobile)                                 |
| disabled     | boolean | -   | Indicates if the client is disabled                                      |
| userId       | string  | ?   | ID of the user who owns the client. (optional)                           |
| createdAt    | Date    | -   | Timestamp of when the OAuth client was created                           |
| updatedAt    | Date    | -   | Timestamp of when the OAuth client was last updated                      |

### [OAuth Access Token](https://www.better-auth.com/docs/plugins/oidc-provider#oauth-access-token)

Table Name: `oauthAccessToken`

| Field Name            | Type   | Key | Description                                         |
| --------------------- | ------ | --- | --------------------------------------------------- |
| id                    | string | PK  | Database ID of the access token                     |
| accessToken           | string | -   | Access token issued to the client                   |
| refreshToken          | string | -   | Refresh token issued to the client                  |
| accessTokenExpiresAt  | Date   | -   | Expiration date of the access token                 |
| refreshTokenExpiresAt | Date   | -   | Expiration date of the refresh token                |
| clientId              | string | FK  | ID of the OAuth client                              |
| userId                | string | FK  | ID of the user associated with the token            |
| scopes                | string | -   | Comma-separated list of scopes granted              |
| createdAt             | Date   | -   | Timestamp of when the access token was created      |
| updatedAt             | Date   | -   | Timestamp of when the access token was last updated |

### [OAuth Consent](https://www.better-auth.com/docs/plugins/oidc-provider#oauth-consent)

Table Name: `oauthConsent`

| Field Name   | Type    | Key | Description                                    |
| ------------ | ------- | --- | ---------------------------------------------- |
| id           | string  | PK  | Database ID of the consent                     |
| userId       | string  | FK  | ID of the user who gave consent                |
| clientId     | string  | FK  | ID of the OAuth client                         |
| scopes       | string  | -   | Comma-separated list of scopes consented to    |
| consentGiven | boolean | -   | Indicates if consent was given                 |
| createdAt    | Date    | -   | Timestamp of when the consent was given        |
| updatedAt    | Date    | -   | Timestamp of when the consent was last updated |

## [Options](https://www.better-auth.com/docs/plugins/oidc-provider#options)

**allowDynamicClientRegistration**: `boolean` \- Enable or disable dynamic client registration.

**metadata**: `OIDCMetadata` \- Customize the OIDC provider metadata.

**loginPage**: `string` \- Path to the custom login page.

**consentPage**: `string` \- Path to the custom consent page.

**trustedClients**: `(Client & { skipConsent?: boolean })[]` \- Array of trusted clients that are configured directly in the provider options. These clients bypass database lookups and can optionally skip consent screens.

**getAdditionalUserInfoClaim**: `(user: User, scopes: string[], client: Client) => Record<string, any>` \- Function to get additional user info claims.

**useJWTPlugin**: `boolean` \- When `true`, ID tokens are signed using the JWT plugin's asymmetric keys. When `false` (default), ID tokens are signed with HMAC-SHA256 using the application secret.

**schema**: `AuthPluginSchema` \- Customize the OIDC provider schema.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/oidc-provider.mdx)

[Previous Page\\
\\
Enterprise](https://www.better-auth.com/docs/plugins/oidc-provider) [Next Page\\
\\
SSO](https://www.better-auth.com/docs/plugins/sso)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/oidc-provider#installation) [Mount the Plugin](https://www.better-auth.com/docs/plugins/oidc-provider#mount-the-plugin) [Migrate the Database](https://www.better-auth.com/docs/plugins/oidc-provider#migrate-the-database) [Add the Client Plugin](https://www.better-auth.com/docs/plugins/oidc-provider#add-the-client-plugin) [Usage](https://www.better-auth.com/docs/plugins/oidc-provider#usage) [Register a New Client](https://www.better-auth.com/docs/plugins/oidc-provider#register-a-new-client) [Simple Example](https://www.better-auth.com/docs/plugins/oidc-provider#simple-example) [Full Method](https://www.better-auth.com/docs/plugins/oidc-provider#full-method) [Trusted Clients](https://www.better-auth.com/docs/plugins/oidc-provider#trusted-clients) [UserInfo Endpoint](https://www.better-auth.com/docs/plugins/oidc-provider#userinfo-endpoint) [Consent Screen](https://www.better-auth.com/docs/plugins/oidc-provider#consent-screen) [Handling Login](https://www.better-auth.com/docs/plugins/oidc-provider#handling-login) [Configuration](https://www.better-auth.com/docs/plugins/oidc-provider#configuration) [OIDC Metadata](https://www.better-auth.com/docs/plugins/oidc-provider#oidc-metadata) [JWKS Endpoint](https://www.better-auth.com/docs/plugins/oidc-provider#jwks-endpoint) [Dynamic Client Registration](https://www.better-auth.com/docs/plugins/oidc-provider#dynamic-client-registration) [Schema](https://www.better-auth.com/docs/plugins/oidc-provider#schema) [OAuth Application](https://www.better-auth.com/docs/plugins/oidc-provider#oauth-application) [OAuth Access Token](https://www.better-auth.com/docs/plugins/oidc-provider#oauth-access-token) [OAuth Consent](https://www.better-auth.com/docs/plugins/oidc-provider#oauth-consent) [Options](https://www.better-auth.com/docs/plugins/oidc-provider#options)
