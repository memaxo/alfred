---
title: TypeScript | Better Auth
url: 
description: Better Auth TypeScript integration.
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

# TypeScript

Copy MarkdownOpen in

Better Auth is designed to be type-safe. Both the client and server are built with TypeScript, allowing you to easily infer types.

## [TypeScript Config](https://www.better-auth.com/docs/concepts/typescript\#typescript-config)

### [Strict Mode](https://www.better-auth.com/docs/concepts/typescript\#strict-mode)

Better Auth is designed to work with TypeScript's strict mode. We recommend enabling strict mode in your TypeScript config file:

tsconfig.json

```
{
  "compilerOptions": {
    "strict": true
  }
}
```

if you can't set `strict` to `true`, you can enable `strictNullChecks`:

tsconfig.json

```
{
  "compilerOptions": {
    "strictNullChecks": true,
  }
}
```

If you're running into issues with TypeScript inference exceeding maximum length the compiler will serialize,
then please make sure you're following the instructions above, as well as ensuring that both `declaration` and `composite` are not enabled.

## [Inferring Types](https://www.better-auth.com/docs/concepts/typescript\#inferring-types)

Both the client SDK and the server offer types that can be inferred using the `$Infer` property. Plugins can extend base types like `User` and `Session`, and you can use `$Infer` to infer these types. Additionally, plugins can provide extra types that can also be inferred through `$Infer`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"

const authClient = createAuthClient()

export type Session = typeof authClient.$Infer.Session
```

The `Session` type includes both `session` and `user` properties. The user property represents the user object type, and the `session` property represents the `session` object type.

You can also infer types on the server side.

auth.ts

```
import { betterAuth } from "better-auth"
import Database from "better-sqlite3"

export const auth = betterAuth({
    database: new Database("database.db")
})

type Session = typeof auth.$Infer.Session
```

## [Additional Fields](https://www.better-auth.com/docs/concepts/typescript\#additional-fields)

Better Auth allows you to add additional fields to the user and session objects. All additional fields are properly inferred and available on the server and client side.

```
import { betterAuth } from "better-auth"
import Database from "better-sqlite3"

export const auth = betterAuth({
    database: new Database("database.db"),
    user: {
       additionalFields: {
          role: {
              type: "string",
              input: false
            }
        }
    }

})

type Session = typeof auth.$Infer.Session
```

In the example above, we added a `role` field to the user object. This field is now available on the `Session` type.

### [The `input` property](https://www.better-auth.com/docs/concepts/typescript\#the-input-property)

The `input` property in an additional field configuration determines whether the field should be included in the user input. This property defaults to `true`, meaning the field will be part of the user input during operations like registration.

To prevent a field from being part of the user input, you must explicitly set `input: false`:

```
additionalFields: {
    role: {
        type: "string",
        input: false
    }
}
```

When `input` is set to `false`, the field will be excluded from user input, preventing users from passing a value for it.

By default, additional fields are included in the user input, which can lead to security vulnerabilities if not handled carefully. For fields that should not be set by the user, like a `role`, it is crucial to set `input: false` in the configuration.

### [Inferring Additional Fields on Client](https://www.better-auth.com/docs/concepts/typescript\#inferring-additional-fields-on-client)

To make sure proper type inference for additional fields on the client side, you need to inform the client about these fields. There are two approaches to achieve this, depending on your project structure:

1. For Monorepo or Single-Project Setups

If your server and client code reside in the same project, you can use the `inferAdditionalFields` plugin to automatically infer the additional fields from your server configuration.

```
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
```

2. For Separate Client-Server Projects

If your client and server are in separate projects, you'll need to manually specify the additional fields when creating the auth client.

```
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields({\
      user: {\
        role: {\
          type: "string"\
        }\
      }\
  })],
});
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/typescript.mdx)

[Previous Page\\
\\
Sessions](https://www.better-auth.com/docs/concepts/session-management) [Next Page\\
\\
Users & Accounts](https://www.better-auth.com/docs/concepts/users-accounts)

### On this page

[TypeScript Config](https://www.better-auth.com/docs/concepts/typescript#typescript-config) [Strict Mode](https://www.better-auth.com/docs/concepts/typescript#strict-mode) [Inferring Types](https://www.better-auth.com/docs/concepts/typescript#inferring-types) [Additional Fields](https://www.better-auth.com/docs/concepts/typescript#additional-fields) [The `input` property](https://www.better-auth.com/docs/concepts/typescript#the-input-property) [Inferring Additional Fields on Client](https://www.better-auth.com/docs/concepts/typescript#inferring-additional-fields-on-client)