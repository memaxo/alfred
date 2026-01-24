---
title: Plugins | Better Auth
url:
description: Learn how to use plugins with Better Auth.
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

# Plugins

Copy MarkdownOpen in

Plugins are a key part of Better Auth, they let you extend the base functionalities. You can use them to add new authentication methods, features, or customize behaviors.

Better Auth comes with many built-in plugins ready to use. Check the plugins section for details. You can also create your own plugins.

## [Using a Plugin](https://www.better-auth.com/docs/concepts/plugins#using-a-plugin)

Plugins can be a server-side plugin, a client-side plugin, or both.

To add a plugin on the server, include it in the `plugins` array in your auth configuration. The plugin will initialize with the provided options.

server.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
    plugins: [\
        // Add your plugins here\
    ]
});
```

Client plugins are added when creating the client. Most plugin require both server and client plugins to work correctly.
The Better Auth auth client on the frontend uses the `createAuthClient` function provided by `better-auth/client`.

auth-client.ts

```
import { createAuthClient } from "better-auth/client";

const authClient =  createAuthClient({
    plugins: [\
        // Add your client plugins here\
    ]
});
```

We recommend keeping the auth-client and your normal auth instance in separate files.

auth

server.ts

auth-client.ts

## [Creating a Plugin](https://www.better-auth.com/docs/concepts/plugins#creating-a-plugin)

To get started, you'll need a server plugin.
Server plugins are the backbone of all plugins, and client plugins are there to provide an interface with frontend APIs to easily work with your server plugins.

If your server plugins has endpoints that needs to be called from the client, you'll also need to create a client plugin.

### [What can a plugin do?](https://www.better-auth.com/docs/concepts/plugins#what-can-a-plugin-do)

- Create custom `endpoint` s to perform any action you want.
- Extend database tables with custom `schemas`.
- Use a `middleware` to target a group of routes using it's route matcher, and run only when those routes are called through a request.
- Use `hooks` to target a specific route or request. And if you want to run the hook even if the endpoint is called directly.
- Use `onRequest` or `onResponse` if you want to do something that affects all requests or responses.
- Create custom `rate-limit` rule.

## [Create a Server plugin](https://www.better-auth.com/docs/concepts/plugins#create-a-server-plugin)

To create a server plugin you need to pass an object that satisfies the `BetterAuthPlugin` interface.

The only required property is `id`, which is a unique identifier for the plugin.
Both server and client plugins can use the same `id`.

plugin.ts

```
import type { BetterAuthPlugin } from "better-auth";

export const myPlugin = ()=>{
    return {
        id: "my-plugin",
    } satisfies BetterAuthPlugin
}
```

You don't have to make the plugin a function, but it's recommended to do so. This way you can pass options to the plugin and it's consistent with the built-in plugins.

### [Endpoints](https://www.better-auth.com/docs/concepts/plugins#endpoints)

To add endpoints to the server, you can pass `endpoints` which requires an object with the key being any `string` and the value being an `AuthEndpoint`.

To create an Auth Endpoint you'll need to import `createAuthEndpoint` from `better-auth`.

Better Auth uses wraps around another library called [Better Call](https://github.com/bekacru/better-call) to create endpoints. Better call is a simple ts web framework made by the same team behind Better Auth.

plugin.ts

```
import { createAuthEndpoint } from "better-auth/api";

const myPlugin = ()=> {
    return {
        id: "my-plugin",
        endpoints: {
            getHelloWorld: createAuthEndpoint("/my-plugin/hello-world", {
                method: "GET",
            }, async(ctx) => {
                return ctx.json({
                    message: "Hello World"
                })
            })
        }
    } satisfies BetterAuthPlugin
}
```

Create Auth endpoints wraps around `createEndpoint` from Better Call. Inside the `ctx` object, it'll provide another object called `context` that give you access better-auth specific contexts including `options`, `db`, `baseURL` and more.

**Context Object**

- `appName`: The name of the application. Defaults to "Better Auth".
- `options`: The options passed to the Better Auth instance.
- `tables`: Core tables definition. It is an object which has the table name as the key and the schema definition as the value.
- `baseURL`: the baseURL of the auth server. This includes the path. For example, if the server is running on `http://localhost:3000`, the baseURL will be `http://localhost:3000/api/auth` by default unless changed by the user.
- `session`: The session configuration. Includes `updateAge` and `expiresIn` values.
- `secret`: The secret key used for various purposes. This is defined by the user.
- `authCookie`: The default cookie configuration for core auth cookies.
- `logger`: The logger instance used by Better Auth.
- `db`: The Kysely instance used by Better Auth to interact with the database.
- `adapter`: This is the same as db but it give you `orm` like functions to interact with the database. (we recommend using this over `db` unless you need raw sql queries or for performance reasons)
- `internalAdapter`: These are internal db calls that are used by Better Auth. For example, you can use these calls to create a session instead of using `adapter` directly. `internalAdapter.createSession(userId)`
- `createAuthCookie`: This is a helper function that let's you get a cookie `name` and `options` for either to `set` or `get` cookies. It implements things like `__secure` prefix and `__host` prefix for cookies based on

For other properties, you can check the [Better Call](https://github.com/bekacru/better-call) documentation and the [source code](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/init.ts).

**Rules for Endpoints**

- Makes sure you use kebab-case for the endpoint path
- Make sure to only use `POST` or `GET` methods for the endpoints.
- Any function that modifies a data should be a `POST` method.
- Any function that fetches data should be a `GET` method.
- Make sure to use the `createAuthEndpoint` function to create API endpoints.
- Make sure your paths are unique to avoid conflicts with other plugins. If you're using a common path, add the plugin name as a prefix to the path. ( `/my-plugin/hello-world` instead of `/hello-world`.)

### [Schema](https://www.better-auth.com/docs/concepts/plugins#schema)

You can define a database schema for your plugin by passing a `schema` object. The schema object should have the table name as the key and the schema definition as the value.

plugin.ts

```
import { BetterAuthPlugin } from "better-auth/plugins";

const myPlugin = ()=> {
    return {
        id: "my-plugin",
        schema: {
            myTable: {
                fields: {
                    name: {
                        type: "string"
                    }
                },
                modelName: "myTable" // optional if you want to use a different name than the key
            }
        }
    } satisfies BetterAuthPlugin
}
```

**Fields**

By default better-auth will create an `id` field for each table. You can add additional fields to the table by adding them to the `fields` object.

The key is the column name and the value is the column definition. The column definition can have the following properties:

`type`: The type of the field. It can be `string`, `number`, `boolean`, `date`.

`required`: if the field should be required on a new record. (default: `false`)

`unique`: if the field should be unique. (default: `false`)

`reference`: if the field is a reference to another table. (default: `null`) It takes an object with the following properties:

- `model`: The table name to reference.
- `field`: The field name to reference.
- `onDelete`: The action to take when the referenced record is deleted. (default: `null`)

**Other Schema Properties**

`disableMigration`: if the table should not be migrated. (default: `false`)

plugin.ts

```
const myPlugin = (opts: PluginOptions)=>{
    return {
        id: "my-plugin",
        schema: {
            rateLimit: {
                fields: {
                    key: {
                        type: "string",
                    },
                },
                disableMigration: opts.storage.provider !== "database",
            },
        },
    } satisfies BetterAuthPlugin
}
```

if you add additional fields to a `user` or `session` table, the types will be inferred automatically on `getSession` and `signUpEmail` calls.

plugin.ts

```

const myPlugin = ()=>{
    return {
        id: "my-plugin",
        schema: {
            user: {
                fields: {
                    age: {
                        type: "number",
                    },
                },
            },
        },
    } satisfies BetterAuthPlugin
}
```

This will add an `age` field to the `user` table and all `user` returning endpoints will include the `age` field and it'll be inferred properly by typescript.

Don't store sensitive information in `user` or `session` table. Crate a new table if you need to store sensitive information.

### [Hooks](https://www.better-auth.com/docs/concepts/plugins#hooks)

Hooks are used to run code before or after an action is performed, either from a client or directly on the server. You can add hooks to the server by passing a `hooks` object, which should contain `before` and `after` properties.

plugin.ts

```
import {  createAuthMiddleware } from "better-auth/plugins";

const myPlugin = ()=>{
    return {
        id: "my-plugin",
        hooks: {
            before: [{\
                    matcher: (context)=>{\
                        return context.headers.get("x-my-header") === "my-value"\
                    },\
                    handler: createAuthMiddleware(async (ctx)=>{\
                        //do something before the request\
                        return  {\
                            context: ctx // if you want to modify the context\
                        }\
                    })\
                }],
            after: [{\
                matcher: (context)=>{\
                    return context.path === "/sign-up/email"\
                },\
                handler: createAuthMiddleware(async (ctx)=>{\
                    return ctx.json({\
                        message: "Hello World"\
                    }) // if you want to modify the response\
                })\
            }]
        }
    } satisfies BetterAuthPlugin
}
```

### [Middleware](https://www.better-auth.com/docs/concepts/plugins#middleware)

You can add middleware to the server by passing a `middlewares` array. This array should contain middleware objects, each with a `path` and a `middleware` property. Unlike hooks, middleware only runs on `api` requests from a client. If the endpoint is invoked directly, the middleware will not run.

The `path` can be either a string or a path matcher, using the same path-matching system as `better-call`.

If you throw an `APIError` from the middleware or returned a `Response` object, the request will be stopped and the response will be sent to the client.

plugin.ts

```
const myPlugin = ()=>{
    return {
        id: "my-plugin",
        middlewares: [\
            {\
                path: "/my-plugin/hello-world",\
                middleware: createAuthMiddleware(async(ctx)=>{\
                    //do something\
                })\
            }\
        ]
    } satisfies BetterAuthPlugin
}
```

### [On Request & On Response](https://www.better-auth.com/docs/concepts/plugins#on-request--on-response)

Additional to middlewares, you can also hook into right before a request is made and right after a response is returned. This is mostly useful if you want to do something that affects all requests or responses.

#### [On Request](https://www.better-auth.com/docs/concepts/plugins#on-request)

The `onRequest` function is called right before the request is made. It takes two parameters: the `request` and the `context` object.

Here’s how it works:

- **Continue as Normal**: If you don't return anything, the request will proceed as usual.
- **Interrupt the Request**: To stop the request and send a response, return an object with a `response` property that contains a `Response` object.
- **Modify the Request**: You can also return a modified `request` object to change the request before it's sent.

plugin.ts

```
const myPlugin = ()=> {
    return  {
        id: "my-plugin",
        onRequest: async (request, context) => {
            //do something
        },
    } satisfies BetterAuthPlugin
}
```

#### [On Response](https://www.better-auth.com/docs/concepts/plugins#on-response)

The `onResponse` function is executed immediately after a response is returned. It takes two parameters: the `response` and the `context` object.

Here’s how to use it:

- **Modify the Response**: You can return a modified response object to change the response before it is sent to the client.
- **Continue Normally**: If you don't return anything, the response will be sent as is.

plugin.ts

```
const myPlugin = ()=>{
    return {
        id: "my-plugin",
        onResponse: async (response, context) => {
            //do something
        },
    } satisfies BetterAuthPlugin
}
```

### [Rate Limit](https://www.better-auth.com/docs/concepts/plugins#rate-limit)

You can define custom rate limit rules for your plugin by passing a `rateLimit` array. The rate limit array should contain an array of rate limit objects.

plugin.ts

```
const myPlugin = ()=>{
    return {
        id: "my-plugin",
        rateLimit: [\
            {\
                pathMatcher: (path)=>{\
                    return path === "/my-plugin/hello-world"\
                },\
                limit: 10,\
                window: 60,\
            }\
        ]
    } satisfies BetterAuthPlugin
}
```

### [Server-plugin helper functions](https://www.better-auth.com/docs/concepts/plugins#server-plugin-helper-functions)

Some additional helper functions for creating server plugins.

#### [`getSessionFromCtx`](https://www.better-auth.com/docs/concepts/plugins#getsessionfromctx)

Allows you to get the client's session data by passing the auth middleware's `context`.

plugin.ts

```
import {  createAuthMiddleware } from "better-auth/plugins";

const myPlugin = {
    id: "my-plugin",
    hooks: {
        before: [{\
                matcher: (context)=>{\
                    return context.headers.get("x-my-header") === "my-value"\
                },\
                handler: createAuthMiddleware(async (ctx) => {\
                    const session = await getSessionFromCtx(ctx);\
                    //do something with the client's session.\
\
                    return  {\
                        context: ctx\
                    }\
                })\
            }],
    }
} satisfies BetterAuthPlugin
```

#### [`sessionMiddleware`](https://www.better-auth.com/docs/concepts/plugins#sessionmiddleware)

A middleware that checks if the client has a valid session. If the client has a valid session, it'll add the session data to the context object.

plugin.ts

```
import { createAuthMiddleware } from "better-auth/plugins";
import { sessionMiddleware } from "better-auth/api";

const myPlugin = ()=>{
    return {
        id: "my-plugin",
        endpoints: {
            getHelloWorld: createAuthEndpoint("/my-plugin/hello-world", {
                method: "GET",
                use: [sessionMiddleware],
            }, async(ctx) => {
                const session = ctx.context.session;
                return ctx.json({
                    message: "Hello World"
                })
            })
        }
    } satisfies BetterAuthPlugin
}
```

## [Creating a client plugin](https://www.better-auth.com/docs/concepts/plugins#creating-a-client-plugin)

If your endpoints needs to be called from the client, you'll need to also create a client plugin. Better Auth clients can infer the endpoints from the server plugins. You can also add additional client side logic.

client-plugin.ts

```
import type { BetterAuthClientPlugin } from "better-auth";

export const myPluginClient = ()=>{
    return {
        id: "my-plugin",
    } satisfies BetterAuthClientPlugin
}
```

### [Endpoint Interface](https://www.better-auth.com/docs/concepts/plugins#endpoint-interface)

Endpoints are inferred from the server plugin by adding a `$InferServerPlugin` key to the client plugin.

The client infers the `path` as an object and converts kebab-case to camelCase. For example, `/my-plugin/hello-world` becomes `myPlugin.helloWorld`.

client-plugin.ts

```
import type { BetterAuthClientPlugin } from "better-auth/client";
import type { myPlugin } from "./plugin";

const myPluginClient = ()=> {
    return  {
        id: "my-plugin",
        $InferServerPlugin: {} as ReturnType<typeof myPlugin>,
    } satisfies BetterAuthClientPlugin
}
```

### [Get actions](https://www.better-auth.com/docs/concepts/plugins#get-actions)

If you need to add additional methods or what not to the client you can use the `getActions` function. This function is called with the `fetch` function from the client.

Better Auth uses [Better fetch](https://better-fetch.vercel.app/) to make requests. Better fetch is a simple fetch wrapper made by the same author of Better Auth.

client-plugin.ts

```
import type { BetterAuthClientPlugin } from "better-auth/client";
import type { myPlugin } from "./plugin";
import type { BetterFetchOption } from "@better-fetch/fetch";

const myPluginClient = {
    id: "my-plugin",
    $InferServerPlugin: {} as ReturnType<typeof myPlugin>,
    getActions: ($fetch)=>{
        return {
            myCustomAction: async (data: {
                foo: string,
            }, fetchOptions?: BetterFetchOption)=>{
                const res = $fetch("/custom/action", {
                    method: "POST",
                    body: {
                        foo: data.foo
                    },
                    ...fetchOptions
                })
                return res
            }
        }
    }
} satisfies BetterAuthClientPlugin
```

As a general guideline, ensure that each function accepts only one argument, with an optional second argument for fetchOptions to allow users to pass additional options to the fetch call. The function should return an object containing data and error keys.

If your use case involves actions beyond API calls, feel free to deviate from this rule.

### [Get Atoms](https://www.better-auth.com/docs/concepts/plugins#get-atoms)

This is only useful if you want to provide `hooks` like `useSession`.

Get atoms is called with the `fetch` function from better fetch and it should return an object with the atoms. The atoms should be created using [nanostores](https://github.com/nanostores/nanostores). The atoms will be resolved by each framework `useStore` hook provided by nanostores.

client-plugin.ts

```
import { atom } from "nanostores";
import type { BetterAuthClientPlugin } from "better-auth/client";

const myPluginClient = {
    id: "my-plugin",
    $InferServerPlugin: {} as ReturnType<typeof myPlugin>,
    getAtoms: ($fetch)=>{
        const myAtom = atom<null>()
        return {
            myAtom
        }
    }
} satisfies BetterAuthClientPlugin
```

See built-in plugins for examples of how to use atoms properly.

### [Path methods](https://www.better-auth.com/docs/concepts/plugins#path-methods)

By default, inferred paths use `GET` method if they don't require a body and `POST` if they do. You can override this by passing a `pathMethods` object. The key should be the path and the value should be the method ("POST" \| "GET").

client-plugin.ts

```
import type { BetterAuthClientPlugin } from "better-auth/client";
import type { myPlugin } from "./plugin";

const myPluginClient = {
    id: "my-plugin",
    $InferServerPlugin: {} as ReturnType<typeof myPlugin>,
    pathMethods: {
        "/my-plugin/hello-world": "POST"
    }
} satisfies BetterAuthClientPlugin
```

### [Fetch plugins](https://www.better-auth.com/docs/concepts/plugins#fetch-plugins)

If you need to use better fetch plugins you can pass them to the `fetchPlugins` array. You can read more about better fetch plugins in the [better fetch documentation](https://better-fetch.vercel.app/docs/plugins).

### [Atom Listeners](https://www.better-auth.com/docs/concepts/plugins#atom-listeners)

This is only useful if you want to provide `hooks` like `useSession` and you want to listen to atoms and re-evaluate them when they change.

You can see how this is used in the built-in plugins.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/plugins.mdx)

[Previous Page\\
\\
Hooks](https://www.better-auth.com/docs/concepts/hooks) [Next Page\\
\\
OAuth](https://www.better-auth.com/docs/concepts/oauth)

### On this page

[Using a Plugin](https://www.better-auth.com/docs/concepts/plugins#using-a-plugin) [Creating a Plugin](https://www.better-auth.com/docs/concepts/plugins#creating-a-plugin) [What can a plugin do?](https://www.better-auth.com/docs/concepts/plugins#what-can-a-plugin-do) [Create a Server plugin](https://www.better-auth.com/docs/concepts/plugins#create-a-server-plugin) [Endpoints](https://www.better-auth.com/docs/concepts/plugins#endpoints) [Schema](https://www.better-auth.com/docs/concepts/plugins#schema) [Hooks](https://www.better-auth.com/docs/concepts/plugins#hooks) [Middleware](https://www.better-auth.com/docs/concepts/plugins#middleware) [On Request & On Response](https://www.better-auth.com/docs/concepts/plugins#on-request--on-response) [On Request](https://www.better-auth.com/docs/concepts/plugins#on-request) [On Response](https://www.better-auth.com/docs/concepts/plugins#on-response) [Rate Limit](https://www.better-auth.com/docs/concepts/plugins#rate-limit) [Server-plugin helper functions](https://www.better-auth.com/docs/concepts/plugins#server-plugin-helper-functions) [`getSessionFromCtx`](https://www.better-auth.com/docs/concepts/plugins#getsessionfromctx) [`sessionMiddleware`](https://www.better-auth.com/docs/concepts/plugins#sessionmiddleware) [Creating a client plugin](https://www.better-auth.com/docs/concepts/plugins#creating-a-client-plugin) [Endpoint Interface](https://www.better-auth.com/docs/concepts/plugins#endpoint-interface) [Get actions](https://www.better-auth.com/docs/concepts/plugins#get-actions) [Get Atoms](https://www.better-auth.com/docs/concepts/plugins#get-atoms) [Path methods](https://www.better-auth.com/docs/concepts/plugins#path-methods) [Fetch plugins](https://www.better-auth.com/docs/concepts/plugins#fetch-plugins) [Atom Listeners](https://www.better-auth.com/docs/concepts/plugins#atom-listeners)
