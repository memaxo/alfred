---
title: Single Sign-On (SSO) | Better Auth
url:
description: Integrate Single Sign-On (SSO) with your application.
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

# Single Sign-On (SSO)

Copy MarkdownOpen in

`OIDC` `OAuth2` `SSO` `SAML`

Single Sign-On (SSO) allows users to authenticate with multiple applications using a single set of credentials. This plugin supports OpenID Connect (OIDC), OAuth2 providers, and SAML 2.0.

This plugin is in active development and may not be suitable for production use. Please report any issues or bugs on [GitHub](https://github.com/better-auth/better-auth) and any security concerns on [security@better-auth.com](mailto:security@better-auth.com).

## [Installation](https://www.better-auth.com/docs/plugins/sso#installation)

### [Install the plugin](https://www.better-auth.com/docs/plugins/sso#install-the-plugin)

```
npm install @better-auth/sso
```

### [Add Plugin to the server](https://www.better-auth.com/docs/plugins/sso#add-plugin-to-the-server)

auth.ts

```
import { betterAuth } from "better-auth"
import { sso } from "@better-auth/sso";

const auth = betterAuth({
    plugins: [\
        sso()\
    ]
})
```

### [Migrate the database](https://www.better-auth.com/docs/plugins/sso#migrate-the-database)

Run the migration or generate the schema to add the necessary fields and tables to the database.

migrategenerate

```
npx @better-auth/cli migrate
```

```
npx @better-auth/cli generate
```

See the [Schema](https://www.better-auth.com/docs/plugins/sso#schema) section to add the fields manually.

### [Add the client plugin](https://www.better-auth.com/docs/plugins/sso#add-the-client-plugin)

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { ssoClient } from "@better-auth/sso/client"

const authClient = createAuthClient({
    plugins: [\
        ssoClient()\
    ]
})
```

## [Usage](https://www.better-auth.com/docs/plugins/sso#usage)

### [Register an OIDC Provider](https://www.better-auth.com/docs/plugins/sso#register-an-oidc-provider)

To register an OIDC provider, use the `registerSSOProvider` endpoint and provide the necessary configuration details for the provider.

A redirect URL will be automatically generated using the provider ID. For instance, if the provider ID is `hydra`, the redirect URL would be `{baseURL}/api/auth/sso/callback/hydra`. Note that `/api/auth` may vary depending on your base path configuration.

#### [Example](https://www.better-auth.com/docs/plugins/sso#example)

clientserver

register-oidc-provider.ts

```
import { authClient } from "@/lib/auth-client";

// Register with OIDC configuration
await authClient.sso.register({
    providerId: "example-provider",
    issuer: "https://idp.example.com",
    domain: "example.com",
    oidcConfig: {
        clientId: "client-id",
        clientSecret: "client-secret",
        authorizationEndpoint: "https://idp.example.com/authorize",
        tokenEndpoint: "https://idp.example.com/token",
        jwksEndpoint: "https://idp.example.com/jwks",
        discoveryEndpoint: "https://idp.example.com/.well-known/openid-configuration",
        scopes: ["openid", "email", "profile"],
        pkce: true,
    },
    mapping: {
        id: "sub",
        email: "email",
        emailVerified: "email_verified",
        name: "name",
        image: "picture",
    },
});
```

register-oidc-provider.ts

```
const { headers } = await signInWithTestUser();
await auth.api.registerSSOProvider({
    body: {
        providerId: "example-provider",
        issuer: "https://idp.example.com",
        domain: "example.com",
        oidcConfig: {
            clientId: "your-client-id",
            clientSecret: "your-client-secret",
            authorizationEndpoint: "https://idp.example.com/authorize",
            tokenEndpoint: "https://idp.example.com/token",
            jwksEndpoint: "https://idp.example.com/jwks",
            discoveryEndpoint: "https://idp.example.com/.well-known/openid-configuration",
            scopes: ["openid", "email", "profile"],
            pkce: true,
        },
        mapping: {
            id: "sub",
            email: "email",
            emailVerified: "email_verified",
            name: "name",
            image: "picture",
        },
    },
    headers,
});
```

### [Register a SAML Provider](https://www.better-auth.com/docs/plugins/sso#register-a-saml-provider)

To register a SAML provider, use the `registerSSOProvider` endpoint with SAML configuration details. The provider will act as a Service Provider (SP) and integrate with your Identity Provider (IdP).

clientserver

register-saml-provider.ts

```
import { authClient } from "@/lib/auth-client";

await authClient.sso.register({
    providerId: "saml-provider",
    issuer: "https://idp.example.com",
    domain: "example.com",
    samlConfig: {
        entryPoint: "https://idp.example.com/sso",
        cert: "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
        callbackUrl: "https://yourapp.com/api/auth/sso/saml2/callback/saml-provider",
        audience: "https://yourapp.com",
        wantAssertionsSigned: true,
        signatureAlgorithm: "sha256",
        digestAlgorithm: "sha256",
        identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        idpMetadata: {
            metadata: "<!-- IdP Metadata XML -->",
            privateKey: "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
            privateKeyPass: "your-private-key-password",
            isAssertionEncrypted: true,
            encPrivateKey: "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
            encPrivateKeyPass: "your-encryption-key-password"
        },
        spMetadata: {
            metadata: "<!-- SP Metadata XML -->",
            binding: "post",
            privateKey: "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
            privateKeyPass: "your-sp-private-key-password",
            isAssertionEncrypted: true,
            encPrivateKey: "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
            encPrivateKeyPass: "your-sp-encryption-key-password"
        }
    },
    mapping: {
        id: "nameID",
        email: "email",
        name: "displayName",
        firstName: "givenName",
        lastName: "surname",
        extraFields: {
            department: "department",
            role: "role"
        }
    },
});
```

register-saml-provider.ts

```
const { headers } = await signInWithTestUser();
await auth.api.registerSSOProvider({
    body: {
        providerId: "saml-provider",
        issuer: "https://idp.example.com",
        domain: "example.com",
        samlConfig: {
            entryPoint: "https://idp.example.com/sso",
            cert: "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
            callbackUrl: "https://yourapp.com/api/auth/sso/saml2/callback/saml-provider",
            audience: "https://yourapp.com",
            wantAssertionsSigned: true,
            signatureAlgorithm: "sha256",
            digestAlgorithm: "sha256",
            identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
            idpMetadata: {
                metadata: "<!-- IdP Metadata XML -->",
                privateKey: "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
                privateKeyPass: "your-private-key-password",
                isAssertionEncrypted: true,
                encPrivateKey: "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
                encPrivateKeyPass: "your-encryption-key-password"
            },
            spMetadata: {
                metadata: "<!-- SP Metadata XML -->",
                binding: "post",
                privateKey: "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
                privateKeyPass: "your-sp-private-key-password",
                isAssertionEncrypted: true,
                encPrivateKey: "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
                encPrivateKeyPass: "your-sp-encryption-key-password"
            }
        },
        mapping: {
            id: "nameID",
            email: "email",
            name: "displayName",
            firstName: "givenName",
            lastName: "surname",
            extraFields: {
                department: "department",
                role: "role"
            }
        },
    },
    headers,
});
```

### [Get Service Provider Metadata](https://www.better-auth.com/docs/plugins/sso#get-service-provider-metadata)

For SAML providers, you can retrieve the Service Provider metadata XML that needs to be configured in your Identity Provider:

get-sp-metadata.ts

```
const response = await auth.api.spMetadata({
    query: {
        providerId: "saml-provider",
        format: "xml" // or "json"
    }
});

const metadataXML = await response.text();
console.log(metadataXML);
```

### [Sign In with SSO](https://www.better-auth.com/docs/plugins/sso#sign-in-with-sso)

To sign in with an SSO provider, you can call `signIn.sso`

You can sign in using the email with domain matching:

sign-in.ts

```
const res = await authClient.signIn.sso({
    email: "user@example.com",
    callbackURL: "/dashboard",
});
```

or you can specify the domain:

sign-in-domain.ts

```
const res = await authClient.signIn.sso({
    domain: "example.com",
    callbackURL: "/dashboard",
});
```

You can also sign in using the organization slug if a provider is associated with an organization:

sign-in-org.ts

```
const res = await authClient.signIn.sso({
    organizationSlug: "example-org",
    callbackURL: "/dashboard",
});
```

Alternatively, you can sign in using the provider's ID:

sign-in-provider-id.ts

```
const res = await authClient.signIn.sso({
    providerId: "example-provider-id",
    callbackURL: "/dashboard",
});
```

To use the server API you can use `signInSSO`

sign-in-org.ts

```
const res = await auth.api.signInSSO({
    body: {
        organizationSlug: "example-org",
        callbackURL: "/dashboard",
    }
});
```

#### [Full method](https://www.better-auth.com/docs/plugins/sso#full-method)

ClientServer

POST

/sign-in/sso

```
const { data, error } = await authClient.signIn.sso({
    email: "john@example.com",
    organizationSlug: "example-org",
    providerId: "example-provider",
    domain: "example.com",
    callbackURL: "https://example.com/callback", // required
    errorCallbackURL: "https://example.com/callback",
    newUserCallbackURL: "https://example.com/new-user",
    scopes: ["openid", "email", "profile", "offline_access"],
    requestSignUp: true,
});
```

| Prop                  | Description                                                                                                                      | Type       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `email?`              | The email address to sign in with. This is used to identify the issuer to sign in with. It's optional if the issuer is provided. | `string`   |
| `organizationSlug?`   | The slug of the organization to sign in with.                                                                                    | `string`   |
| `providerId?`         | The ID of the provider to sign in with. This can be provided instead of email or issuer.                                         | `string`   |
| `domain?`             | The domain of the provider.                                                                                                      | `string`   |
| `callbackURL`         | The URL to redirect to after login.                                                                                              | `string`   |
| `errorCallbackURL?`   | The URL to redirect to after login.                                                                                              | `string`   |
| `newUserCallbackURL?` | The URL to redirect to after login if the user is new.                                                                           | `string`   |
| `scopes?`             | Scopes to request from the provider.                                                                                             | `string[]` |
| `requestSignUp?`      | Explicitly request sign-up. Useful when disableImplicitSignUp is true for this provider.                                         | `boolean`  |

POST

/sign-in/sso

```
const data = await auth.api.signInSSO({
    body: {
        email: "john@example.com",
        organizationSlug: "example-org",
        providerId: "example-provider",
        domain: "example.com",
        callbackURL: "https://example.com/callback", // required
        errorCallbackURL: "https://example.com/callback",
        newUserCallbackURL: "https://example.com/new-user",
        scopes: ["openid", "email", "profile", "offline_access"],
        requestSignUp: true,
    },
});
```

| Prop                  | Description                                                                                                                      | Type       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `email?`              | The email address to sign in with. This is used to identify the issuer to sign in with. It's optional if the issuer is provided. | `string`   |
| `organizationSlug?`   | The slug of the organization to sign in with.                                                                                    | `string`   |
| `providerId?`         | The ID of the provider to sign in with. This can be provided instead of email or issuer.                                         | `string`   |
| `domain?`             | The domain of the provider.                                                                                                      | `string`   |
| `callbackURL`         | The URL to redirect to after login.                                                                                              | `string`   |
| `errorCallbackURL?`   | The URL to redirect to after login.                                                                                              | `string`   |
| `newUserCallbackURL?` | The URL to redirect to after login if the user is new.                                                                           | `string`   |
| `scopes?`             | Scopes to request from the provider.                                                                                             | `string[]` |
| `requestSignUp?`      | Explicitly request sign-up. Useful when disableImplicitSignUp is true for this provider.                                         | `boolean`  |

When a user is authenticated, if the user does not exist, the user will be provisioned using the `provisionUser` function. If the organization provisioning is enabled and a provider is associated with an organization, the user will be added to the organization.

auth.ts

```
const auth = betterAuth({
    plugins: [\
        sso({\
            provisionUser: async (user) => {\
                // provision user\
            },\
            organizationProvisioning: {\
                disabled: false,\
                defaultRole: "member",\
                getRole: async (user) => {\
                    // get role if needed\
                },\
            },\
        }),\
    ],
});
```

## [Provisioning](https://www.better-auth.com/docs/plugins/sso#provisioning)

The SSO plugin provides powerful provisioning capabilities to automatically set up users and manage their organization memberships when they sign in through SSO providers.

### [User Provisioning](https://www.better-auth.com/docs/plugins/sso#user-provisioning)

User provisioning allows you to run custom logic whenever a user signs in through an SSO provider. This is useful for:

- Setting up user profiles with additional data from the SSO provider
- Synchronizing user attributes with external systems
- Creating user-specific resources
- Logging SSO sign-ins
- Updating user information from the SSO provider

auth.ts

```
const auth = betterAuth({
    plugins: [\
        sso({\
            provisionUser: async ({ user, userInfo, token, provider }) => {\
                // Update user profile with SSO data\
                await updateUserProfile(user.id, {\
                    department: userInfo.attributes?.department,\
                    jobTitle: userInfo.attributes?.jobTitle,\
                    manager: userInfo.attributes?.manager,\
                    lastSSOLogin: new Date(),\
                });\
\
                // Create user-specific resources\
                await createUserWorkspace(user.id);\
\
                // Sync with external systems\
                await syncUserWithCRM(user.id, userInfo);\
\
                // Log the SSO sign-in\
                await auditLog.create({\
                    userId: user.id,\
                    action: 'sso_signin',\
                    provider: provider.providerId,\
                    metadata: {\
                        email: userInfo.email,\
                        ssoProvider: provider.issuer,\
                    },\
                });\
            },\
        }),\
    ],
});
```

The `provisionUser` function receives:

- **user**: The user object from the database
- **userInfo**: User information from the SSO provider (includes attributes, email, name, etc.)
- **token**: OAuth2 tokens (for OIDC providers) - may be undefined for SAML
- **provider**: The SSO provider configuration

### [Organization Provisioning](https://www.better-auth.com/docs/plugins/sso#organization-provisioning)

Organization provisioning automatically manages user memberships in organizations when SSO providers are linked to specific organizations. This is particularly useful for:

- Enterprise SSO where each company/domain maps to an organization
- Automatic role assignment based on SSO attributes
- Managing team memberships through SSO

#### [Basic Organization Provisioning](https://www.better-auth.com/docs/plugins/sso#basic-organization-provisioning)

auth.ts

```
const auth = betterAuth({
    plugins: [\
        sso({\
            organizationProvisioning: {\
                disabled: false,           // Enable org provisioning\
                defaultRole: "member",     // Default role for new members\
            },\
        }),\
    ],
});
```

#### [Advanced Organization Provisioning with Custom Roles](https://www.better-auth.com/docs/plugins/sso#advanced-organization-provisioning-with-custom-roles)

auth.ts

```
const auth = betterAuth({
    plugins: [\
        sso({\
            organizationProvisioning: {\
                disabled: false,\
                defaultRole: "member",\
                getRole: async ({ user, userInfo, provider }) => {\
                    // Assign roles based on SSO attributes\
                    const department = userInfo.attributes?.department;\
                    const jobTitle = userInfo.attributes?.jobTitle;\
\
                    // Admins based on job title\
                    if (jobTitle?.toLowerCase().includes('manager') ||\
                        jobTitle?.toLowerCase().includes('director') ||\
                        jobTitle?.toLowerCase().includes('vp')) {\
                        return "admin";\
                    }\
\
                    // Special roles for IT department\
                    if (department?.toLowerCase() === 'it') {\
                        return "admin";\
                    }\
\
                    // Default to member for everyone else\
                    return "member";\
                },\
            },\
        }),\
    ],
});
```

#### [Linking SSO Providers to Organizations](https://www.better-auth.com/docs/plugins/sso#linking-sso-providers-to-organizations)

When registering an SSO provider, you can link it to a specific organization:

register-org-provider.ts

```
await auth.api.registerSSOProvider({
    body: {
        providerId: "acme-corp-saml",
        issuer: "https://acme-corp.okta.com",
        domain: "acmecorp.com",
        organizationId: "org_acme_corp_id", // Link to organization
        samlConfig: {
            // SAML configuration...
        },
    },
    headers,
});
```

Now when users from `acmecorp.com` sign in through this provider, they'll automatically be added to the "Acme Corp" organization with the appropriate role.

#### [Multiple Organizations Example](https://www.better-auth.com/docs/plugins/sso#multiple-organizations-example)

You can set up multiple SSO providers for different organizations:

multi-org-setup.ts

```
// Acme Corp SAML provider
await auth.api.registerSSOProvider({
    body: {
        providerId: "acme-corp",
        issuer: "https://acme.okta.com",
        domain: "acmecorp.com",
        organizationId: "org_acme_id",
        samlConfig: { /* ... */ },
    },
    headers,
});

// TechStart OIDC provider
await auth.api.registerSSOProvider({
    body: {
        providerId: "techstart-google",
        issuer: "https://accounts.google.com",
        domain: "techstart.io",
        organizationId: "org_techstart_id",
        oidcConfig: { /* ... */ },
    },
    headers,
});
```

#### [Organization Provisioning Flow](https://www.better-auth.com/docs/plugins/sso#organization-provisioning-flow)

1. **User signs in** through an SSO provider linked to an organization
2. **User is authenticated** and either found or created in the database
3. **Organization membership is checked** \- if the user isn't already a member of the linked organization
4. **Role is determined** using either the `defaultRole` or `getRole` function
5. **User is added** to the organization with the determined role
6. **User provisioning runs** (if configured) for additional setup

### [Provisioning Best Practices](https://www.better-auth.com/docs/plugins/sso#provisioning-best-practices)

#### [1\. Idempotent Operations](https://www.better-auth.com/docs/plugins/sso#1-idempotent-operations)

Make sure your provisioning functions can be safely run multiple times:

```
provisionUser: async ({ user, userInfo }) => {
    // Check if already provisioned
    const existingProfile = await getUserProfile(user.id);
    if (!existingProfile.ssoProvisioned) {
        await createUserResources(user.id);
        await markAsProvisioned(user.id);
    }

    // Always update attributes (they might change)
    await updateUserAttributes(user.id, userInfo.attributes);
},
```

#### [2\. Error Handling](https://www.better-auth.com/docs/plugins/sso#2-error-handling)

Handle errors gracefully to avoid blocking user sign-in:

```
provisionUser: async ({ user, userInfo }) => {
    try {
        await syncWithExternalSystem(user, userInfo);
    } catch (error) {
        // Log error but don't throw - user can still sign in
        console.error('Failed to sync user with external system:', error);
        await logProvisioningError(user.id, error);
    }
},
```

#### [3\. Conditional Provisioning](https://www.better-auth.com/docs/plugins/sso#3-conditional-provisioning)

Only run certain provisioning steps when needed:

```
organizationProvisioning: {
    disabled: false,
    getRole: async ({ user, userInfo, provider }) => {
        // Only process role assignment for certain providers
        if (provider.providerId.includes('enterprise')) {
            return determineEnterpriseRole(userInfo);
        }
        return "member";
    },
},
```

## [SAML Configuration](https://www.better-auth.com/docs/plugins/sso#saml-configuration)

### [Service Provider Configuration](https://www.better-auth.com/docs/plugins/sso#service-provider-configuration)

When registering a SAML provider, you need to provide Service Provider (SP) metadata configuration:

- **metadata**: XML metadata for the Service Provider
- **binding**: The binding method, typically "post" or "redirect"
- **privateKey**: Private key for signing (optional)
- **privateKeyPass**: Password for the private key (if encrypted)
- **isAssertionEncrypted**: Whether assertions should be encrypted
- **encPrivateKey**: Private key for decryption (if encryption is enabled)
- **encPrivateKeyPass**: Password for the encryption private key

### [Identity Provider Configuration](https://www.better-auth.com/docs/plugins/sso#identity-provider-configuration)

You also need to provide Identity Provider (IdP) configuration:

- **metadata**: XML metadata from your Identity Provider
- **privateKey**: Private key for the IdP communication (optional)
- **privateKeyPass**: Password for the IdP private key (if encrypted)
- **isAssertionEncrypted**: Whether assertions from IdP are encrypted
- **encPrivateKey**: Private key for IdP assertion decryption
- **encPrivateKeyPass**: Password for the IdP decryption key

### [SAML Attribute Mapping](https://www.better-auth.com/docs/plugins/sso#saml-attribute-mapping)

Configure how SAML attributes map to user fields:

```
mapping: {
    id: "nameID",           // Default: "nameID"
    email: "email",         // Default: "email" or "nameID"
    name: "displayName",    // Default: "displayName"
    firstName: "givenName", // Default: "givenName"
    lastName: "surname",    // Default: "surname"
    extraFields: {
        department: "department",
        role: "jobTitle",
        phone: "telephoneNumber"
    }
}
```

### [SAML Endpoints](https://www.better-auth.com/docs/plugins/sso#saml-endpoints)

The plugin automatically creates the following SAML endpoints:

- **SP Metadata**: `/api/auth/sso/saml2/sp/metadata?providerId={providerId}`
- **SAML Callback**: `/api/auth/sso/saml2/callback/{providerId}`

## [Schema](https://www.better-auth.com/docs/plugins/sso#schema)

The plugin requires additional fields in the `ssoProvider` table to store the provider's configuration.

| Field Name     | Type   | Key | Description                                                                  |
| -------------- | ------ | --- | ---------------------------------------------------------------------------- |
| id             | string | PK  | A database identifier                                                        |
| issuer         | string | -   | The issuer identifier                                                        |
| domain         | string | -   | The domain of the provider                                                   |
| oidcConfig     | string | -   | The OIDC configuration (JSON string)                                         |
| samlConfig     | string | -   | The SAML configuration (JSON string)                                         |
| userId         | string | -   | The user ID                                                                  |
| providerId     | string | -   | The provider ID. Used to identify a provider and to generate a redirect URL. |
| organizationId | string | -   | The organization Id. If provider is linked to an organization.               |

## [Options](https://www.better-auth.com/docs/plugins/sso#options)

### [Server](https://www.better-auth.com/docs/plugins/sso#server)

**provisionUser**: A custom function to provision a user when they sign in with an SSO provider.

**organizationProvisioning**: Options for provisioning users to an organization.

**defaultOverrideUserInfo**: Override user info with the provider info by default.

**disableImplicitSignUp**: Disable implicit sign up for new users.

**trustEmailVerified**: Trust the email verified flag from the provider.

| Prop                        | Type       | Default   |
| --------------------------- | ---------- | --------- | ---- |
| `provisionUser?`            | `function` | -         |
| `organizationProvisioning?` | `object`   | -         |
| `defaultOverrideUserInfo?`  | `boolean`  | -         |
| `disableImplicitSignUp?`    | `boolean`  | -         |
| `providersLimit?`           | `number    | function` | `10` |

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/sso.mdx)

[Previous Page\\
\\
OIDC Provider](https://www.better-auth.com/docs/plugins/oidc-provider) [Next Page\\
\\
Utility](https://www.better-auth.com/docs/plugins/sso)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/sso#installation) [Install the plugin](https://www.better-auth.com/docs/plugins/sso#install-the-plugin) [Add Plugin to the server](https://www.better-auth.com/docs/plugins/sso#add-plugin-to-the-server) [Migrate the database](https://www.better-auth.com/docs/plugins/sso#migrate-the-database) [Add the client plugin](https://www.better-auth.com/docs/plugins/sso#add-the-client-plugin) [Usage](https://www.better-auth.com/docs/plugins/sso#usage) [Register an OIDC Provider](https://www.better-auth.com/docs/plugins/sso#register-an-oidc-provider) [Example](https://www.better-auth.com/docs/plugins/sso#example) [Register a SAML Provider](https://www.better-auth.com/docs/plugins/sso#register-a-saml-provider) [Get Service Provider Metadata](https://www.better-auth.com/docs/plugins/sso#get-service-provider-metadata) [Sign In with SSO](https://www.better-auth.com/docs/plugins/sso#sign-in-with-sso) [Full method](https://www.better-auth.com/docs/plugins/sso#full-method) [Provisioning](https://www.better-auth.com/docs/plugins/sso#provisioning) [User Provisioning](https://www.better-auth.com/docs/plugins/sso#user-provisioning) [Organization Provisioning](https://www.better-auth.com/docs/plugins/sso#organization-provisioning) [Basic Organization Provisioning](https://www.better-auth.com/docs/plugins/sso#basic-organization-provisioning) [Advanced Organization Provisioning with Custom Roles](https://www.better-auth.com/docs/plugins/sso#advanced-organization-provisioning-with-custom-roles) [Linking SSO Providers to Organizations](https://www.better-auth.com/docs/plugins/sso#linking-sso-providers-to-organizations) [Multiple Organizations Example](https://www.better-auth.com/docs/plugins/sso#multiple-organizations-example) [Organization Provisioning Flow](https://www.better-auth.com/docs/plugins/sso#organization-provisioning-flow) [Provisioning Best Practices](https://www.better-auth.com/docs/plugins/sso#provisioning-best-practices) [1\. Idempotent Operations](https://www.better-auth.com/docs/plugins/sso#1-idempotent-operations) [2\. Error Handling](https://www.better-auth.com/docs/plugins/sso#2-error-handling) [3\. Conditional Provisioning](https://www.better-auth.com/docs/plugins/sso#3-conditional-provisioning) [SAML Configuration](https://www.better-auth.com/docs/plugins/sso#saml-configuration) [Service Provider Configuration](https://www.better-auth.com/docs/plugins/sso#service-provider-configuration) [Identity Provider Configuration](https://www.better-auth.com/docs/plugins/sso#identity-provider-configuration) [SAML Attribute Mapping](https://www.better-auth.com/docs/plugins/sso#saml-attribute-mapping) [SAML Endpoints](https://www.better-auth.com/docs/plugins/sso#saml-endpoints) [Schema](https://www.better-auth.com/docs/plugins/sso#schema) [Options](https://www.better-auth.com/docs/plugins/sso#options) [Server](https://www.better-auth.com/docs/plugins/sso#server)
