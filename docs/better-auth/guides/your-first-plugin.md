---
title: Create your first plugin | Better Auth
url: 
description: A step-by-step guide to creating your first Better Auth plugin.
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

# Create your first plugin

Copy MarkdownOpen in

In this guide, we’ll walk you through the steps of creating your first Better Auth plugin.

This guide assumes you have [setup the basics](https://www.better-auth.com/docs/installation) of Better Auth and are ready to create your first plugin.

## [Plan your idea](https://www.better-auth.com/docs/guides/your-first-plugin\#plan-your-idea)

Before beginning, you must know what plugin you intend to create.

In this guide, we’ll create a **birthday plugin** to keep track of user birth dates.

## [Server plugin first](https://www.better-auth.com/docs/guides/your-first-plugin\#server-plugin-first)

Better Auth plugins operate as a pair: a [server plugin](https://www.better-auth.com/docs/concepts/plugins#create-a-server-plugin) and a [client plugin](https://www.better-auth.com/docs/concepts/plugins#create-a-client-plugin).
The server plugin forms the foundation of your authentication system, while the client plugin provides convenient frontend APIs to interact with your server implementation.

You can read more about server/client plugins in our [documentation](https://www.better-auth.com/docs/concepts/plugins#creating-a-plugin).

### [Creating the server plugin](https://www.better-auth.com/docs/guides/your-first-plugin\#creating-the-server-plugin)

Go ahead and find a suitable location to create your birthday plugin folder, with an `index.ts` file within.

birthday-plugin

index.ts

In the `index.ts` file, we’ll export a function that represents our server plugin.
This will be what we will later add to our plugin list in the `auth.ts` file.

index.ts

```
import { createAuthClient } from "better-auth/client";
import type { BetterAuthPlugin } from "better-auth";

export const birthdayPlugin = () =>
  ({
    id: "birthdayPlugin",
  } satisfies BetterAuthPlugin);
```

Although this does nothing, you have technically just made yourself your first plugin, congratulations! 🎉

### [Defining a schema](https://www.better-auth.com/docs/guides/your-first-plugin\#defining-a-schema)

In order to save each user’s birthday data, we must create a schema on top of the `user` model.

By creating a schema here, this also allows [Better Auth’s CLI](https://www.better-auth.com/docs/concepts/cli) to generate the schemas required to update your database.

You can learn more about [plugin schemas here](https://www.better-auth.com/docs/concepts/plugins#schema).

index.ts

```
//...
export const birthdayPlugin = () =>
  ({
    id: "birthdayPlugin",
    schema: {
      user: {
        fields: {
          birthday: {
            type: "date", // string, number, boolean, date
            required: true, // if the field should be required on a new record. (default: false)
            unique: false, // if the field should be unique. (default: false)
            references: null // if the field is a reference to another table. (default: null)
          },
        },
      },
    },
  } satisfies BetterAuthPlugin);
```

### [Authorization logic](https://www.better-auth.com/docs/guides/your-first-plugin\#authorization-logic)

For this example guide, we’ll set up authentication logic to check and ensure that the user who signs-up is older than 5.
But the same concept could be applied for something like verifying users agreeing to the TOS or anything alike.

To do this, we’ll utilize [Hooks](https://www.better-auth.com/docs/concepts/plugins#hooks), which allows us to run code `before` or `after` an action is performed.

index.ts

```
export const birthdayPlugin = () => ({
    //...
    // In our case, we want to write authorization logic,
    // meaning we want to intercept it `before` hand.
    hooks: {
      before: [\
        {\
          matcher: (context) => /* ... */,\
          handler: createAuthMiddleware(async (ctx) => {\
            //...\
          }),\
        },\
      ],
    },
} satisfies BetterAuthPlugin)
```

In our case we want to match any requests going to the signup path:

Before hook

```
{
  matcher: (context) => context.path.startsWith("/sign-up/email"),
  //...
}
```

And for our logic, we’ll write the following code to check the if user’s birthday makes them above 5 years old.

Imports

```
import { APIError } from "better-auth/api";
import { createAuthMiddleware } from "better-auth/plugins";
```

Before hook

```
{
  //...
  handler: createAuthMiddleware(async (ctx) => {
    const { birthday } = ctx.body;
    if(!(birthday instanceof Date)) {
      throw new APIError("BAD_REQUEST", { message: "Birthday must be of type Date." });
    }

    const today = new Date();
    const fiveYearsAgo = new Date(today.setFullYear(today.getFullYear() - 5));

    if(birthday >= fiveYearsAgo) {
      throw new APIError("BAD_REQUEST", { message: "User must be above 5 years old." });
    }

    return { context: ctx };
  }),
}
```

**Authorized!** 🔒

We’ve now successfully written code to ensure authorization for users above 5!

## [Client Plugin](https://www.better-auth.com/docs/guides/your-first-plugin\#client-plugin)

We’re close to the finish line! 🏁

Now that we have created our server plugin, the next step is to develop our client plugin.
Since there isn’t much frontend APIs going on for this plugin, there isn’t much to do!

First, let’s create our `client.ts` file first:

birthday-plugin

index.ts

client.ts

Then, add the following code:

client.ts

```
import { BetterAuthClientPlugin } from "better-auth";
import type { birthdayPlugin } from "./index"; // make sure to import the server plugin as a type

type BirthdayPlugin = typeof birthdayPlugin;

export const birthdayClientPlugin = () => {
  return {
    id: "birthdayPlugin",
    $InferServerPlugin: {} as ReturnType<BirthdayPlugin>,
  } satisfies BetterAuthClientPlugin;
};
```

What we’ve done is allow the client plugin to infer the types defined by our schema from the server plugin.

And that’s it! This is all it takes for the birthday client plugin. 🎂

## [Initiate your plugin!](https://www.better-auth.com/docs/guides/your-first-plugin\#initiate-your-plugin)

Both the `client` and `server` plugins are now ready, the last step is to import them to both your `auth-client.ts` and your `server.ts` files respectively to initiate the plugin.

### [Server initiation](https://www.better-auth.com/docs/guides/your-first-plugin\#server-initiation)

server.ts

```
import { betterAuth } from "better-auth";
import { birthdayPlugin } from "./birthday-plugin";

export const auth = betterAuth({
    plugins: [\
      birthdayPlugin(),\
    ]
});
```

### [Client initiation](https://www.better-auth.com/docs/guides/your-first-plugin\#client-initiation)

auth-client.ts

```
import { createAuthClient } from "better-auth/client";
import { birthdayClientPlugin } from "./birthday-plugin/client";

const authClient = createAuthClient({
    plugins: [\
      birthdayClientPlugin()\
    ]
});
```

### [Oh yeah, the schemas!](https://www.better-auth.com/docs/guides/your-first-plugin\#oh-yeah-the-schemas)

Don’t forget to add your `birthday` field to your `user` table model!

Or, use the `generate` [CLI command](https://www.better-auth.com/docs/concepts/cli#generate):

```
npx @better-auth/cli@latest generate
```

## [Wrapping Up](https://www.better-auth.com/docs/guides/your-first-plugin\#wrapping-up)

Congratulations! You’ve successfully created your first ever Better Auth plugin.
We highly recommend you visit our [plugins documentation](https://www.better-auth.com/docs/concepts/plugins) to learn more information.

If you have a plugin you’d like to share with the community, feel free to let us know through
our [Discord server](https://discord.gg/better-auth),
or through a [pull-request](https://github.com/better-auth/better-auth/pulls)
and we may add it to the [community-plugins](https://www.better-auth.com/docs/plugins/community-plugins) list!

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/your-first-plugin.mdx)

[Previous Page\\
\\
Auth0 Migration Guide](https://www.better-auth.com/docs/guides/auth0-migration-guide) [Next Page\\
\\
Create a Database Adapter](https://www.better-auth.com/docs/guides/create-a-db-adapter)

### On this page

[Plan your idea](https://www.better-auth.com/docs/guides/your-first-plugin#plan-your-idea) [Server plugin first](https://www.better-auth.com/docs/guides/your-first-plugin#server-plugin-first) [Creating the server plugin](https://www.better-auth.com/docs/guides/your-first-plugin#creating-the-server-plugin) [Defining a schema](https://www.better-auth.com/docs/guides/your-first-plugin#defining-a-schema) [Authorization logic](https://www.better-auth.com/docs/guides/your-first-plugin#authorization-logic) [Client Plugin](https://www.better-auth.com/docs/guides/your-first-plugin#client-plugin) [Initiate your plugin!](https://www.better-auth.com/docs/guides/your-first-plugin#initiate-your-plugin) [Server initiation](https://www.better-auth.com/docs/guides/your-first-plugin#server-initiation) [Client initiation](https://www.better-auth.com/docs/guides/your-first-plugin#client-initiation) [Oh yeah, the schemas!](https://www.better-auth.com/docs/guides/your-first-plugin#oh-yeah-the-schemas) [Wrapping Up](https://www.better-auth.com/docs/guides/your-first-plugin#wrapping-up)