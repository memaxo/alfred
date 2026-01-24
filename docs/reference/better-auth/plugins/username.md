---
title: Username | Better Auth
url:
description: Username plugin
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

# Username

Copy MarkdownOpen in

The username plugin is a lightweight plugin that adds username support to the email and password authenticator. This allows users to sign in and sign up with their username instead of their email.

## [Installation](https://www.better-auth.com/docs/plugins/username#installation)

### [Add Plugin to the server](https://www.better-auth.com/docs/plugins/username#add-plugin-to-the-server)

auth.ts

```
import { betterAuth } from "better-auth"
import { username } from "better-auth/plugins"

export const auth = betterAuth({
    plugins: [\
        username()\
    ]
})
```

### [Migrate the database](https://www.better-auth.com/docs/plugins/username#migrate-the-database)

Run the migration or generate the schema to add the necessary fields and tables to the database.

migrategenerate

```
npx @better-auth/cli migrate
```

```
npx @better-auth/cli generate
```

See the [Schema](https://www.better-auth.com/docs/plugins/username#schema) section to add the fields manually.

### [Add the client plugin](https://www.better-auth.com/docs/plugins/username#add-the-client-plugin)

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { usernameClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [\
        usernameClient()\
    ]
})
```

## [Usage](https://www.better-auth.com/docs/plugins/username#usage)

### [Sign up](https://www.better-auth.com/docs/plugins/username#sign-up)

To sign up a user with username, you can use the existing `signUp.email` function provided by the client.
The `signUp` function should take a new `username` property in the object.

ClientServer

POST

/sign-up/email

```
const { data, error } = await authClient.signUp.email({
    email: "email@domain.com", // required
    name: "Test User", // required
    password: "password1234", // required
    username: "test", // required
    displayUsername: "Test User123",
});
```

| Prop               | Description                               | Type     |
| ------------------ | ----------------------------------------- | -------- |
| `email`            | The email of the user.                    | `string` |
| `name`             | The name of the user.                     | `string` |
| `password`         | The password of the user.                 | `string` |
| `username`         | The username of the user.                 | `string` |
| `displayUsername?` | An optional display username of the user. | `string` |

POST

/sign-up/email

```
const data = await auth.api.signUpEmail({
    body: {
        email: "email@domain.com", // required
        name: "Test User", // required
        password: "password1234", // required
        username: "test", // required
        displayUsername: "Test User123",
    },
});
```

| Prop               | Description                               | Type     |
| ------------------ | ----------------------------------------- | -------- |
| `email`            | The email of the user.                    | `string` |
| `name`             | The name of the user.                     | `string` |
| `password`         | The password of the user.                 | `string` |
| `username`         | The username of the user.                 | `string` |
| `displayUsername?` | An optional display username of the user. | `string` |

If only `username` is provided, the `displayUsername` will be set to the pre normalized version of the `username`. You can see the [Username Normalization](https://www.better-auth.com/docs/plugins/username#username-normalization) and [Display Username Normalization](https://www.better-auth.com/docs/plugins/username#display-username-normalization) sections for more details.

### [Sign in](https://www.better-auth.com/docs/plugins/username#sign-in)

To sign in a user with username, you can use the `signIn.username` function provided by the client.

ClientServer

POST

/sign-in/username

```
const { data, error } = await authClient.signIn.username({
    username: "test", // required
    password: "password1234", // required
});
```

| Prop       | Description               | Type     |
| ---------- | ------------------------- | -------- |
| `username` | The username of the user. | `string` |
| `password` | The password of the user. | `string` |

POST

/sign-in/username

```
const data = await auth.api.signInUsername({
    body: {
        username: "test", // required
        password: "password1234", // required
    },
});
```

| Prop       | Description               | Type     |
| ---------- | ------------------------- | -------- |
| `username` | The username of the user. | `string` |
| `password` | The password of the user. | `string` |

### [Update username](https://www.better-auth.com/docs/plugins/username#update-username)

To update the username of a user, you can use the `updateUser` function provided by the client.

ClientServer

POST

/update-user

```
const { data, error } = await authClient.updateUser({
    username: "new-username",
});
```

| Prop        | Description             | Type     |
| ----------- | ----------------------- | -------- |
| `username?` | The username to update. | `string` |

POST

/update-user

```
const data = await auth.api.updateUser({
    body: {
        username: "new-username",
    },
});
```

| Prop        | Description             | Type     |
| ----------- | ----------------------- | -------- |
| `username?` | The username to update. | `string` |

### [Check if username is available](https://www.better-auth.com/docs/plugins/username#check-if-username-is-available)

To check if a username is available, you can use the `isUsernameAvailable` function provided by the client.

ClientServer

POST

/is-username-available

```
const { data: response, error } = await authClient.isUsernameAvailable({
    username: "new-username", // required
});

if(response?.available) {
    console.log("Username is available");
} else {
    console.log("Username is not available");
}
```

| Prop       | Description            | Type     |
| ---------- | ---------------------- | -------- |
| `username` | The username to check. | `string` |

POST

/is-username-available

```
const response = await auth.api.isUsernameAvailable({
    body: {
        username: "new-username", // required
    },
});

if(response?.available) {
    console.log("Username is available");
} else {
    console.log("Username is not available");
}
```

| Prop       | Description            | Type     |
| ---------- | ---------------------- | -------- |
| `username` | The username to check. | `string` |

## [Options](https://www.better-auth.com/docs/plugins/username#options)

### [Min Username Length](https://www.better-auth.com/docs/plugins/username#min-username-length)

The minimum length of the username. Default is `3`.

auth.ts

```
import { betterAuth } from "better-auth"
import { username } from "better-auth/plugins"

const auth = betterAuth({
    plugins: [\
        username({\
            minUsernameLength: 5\
        })\
    ]
})
```

### [Max Username Length](https://www.better-auth.com/docs/plugins/username#max-username-length)

The maximum length of the username. Default is `30`.

auth.ts

```
import { betterAuth } from "better-auth"
import { username } from "better-auth/plugins"

const auth = betterAuth({
    plugins: [\
        username({\
            maxUsernameLength: 100\
        })\
    ]
})
```

### [Username Validator](https://www.better-auth.com/docs/plugins/username#username-validator)

A function that validates the username. The function should return false if the username is invalid. By default, the username should only contain alphanumeric characters, underscores, and dots.

auth.ts

```
import { betterAuth } from "better-auth"
import { username } from "better-auth/plugins"

const auth = betterAuth({
    plugins: [\
        username({\
            usernameValidator: (username) => {\
                if (username === "admin") {\
                    return false\
                }\
                return true\
            }\
        })\
    ]
})
```

### [Display Username Validator](https://www.better-auth.com/docs/plugins/username#display-username-validator)

A function that validates the display username. The function should return false if the display username is invalid. By default, no validation is applied to display username.

auth.ts

```
import { betterAuth } from "better-auth"
import { username } from "better-auth/plugins"

const auth = betterAuth({
    plugins: [\
        username({\
            displayUsernameValidator: (displayUsername) => {\
                // Allow only alphanumeric characters, underscores, and hyphens\
                return /^[a-zA-Z0-9_-]+$/.test(displayUsername)\
            }\
        })\
    ]
})
```

### [Username Normalization](https://www.better-auth.com/docs/plugins/username#username-normalization)

A function that normalizes the username, or `false` if you want to disable normalization.

By default, usernames are normalized to lowercase, so "TestUser" and "testuser", for example, are considered the same username. The `username` field will contain the normalized (lower case) username, while `displayUsername` will contain the original `username`.

auth.ts

```
import { betterAuth } from "better-auth"
import { username } from "better-auth/plugins"

const auth = betterAuth({
    plugins: [\
        username({\
            usernameNormalization: (username) => {\
                return username.toLowerCase()\
                    .replaceAll("0", "o")\
                    .replaceAll("3", "e")\
                    .replaceAll("4", "a");\
            }\
        })\
    ]
})
```

### [Display Username Normalization](https://www.better-auth.com/docs/plugins/username#display-username-normalization)

A function that normalizes the display username, or `false` to disable normalization.

By default, display usernames are not normalized. When only `username` is provided during signup or update, the `displayUsername` will be set to match the original `username` value (before normalization). You can also explicitly set a `displayUsername` which will be preserved as-is. For custom normalization, provide a function that takes the display username as input and returns the normalized version.

auth.ts

```
import { betterAuth } from "better-auth"
import { username } from "better-auth/plugins"

const auth = betterAuth({
    plugins: [\
        username({\
            displayUsernameNormalization: (displayUsername) => displayUsername.toLowerCase(),\
        })\
    ]
})
```

### [Validation Order](https://www.better-auth.com/docs/plugins/username#validation-order)

By default, username and display username are validated before normalization. You can change this behavior by setting `validationOrder` to `post-normalization`.

auth.ts

```
import { betterAuth } from "better-auth"
import { username } from "better-auth/plugins"

const auth = betterAuth({
    plugins: [\
        username({\
            validationOrder: {\
                username: "post-normalization",\
                displayUsername: "post-normalization",\
            }\
        })\
    ]
})
```

## [Schema](https://www.better-auth.com/docs/plugins/username#schema)

The plugin requires 2 fields to be added to the user table:

| Field Name      | Type   | Key | Description                         |
| --------------- | ------ | --- | ----------------------------------- |
| username        | string | -   | The username of the user            |
| displayUsername | string | -   | Non normalized username of the user |

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/username.mdx)

[Previous Page\\
\\
Two Factor](https://www.better-auth.com/docs/plugins/2fa) [Next Page\\
\\
Anonymous](https://www.better-auth.com/docs/plugins/anonymous)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/username#installation) [Add Plugin to the server](https://www.better-auth.com/docs/plugins/username#add-plugin-to-the-server) [Migrate the database](https://www.better-auth.com/docs/plugins/username#migrate-the-database) [Add the client plugin](https://www.better-auth.com/docs/plugins/username#add-the-client-plugin) [Usage](https://www.better-auth.com/docs/plugins/username#usage) [Sign up](https://www.better-auth.com/docs/plugins/username#sign-up) [Sign in](https://www.better-auth.com/docs/plugins/username#sign-in) [Update username](https://www.better-auth.com/docs/plugins/username#update-username) [Check if username is available](https://www.better-auth.com/docs/plugins/username#check-if-username-is-available) [Options](https://www.better-auth.com/docs/plugins/username#options) [Min Username Length](https://www.better-auth.com/docs/plugins/username#min-username-length) [Max Username Length](https://www.better-auth.com/docs/plugins/username#max-username-length) [Username Validator](https://www.better-auth.com/docs/plugins/username#username-validator) [Display Username Validator](https://www.better-auth.com/docs/plugins/username#display-username-validator) [Username Normalization](https://www.better-auth.com/docs/plugins/username#username-normalization) [Display Username Normalization](https://www.better-auth.com/docs/plugins/username#display-username-normalization) [Validation Order](https://www.better-auth.com/docs/plugins/username#validation-order) [Schema](https://www.better-auth.com/docs/plugins/username#schema)
