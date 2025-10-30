---
title: API Key | Better Auth
url: 
description: API Key plugin for Better Auth.
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

# API Key

Copy MarkdownOpen in

The API Key plugin allows you to create and manage API keys for your application. It provides a way to authenticate and authorize API requests by verifying API keys.

## [Features](https://www.better-auth.com/docs/plugins/api-key\#features)

- Create, manage, and verify API keys
- [Built-in rate limiting](https://www.better-auth.com/docs/plugins/api-key#rate-limiting)
- [Custom expiration times, remaining count, and refill systems](https://www.better-auth.com/docs/plugins/api-key#remaining-refill-and-expiration)
- [metadata for API keys](https://www.better-auth.com/docs/plugins/api-key#metadata)
- Custom prefix
- [Sessions from API keys](https://www.better-auth.com/docs/plugins/api-key#sessions-from-api-keys)

## [Installation](https://www.better-auth.com/docs/plugins/api-key\#installation)

### [Add Plugin to the server](https://www.better-auth.com/docs/plugins/api-key\#add-plugin-to-the-server)

auth.ts

```
import { betterAuth } from "better-auth"
import { apiKey } from "better-auth/plugins"

export const auth = betterAuth({
    plugins: [\
        apiKey()\
    ]
})
```

### [Migrate the database](https://www.better-auth.com/docs/plugins/api-key\#migrate-the-database)

Run the migration or generate the schema to add the necessary fields and tables to the database.

migrategenerate

```
npx @better-auth/cli migrate
```

```
npx @better-auth/cli generate
```

See the [Schema](https://www.better-auth.com/docs/plugins/api-key#schema) section to add the fields manually.

### [Add the client plugin](https://www.better-auth.com/docs/plugins/api-key\#add-the-client-plugin)

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { apiKeyClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [\
        apiKeyClient()\
    ]
})
```

## [Usage](https://www.better-auth.com/docs/plugins/api-key\#usage)

You can view the list of API Key plugin options [here](https://www.better-auth.com/docs/plugins/api-key#api-key-plugin-options).

### [Create an API key](https://www.better-auth.com/docs/plugins/api-key\#create-an-api-key)

ClientServer

POST

/api-key/create

Notes

You can adjust more specific API key configurations by using the server method instead.

```
const { data, error } = await authClient.apiKey.create({
    name: 'project-api-key',
    expiresIn: 60 * 60 * 24 * 7,
    prefix: 'project-api-key',
    metadata: { someKey: 'someValue' },
    permissions,
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `name?` | Name of the Api Key. | `string` |
| `expiresIn?` | Expiration time of the Api Key in seconds. | `number` |
| `prefix?` | Prefix of the Api Key. | `string` |
| `metadata?` | Metadata of the Api Key. | `any | null` |
| `permissions?` | Permissions of the Api Key. | `Record<string, string[]>` |

POST

/api-key/create

Notes

If you're creating an API key on the server, without access to headers, you must pass the `userId` property. This is the ID of the user that the API key is associated with.

```
const data = await auth.api.createApiKey({
    body: {
        name: 'project-api-key',
        expiresIn: 60 * 60 * 24 * 7,
        userId: "user-id", // server-only
        prefix: 'project-api-key',
        remaining: 100, // server-only
        metadata: { someKey: 'someValue' },
        refillAmount: 100, // server-only
        refillInterval: 1000, // server-only
        rateLimitTimeWindow: 1000, // server-only
        rateLimitMax: 100, // server-only
        rateLimitEnabled: true, // server-only
        permissions,
    },
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `name?` | Name of the Api Key. | `string` |
| `expiresIn?` | Expiration time of the Api Key in seconds. | `number` |
| `userId?`(server-only) | User Id of the user that the Api Key belongs to. server-only. | `string` |
| `prefix?` | Prefix of the Api Key. | `string` |
| `remaining?`(server-only) | Remaining number of requests. server-only. | `number` |
| `metadata?` | Metadata of the Api Key. | `any | null` |
| `refillAmount?`(server-only) | Amount to refill the remaining count of the Api Key. server-only. | `number` |
| `refillInterval?`(server-only) | Interval to refill the Api Key in milliseconds. server-only. | `number` |
| `rateLimitTimeWindow?`(server-only) | The duration in milliseconds where each request is counted. Once the `maxRequests` is reached, the request will be rejected until the `timeWindow` has passed, at which point the `timeWindow` will be reset. server-only. | `number` |
| `rateLimitMax?`(server-only) | Maximum amount of requests allowed within a window. Once the `maxRequests` is reached, the request will be rejected until the `timeWindow` has passed, at which point the `timeWindow` will be reset. server-only. | `number` |
| `rateLimitEnabled?`(server-only) | Whether the key has rate limiting enabled. server-only. | `boolean` |
| `permissions?` | Permissions of the Api Key. | `Record<string, string[]>` |

API keys are assigned to a user.

#### [Result](https://www.better-auth.com/docs/plugins/api-key\#result)

It'll return the `ApiKey` object which includes the `key` value for you to use.
Otherwise if it throws, it will throw an `APIError`.

* * *

### [Verify an API key](https://www.better-auth.com/docs/plugins/api-key\#verify-an-api-key)

ClientServer

```
const permissions = { // Permissions to check are optional.
  projects: ["read", "read-write"],
}

const { data, error } = await authClient.apiKey.verify({
    key: "your_api_key_here", // required
    permissions,
});
```

This is a server-only endpoint

POST

/api-key/verify

```
const permissions = { // Permissions to check are optional.
  projects: ["read", "read-write"],
}

const data = await auth.api.verifyApiKey({
    body: {
        key: "your_api_key_here", // required
        permissions,
    },
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `key` | The key to verify. | `string` |
| `permissions?` | The permissions to verify. Optional. | `Record<string, string[]>` |

#### [Result](https://www.better-auth.com/docs/plugins/api-key\#result-1)

```
type Result = {
  valid: boolean;
  error: { message: string; code: string } | null;
  key: Omit<ApiKey, "key"> | null;
};
```

* * *

### [Get an API key](https://www.better-auth.com/docs/plugins/api-key\#get-an-api-key)

ClientServer

GET

/api-key/get

```
const { data, error } = await authClient.apiKey.get({
    id: "some-api-key-id", // required
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `id` | The id of the Api Key. | `string` |

GET

/api-key/get

```
const data = await auth.api.getApiKey({
    query: {
        id: "some-api-key-id", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `id` | The id of the Api Key. | `string` |

#### [Result](https://www.better-auth.com/docs/plugins/api-key\#result-2)

You'll receive everything about the API key details, except for the `key` value itself.
If it fails, it will throw an `APIError`.

```
type Result = Omit<ApiKey, "key">;
```

* * *

### [Update an API key](https://www.better-auth.com/docs/plugins/api-key\#update-an-api-key)

ClientServer

POST

/api-key/update

```
const { data, error } = await authClient.apiKey.update({
    keyId: "some-api-key-id", // required
    name: "some-api-key-name",
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `keyId` | The id of the Api Key to update. | `string` |
| `name?` | The name of the key. | `string` |

POST

/api-key/update

```
const data = await auth.api.updateApiKey({
    body: {
        keyId: "some-api-key-id", // required
        userId: "some-user-id", // server-only
        name: "some-api-key-name",
        enabled: true, // server-only
        remaining: 100, // server-only
        refillAmount: 100, // server-only
        refillInterval: 1000, // server-only
        metadata: { "key": "value" }, // server-only
        expiresIn: 60 * 60 * 24 * 7, // server-only
        rateLimitEnabled: true, // server-only
        rateLimitTimeWindow: 1000, // server-only
        rateLimitMax: 100, // server-only
        permissions, // server-only
    },
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `keyId` | The id of the Api Key to update. | `string` |
| `userId?`(server-only) | The id of the user which the api key belongs to. server-only. | `string` |
| `name?` | The name of the key. | `string` |
| `enabled?`(server-only) | Whether the Api Key is enabled or not. server-only. | `boolean` |
| `remaining?`(server-only) | The number of remaining requests. server-only. | `number` |
| `refillAmount?`(server-only) | The refill amount. server-only. | `number` |
| `refillInterval?`(server-only) | The refill interval in milliseconds. server-only. | `number` |
| `metadata?`(server-only) | The metadata of the Api Key. server-only. | `any | null` |
| `expiresIn?`(server-only) | Expiration time of the Api Key in seconds. server-only. | `number` |
| `rateLimitEnabled?`(server-only) | Whether the key has rate limiting enabled. server-only. | `boolean` |
| `rateLimitTimeWindow?`(server-only) | The duration in milliseconds where each request is counted. server-only. | `number` |
| `rateLimitMax?`(server-only) | Maximum amount of requests allowed within a window. Once the `maxRequests` is reached, the request will be rejected until the `timeWindow` has passed, at which point the `timeWindow` will be reset. server-only. | `number` |
| `permissions?`(server-only) | Update the permissions on the API Key. server-only. | `Record<string, string[]>` |

#### [Result](https://www.better-auth.com/docs/plugins/api-key\#result-3)

If fails, throws `APIError`.
Otherwise, you'll receive the API Key details, except for the `key` value itself.

* * *

### [Delete an API Key](https://www.better-auth.com/docs/plugins/api-key\#delete-an-api-key)

ClientServer

POST

/api-key/delete

Notes

This endpoint is attempting to delete the API key from the perspective of the user. It will check if the user's ID matches the key owner to be able to delete it. If you want to delete a key without these checks, we recommend you use an ORM to directly mutate your DB instead.

```
const { data, error } = await authClient.apiKey.delete({
    keyId: "some-api-key-id", // required
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `keyId` | The id of the Api Key to delete. | `string` |

POST

/api-key/delete

Notes

This endpoint is attempting to delete the API key from the perspective of the user. It will check if the user's ID matches the key owner to be able to delete it. If you want to delete a key without these checks, we recommend you use an ORM to directly mutate your DB instead.

```
const data = await auth.api.deleteApiKey({
    body: {
        keyId: "some-api-key-id", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

| Prop | Description | Type |
| --- | --- | --- |
| `keyId` | The id of the Api Key to delete. | `string` |

#### [Result](https://www.better-auth.com/docs/plugins/api-key\#result-4)

If fails, throws `APIError`.
Otherwise, you'll receive:

```
type Result = {
  success: boolean;
};
```

* * *

### [List API keys](https://www.better-auth.com/docs/plugins/api-key\#list-api-keys)

ClientServer

GET

/api-key/list

```
const { data, error } = await authClient.apiKey.list();
```

GET

/api-key/list

```
const data = await auth.api.listApiKeys({
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

#### [Result](https://www.better-auth.com/docs/plugins/api-key\#result-5)

If fails, throws `APIError`.
Otherwise, you'll receive:

```
type Result = ApiKey[];
```

* * *

### [Delete all expired API keys](https://www.better-auth.com/docs/plugins/api-key\#delete-all-expired-api-keys)

This function will delete all API keys that have an expired expiration date.

ClientServer

```
const { data, error } = await authClient.apiKey.deleteAllExpiredApiKeys();
```

This is a server-only endpoint

POST

/api-key/delete-all-expired-api-keys

```
const data = await auth.api.deleteAllExpiredApiKeys();
```

We automatically delete expired API keys every time any apiKey plugin
endpoints were called, however they are rate-limited to a 10 second cool down
each call to prevent multiple calls to the database.

* * *

## [Sessions from API keys](https://www.better-auth.com/docs/plugins/api-key\#sessions-from-api-keys)

Any time an endpoint in Better Auth is called that has a valid API key in the headers, we will automatically create a mock session to represent the user.

Server

```
const session = await auth.api.getSession({
      headers: new Headers({
            'x-api-key': apiKey,
      }),
});
```

The default header key is `x-api-key`, but this can be changed by setting the `apiKeyHeaders` option in the plugin options.

```
export const auth = betterAuth({
  plugins: [\
    apiKey({\
      apiKeyHeaders: ["x-api-key", "xyz-api-key"], // or you can pass just a string, eg: "x-api-key"\
    }),\
  ],
});
```

Or optionally, you can pass an `apiKeyGetter` function to the plugin options, which will be called with the `GenericEndpointContext`, and from there, you should return the API key, or `null` if the request is invalid.

```
export const auth = betterAuth({
  plugins: [\
    apiKey({\
      apiKeyGetter: (ctx) => {\
        const has = ctx.request.headers.has("x-api-key");\
        if (!has) return null;\
        return ctx.request.headers.get("x-api-key");\
      },\
    }),\
  ],
});
```

## [Rate Limiting](https://www.better-auth.com/docs/plugins/api-key\#rate-limiting)

Every API key can have its own rate limit settings, however, the built-in rate-limiting only applies to the verification process for a given API key.
For every other endpoint/method, you should utilize Better Auth's [built-in rate-limiting](https://www.better-auth.com/docs/concepts/rate-limit).

You can refer to the rate-limit default configurations below in the API Key plugin options.

An example default value:

```
export const auth = betterAuth({
  plugins: [\
    apiKey({\
      rateLimit: {\
        enabled: true,\
        timeWindow: 1000 * 60 * 60 * 24, // 1 day\
        maxRequests: 10, // 10 requests per day\
      },\
    }),\
  ],
});
```

For each API key, you can customize the rate-limit options on create.

You can only customize the rate-limit options on the server auth instance.

```
const apiKey = await auth.api.createApiKey({
  body: {
    rateLimitEnabled: true,
    rateLimitTimeWindow: 1000 * 60 * 60 * 24, // 1 day
    rateLimitMax: 10, // 10 requests per day
  },
  headers: user_headers,
});
```

### [How does it work?](https://www.better-auth.com/docs/plugins/api-key\#how-does-it-work)

For each request, a counter (internally called `requestCount`) is incremented.

If the `rateLimitMax` is reached, the request will be rejected until the `timeWindow` has passed, at which point the `timeWindow` will be reset.

## [Remaining, refill, and expiration](https://www.better-auth.com/docs/plugins/api-key\#remaining-refill-and-expiration)

The remaining count is the number of requests left before the API key is disabled.

The refill interval is the interval in milliseconds where the `remaining` count is refilled by day.

The expiration time is the expiration date of the API key.

### [How does it work?](https://www.better-auth.com/docs/plugins/api-key\#how-does-it-work-1)

#### [Remaining:](https://www.better-auth.com/docs/plugins/api-key\#remaining)

Whenever an API key is used, the `remaining` count is updated.

If the `remaining` count is `null`, then there is no cap to key usage.

Otherwise, the `remaining` count is decremented by 1.

If the `remaining` count is 0, then the API key is disabled & removed.

#### [refillInterval & refillAmount:](https://www.better-auth.com/docs/plugins/api-key\#refillinterval--refillamount)

Whenever an API key is created, the `refillInterval` and `refillAmount` are set to `null`.

This means that the API key will not be refilled automatically.

However, if `refillInterval` & `refillAmount` are set, then the API key will be refilled accordingly.

#### [Expiration:](https://www.better-auth.com/docs/plugins/api-key\#expiration)

Whenever an API key is created, the `expiresAt` is set to `null`.

This means that the API key will never expire.

However, if the `expiresIn` is set, then the API key will expire after the `expiresIn` time.

## [Custom Key generation & verification](https://www.better-auth.com/docs/plugins/api-key\#custom-key-generation--verification)

You can customize the key generation and verification process straight from the plugin options.

Here's an example:

```
export const auth = betterAuth({
  plugins: [\
    apiKey({\
      customKeyGenerator: (options: {\
        length: number;\
        prefix: string | undefined;\
      }) => {\
        const apiKey = mySuperSecretApiKeyGenerator(\
          options.length,\
          options.prefix\
        );\
        return apiKey;\
      },\
      customAPIKeyValidator: async ({ ctx, key }) => {\
        const res = await keyService.verify(key)\
        return res.valid\
      },\
    }),\
  ],
});
```

If you're **not** using the `length` property provided by `customKeyGenerator`, you **must** set the `defaultKeyLength` property to how long generated keys will be.

```
export const auth = betterAuth({
  plugins: [\
    apiKey({\
      customKeyGenerator: () => {\
        return crypto.randomUUID();\
      },\
      defaultKeyLength: 36, // Or whatever the length is\
    }),\
  ],
});
```

If an API key is validated from your `customAPIKeyValidator`, we still must match that against the database's key.
However, by providing this custom function, you can improve the performance of the API key verification process,
as all failed keys can be invalidated without having to query your database.

## [Metadata](https://www.better-auth.com/docs/plugins/api-key\#metadata)

We allow you to store metadata alongside your API keys. This is useful for storing information about the key, such as a subscription plan for example.

To store metadata, make sure you haven't disabled the metadata feature in the plugin options.

```
export const auth = betterAuth({
  plugins: [\
    apiKey({\
      enableMetadata: true,\
    }),\
  ],
});
```

Then, you can store metadata in the `metadata` field of the API key object.

```
const apiKey = await auth.api.createApiKey({
  body: {
    metadata: {
      plan: "premium",
    },
  },
});
```

You can then retrieve the metadata from the API key object.

```
const apiKey = await auth.api.getApiKey({
  body: {
    keyId: "your_api_key_id_here",
  },
});

console.log(apiKey.metadata.plan); // "premium"
```

## [API Key plugin options](https://www.better-auth.com/docs/plugins/api-key\#api-key-plugin-options)

`apiKeyHeaders` `string | string[];`

The header name to check for API key. Default is `x-api-key`.

`customAPIKeyGetter``(ctx: GenericEndpointContext) => string | null`

A custom function to get the API key from the context.

`customAPIKeyValidator``(options: { ctx: GenericEndpointContext; key: string; }) => boolean | Promise<boolean>`

A custom function to validate the API key.

`customKeyGenerator``(options: { length: number; prefix: string | undefined; }) => string | Promise<string>`

A custom function to generate the API key.

`startingCharactersConfig``{ shouldStore?: boolean; charactersLength?: number; }`

Customize the starting characters configuration.

### startingCharactersConfig Options

`defaultKeyLength` `number`

The length of the API key. Longer is better. Default is 64. (Doesn't include the prefix length)

`defaultPrefix` `string`

The prefix of the API key.

Note: We recommend you append an underscore to the prefix to make the prefix more identifiable. (eg `hello_`)

`maximumPrefixLength` `number`

The maximum length of the prefix.

`minimumPrefixLength` `number`

The minimum length of the prefix.

`requireName` `boolean`

Whether to require a name for the API key. Default is `false`.

`maximumNameLength` `number`

The maximum length of the name.

`minimumNameLength` `number`

The minimum length of the name.

`enableMetadata` `boolean`

Whether to enable metadata for an API key.

`keyExpiration``{ defaultExpiresIn?: number | null; disableCustomExpiresTime?: boolean; minExpiresIn?: number; maxExpiresIn?: number; }`

Customize the key expiration.

### keyExpiration options

`rateLimit``{ enabled?: boolean; timeWindow?: number; maxRequests?: number; }`

Customize the rate-limiting.

### rateLimit options

`schema` `InferOptionSchema<ReturnType<typeof apiKeySchema>>`

Custom schema for the API key plugin.

`disableSessionForAPIKeys` `boolean`

An API Key can represent a valid session, so we automatically mock a session for the user if we find a valid API key in the request headers.

`permissions``{ defaultPermissions?: Statements | ((userId: string, ctx: GenericEndpointContext) => Statements | Promise<Statements>) }`

Permissions for the API key.

Read more about permissions [here](https://www.better-auth.com/docs/plugins/api-key#permissions).

### permissions Options

`disableKeyHashing` `boolean`

Disable hashing of the API key.

⚠️ Security Warning: It's strongly recommended to not disable hashing.
Storing API keys in plaintext makes them vulnerable to database breaches, potentially exposing all your users' API keys.

* * *

## [Permissions](https://www.better-auth.com/docs/plugins/api-key\#permissions)

API keys can have permissions associated with them, allowing you to control access at a granular level. Permissions are structured as a record of resource types to arrays of allowed actions.

### [Setting Default Permissions](https://www.better-auth.com/docs/plugins/api-key\#setting-default-permissions)

You can configure default permissions that will be applied to all newly created API keys:

```
export const auth = betterAuth({
  plugins: [\
    apiKey({\
      permissions: {\
        defaultPermissions: {\
          files: ["read"],\
          users: ["read"],\
        },\
      },\
    }),\
  ],
});
```

You can also provide a function that returns permissions dynamically:

```
export const auth = betterAuth({
  plugins: [\
    apiKey({\
      permissions: {\
        defaultPermissions: async (userId, ctx) => {\
          // Fetch user role or other data to determine permissions\
          return {\
            files: ["read"],\
            users: ["read"],\
          };\
        },\
      },\
    }),\
  ],
});
```

### [Creating API Keys with Permissions](https://www.better-auth.com/docs/plugins/api-key\#creating-api-keys-with-permissions)

When creating an API key, you can specify custom permissions:

```
const apiKey = await auth.api.createApiKey({
  body: {
    name: "My API Key",
    permissions: {
      files: ["read", "write"],
      users: ["read"],
    },
    userId: "userId",
  },
});
```

### [Verifying API Keys with Required Permissions](https://www.better-auth.com/docs/plugins/api-key\#verifying-api-keys-with-required-permissions)

When verifying an API key, you can check if it has the required permissions:

```
const result = await auth.api.verifyApiKey({
  body: {
    key: "your_api_key_here",
    permissions: {
      files: ["read"],
    },
  },
});

if (result.valid) {
  // API key is valid and has the required permissions
} else {
  // API key is invalid or doesn't have the required permissions
}
```

### [Updating API Key Permissions](https://www.better-auth.com/docs/plugins/api-key\#updating-api-key-permissions)

You can update the permissions of an existing API key:

```
const apiKey = await auth.api.updateApiKey({
  body: {
    keyId: existingApiKeyId,
    permissions: {
      files: ["read", "write", "delete"],
      users: ["read", "write"],
    },
  },
  headers: user_headers,
});
```

### [Permissions Structure](https://www.better-auth.com/docs/plugins/api-key\#permissions-structure)

Permissions follow a resource-based structure:

```
type Permissions = {
  [resourceType: string]: string[];
};

// Example:
const permissions = {
  files: ["read", "write", "delete"],
  users: ["read"],
  projects: ["read", "write"],
};
```

When verifying an API key, all required permissions must be present in the API key's permissions for validation to succeed.

## [Schema](https://www.better-auth.com/docs/plugins/api-key\#schema)

Table: `apiKey`

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| id | string | PK | The ID of the API key. |
| name | string | ? | The name of the API key. |
| start | string | ? | The starting characters of the API key. Useful for showing the first few characters of the API key in the UI for the users to easily identify. |
| prefix | string | ? | The API Key prefix. Stored as plain text. |
| key | string | - | The hashed API key itself. |
| userId | string | FK | The ID of the user associated with the API key. |
| refillInterval | number | ? | The interval to refill the key in milliseconds. |
| refillAmount | number | ? | The amount to refill the remaining count of the key. |
| lastRefillAt | Date | ? | The date and time when the key was last refilled. |
| enabled | boolean | - | Whether the API key is enabled. |
| rateLimitEnabled | boolean | - | Whether the API key has rate limiting enabled. |
| rateLimitTimeWindow | number | ? | The time window in milliseconds for the rate limit. |
| rateLimitMax | number | ? | The maximum number of requests allowed within the \`rateLimitTimeWindow\`. |
| requestCount | number | - | The number of requests made within the rate limit time window. |
| remaining | number | ? | The number of requests remaining. |
| lastRequest | Date | ? | The date and time of the last request made to the key. |
| expiresAt | Date | ? | The date and time when the key will expire. |
| createdAt | Date | - | The date and time the API key was created. |
| updatedAt | Date | - | The date and time the API key was updated. |
| permissions | string | ? | The permissions of the key. |
| metadata | Object | ? | Any additional metadata you want to store with the key. |

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/api-key.mdx)

[Previous Page\\
\\
Admin](https://www.better-auth.com/docs/plugins/admin) [Next Page\\
\\
MCP](https://www.better-auth.com/docs/plugins/mcp)

### On this page

[Features](https://www.better-auth.com/docs/plugins/api-key#features) [Installation](https://www.better-auth.com/docs/plugins/api-key#installation) [Add Plugin to the server](https://www.better-auth.com/docs/plugins/api-key#add-plugin-to-the-server) [Migrate the database](https://www.better-auth.com/docs/plugins/api-key#migrate-the-database) [Add the client plugin](https://www.better-auth.com/docs/plugins/api-key#add-the-client-plugin) [Usage](https://www.better-auth.com/docs/plugins/api-key#usage) [Create an API key](https://www.better-auth.com/docs/plugins/api-key#create-an-api-key) [Result](https://www.better-auth.com/docs/plugins/api-key#result) [Verify an API key](https://www.better-auth.com/docs/plugins/api-key#verify-an-api-key) [Result](https://www.better-auth.com/docs/plugins/api-key#result-1) [Get an API key](https://www.better-auth.com/docs/plugins/api-key#get-an-api-key) [Result](https://www.better-auth.com/docs/plugins/api-key#result-2) [Update an API key](https://www.better-auth.com/docs/plugins/api-key#update-an-api-key) [Result](https://www.better-auth.com/docs/plugins/api-key#result-3) [Delete an API Key](https://www.better-auth.com/docs/plugins/api-key#delete-an-api-key) [Result](https://www.better-auth.com/docs/plugins/api-key#result-4) [List API keys](https://www.better-auth.com/docs/plugins/api-key#list-api-keys) [Result](https://www.better-auth.com/docs/plugins/api-key#result-5) [Delete all expired API keys](https://www.better-auth.com/docs/plugins/api-key#delete-all-expired-api-keys) [Sessions from API keys](https://www.better-auth.com/docs/plugins/api-key#sessions-from-api-keys) [Rate Limiting](https://www.better-auth.com/docs/plugins/api-key#rate-limiting) [How does it work?](https://www.better-auth.com/docs/plugins/api-key#how-does-it-work) [Remaining, refill, and expiration](https://www.better-auth.com/docs/plugins/api-key#remaining-refill-and-expiration) [How does it work?](https://www.better-auth.com/docs/plugins/api-key#how-does-it-work-1) [Remaining:](https://www.better-auth.com/docs/plugins/api-key#remaining) [refillInterval & refillAmount:](https://www.better-auth.com/docs/plugins/api-key#refillinterval--refillamount) [Expiration:](https://www.better-auth.com/docs/plugins/api-key#expiration) [Custom Key generation & verification](https://www.better-auth.com/docs/plugins/api-key#custom-key-generation--verification) [Metadata](https://www.better-auth.com/docs/plugins/api-key#metadata) [API Key plugin options](https://www.better-auth.com/docs/plugins/api-key#api-key-plugin-options) [Permissions](https://www.better-auth.com/docs/plugins/api-key#permissions) [Setting Default Permissions](https://www.better-auth.com/docs/plugins/api-key#setting-default-permissions) [Creating API Keys with Permissions](https://www.better-auth.com/docs/plugins/api-key#creating-api-keys-with-permissions) [Verifying API Keys with Required Permissions](https://www.better-auth.com/docs/plugins/api-key#verifying-api-keys-with-required-permissions) [Updating API Key Permissions](https://www.better-auth.com/docs/plugins/api-key#updating-api-key-permissions) [Permissions Structure](https://www.better-auth.com/docs/plugins/api-key#permissions-structure) [Schema](https://www.better-auth.com/docs/plugins/api-key#schema)