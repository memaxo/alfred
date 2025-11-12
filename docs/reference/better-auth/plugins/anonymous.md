---
title: Anonymous | Better Auth
url: 
description: Anonymous plugin for Better Auth.
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

# Anonymous

Copy MarkdownOpen in

The Anonymous plugin allows users to have an authenticated experience without requiring them to provide an email address, password, OAuth provider, or any other Personally Identifiable Information (PII). Users can later link an authentication method to their account when ready.

## [Installation](https://www.better-auth.com/docs/plugins/anonymous\#installation)

### [Add the plugin to your auth config](https://www.better-auth.com/docs/plugins/anonymous\#add-the-plugin-to-your-auth-config)

To enable anonymous authentication, add the anonymous plugin to your authentication configuration.

auth.ts

```
import { betterAuth } from "better-auth"
import { anonymous } from "better-auth/plugins"

export const auth = betterAuth({
    // ... other config options
    plugins: [\
        anonymous()\
    ]
})
```

### [Migrate the database](https://www.better-auth.com/docs/plugins/anonymous\#migrate-the-database)

Run the migration or generate the schema to add the necessary fields and tables to the database.

migrategenerate

```
npx @better-auth/cli migrate
```

```
npx @better-auth/cli generate
```

See the [Schema](https://www.better-auth.com/docs/plugins/anonymous#schema) section to add the fields manually.

### [Add the client plugin](https://www.better-auth.com/docs/plugins/anonymous\#add-the-client-plugin)

Next, include the anonymous client plugin in your authentication client instance.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { anonymousClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [\
        anonymousClient()\
    ]
})
```

## [Usage](https://www.better-auth.com/docs/plugins/anonymous\#usage)

### [Sign In](https://www.better-auth.com/docs/plugins/anonymous\#sign-in)

To sign in a user anonymously, use the `signIn.anonymous()` method.

example.ts

```
const user = await authClient.signIn.anonymous()
```

### [Link Account](https://www.better-auth.com/docs/plugins/anonymous\#link-account)

If a user is already signed in anonymously and tries to `signIn` or `signUp` with another method, their anonymous activities can be linked to the new account.

To do that you first need to provide `onLinkAccount` callback to the plugin.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    plugins: [\
        anonymous({\
            onLinkAccount: async ({ anonymousUser, newUser }) => {\
               // perform actions like moving the cart items from anonymous user to the new user\
            }\
        })\
    ]
```

Then when you call `signIn` or `signUp` with another method, the `onLinkAccount` callback will be called. And the `anonymousUser` will be deleted by default.

example.ts

```
const user = await authClient.signIn.email({
    email,
})
```

## [Options](https://www.better-auth.com/docs/plugins/anonymous\#options)

- `emailDomainName`: The domain name to use when generating an email address for anonymous users. Defaults to the domain name of the current site.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    plugins: [\
        anonymous({\
            emailDomainName: "example.com"\
        })\
    ]
})
```

- `onLinkAccount`: A callback function that is called when an anonymous user links their account to a new authentication method. The callback receives an object with the `anonymousUser` and the `newUser`.

- `disableDeleteAnonymousUser`: By default, the anonymous user is deleted when the account is linked to a new authentication method. Set this option to `true` to disable this behavior.

- `generateName`: A callback function that is called to generate a name for the anonymous user. Useful if you want to have random names for anonymous users, or if `name` is unique in your database.


## [Schema](https://www.better-auth.com/docs/plugins/anonymous\#schema)

The anonymous plugin requires an additional field in the user table:

| Field Name | Type | Key | Description |
| --- | --- | --- | --- |
| isAnonymous | boolean | ? | Indicates whether the user is anonymous. |

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/anonymous.mdx)

[Previous Page\\
\\
Username](https://www.better-auth.com/docs/plugins/username) [Next Page\\
\\
Phone Number](https://www.better-auth.com/docs/plugins/phone-number)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/anonymous#installation) [Add the plugin to your auth config](https://www.better-auth.com/docs/plugins/anonymous#add-the-plugin-to-your-auth-config) [Migrate the database](https://www.better-auth.com/docs/plugins/anonymous#migrate-the-database) [Add the client plugin](https://www.better-auth.com/docs/plugins/anonymous#add-the-client-plugin) [Usage](https://www.better-auth.com/docs/plugins/anonymous#usage) [Sign In](https://www.better-auth.com/docs/plugins/anonymous#sign-in) [Link Account](https://www.better-auth.com/docs/plugins/anonymous#link-account) [Options](https://www.better-auth.com/docs/plugins/anonymous#options) [Schema](https://www.better-auth.com/docs/plugins/anonymous#schema)