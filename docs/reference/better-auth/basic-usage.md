---
title: Basic Usage | Better Auth
url: 
description: Getting started with Better Auth
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

# Basic Usage

Copy MarkdownOpen in

Better Auth provides built-in authentication support for:

- **Email and password**
- **Social provider (Google, GitHub, Apple, and more)**

But also can easily be extended using plugins, such as: [username](https://www.better-auth.com/docs/plugins/username), [magic link](https://www.better-auth.com/docs/plugins/magic-link), [passkey](https://www.better-auth.com/docs/plugins/passkey), [email-otp](https://www.better-auth.com/docs/plugins/email-otp), and more.

## [Email & Password](https://www.better-auth.com/docs/basic-usage\#email--password)

To enable email and password authentication:

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    emailAndPassword: {
        enabled: true
    }
})
```

### [Sign Up](https://www.better-auth.com/docs/basic-usage\#sign-up)

To sign up a user you need to call the client method `signUp.email` with the user's information.

sign-up.ts

```
import { authClient } from "@/lib/auth-client"; //import the auth client

const { data, error } = await authClient.signUp.email({
        email, // user email address
        password, // user password -> min 8 characters by default
        name, // user display name
        image, // User image URL (optional)
        callbackURL: "/dashboard" // A URL to redirect to after the user verifies their email (optional)
    }, {
        onRequest: (ctx) => {
            //show loading
        },
        onSuccess: (ctx) => {
            //redirect to the dashboard or sign in page
        },
        onError: (ctx) => {
            // display the error message
            alert(ctx.error.message);
        },
});
```

By default, the users are automatically signed in after they successfully sign up. To disable this behavior you can set `autoSignIn` to `false`.

auth.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    emailAndPassword: {
    	enabled: true,
    	autoSignIn: false //defaults to true
  },
})
```

### [Sign In](https://www.better-auth.com/docs/basic-usage\#sign-in)

To sign a user in, you can use the `signIn.email` function provided by the client.

sign-in

```
const { data, error } = await authClient.signIn.email({
        /**
         * The user email
         */
        email,
        /**
         * The user password
         */
        password,
        /**
         * A URL to redirect to after the user verifies their email (optional)
         */
        callbackURL: "/dashboard",
        /**
         * remember the user session after the browser is closed.
         * @default true
         */
        rememberMe: false
}, {
    //callbacks
})
```

Always invoke client methods from the client side. Don't call them from the server.

### [Server-Side Authentication](https://www.better-auth.com/docs/basic-usage\#server-side-authentication)

To authenticate a user on the server, you can use the `auth.api` methods.

server.ts

```
import { auth } from "./auth"; // path to your Better Auth server instance

const response = await auth.api.signInEmail({
    body: {
        email,
        password
    },
    asResponse: true // returns a response object instead of data
});
```

If the server cannot return a response object, you'll need to manually parse and set cookies. But for frameworks like Next.js we provide [a plugin](https://www.better-auth.com/docs/integrations/next#server-action-cookies) to handle this automatically

## [Social Sign-On](https://www.better-auth.com/docs/basic-usage\#social-sign-on)

Better Auth supports multiple social providers, including Google, GitHub, Apple, Discord, and more. To use a social provider, you need to configure the ones you need in the `socialProviders` option on your `auth` object.

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        }
    },
})
```

### [Sign in with social providers](https://www.better-auth.com/docs/basic-usage\#sign-in-with-social-providers)

To sign in using a social provider you need to call `signIn.social`. It takes an object with the following properties:

sign-in.ts

```
import { authClient } from "@/lib/auth-client"; //import the auth client

await authClient.signIn.social({
    /**
     * The social provider ID
     * @example "github", "google", "apple"
     */
    provider: "github",
    /**
     * A URL to redirect after the user authenticates with the provider
     * @default "/"
     */
    callbackURL: "/dashboard",
    /**
     * A URL to redirect if an error occurs during the sign in process
     */
    errorCallbackURL: "/error",
    /**
     * A URL to redirect if the user is newly registered
     */
    newUserCallbackURL: "/welcome",
    /**
     * disable the automatic redirect to the provider.
     * @default false
     */
    disableRedirect: true,
});
```

You can also authenticate using `idToken` or `accessToken` from the social provider instead of redirecting the user to the provider's site. See social providers documentation for more details.

## [Signout](https://www.better-auth.com/docs/basic-usage\#signout)

To signout a user, you can use the `signOut` function provided by the client.

user-card.tsx

```
await authClient.signOut();
```

you can pass `fetchOptions` to redirect onSuccess

user-card.tsx

```
await authClient.signOut({
  fetchOptions: {
    onSuccess: () => {
      router.push("/login"); // redirect to login page
    },
  },
});
```

## [Session](https://www.better-auth.com/docs/basic-usage\#session)

Once a user is signed in, you'll want to access the user session. Better Auth allows you to easily access the session data from both the server and client sides.

### [Client Side](https://www.better-auth.com/docs/basic-usage\#client-side)

#### [Use Session](https://www.better-auth.com/docs/basic-usage\#use-session)

Better Auth provides a `useSession` hook to easily access session data on the client side. This hook is implemented using nanostore and has support for each supported framework and vanilla client, ensuring that any changes to the session (such as signing out) are immediately reflected in your UI.

ReactVueSvelteSolidVanilla

user.tsx

```
import { authClient } from "@/lib/auth-client" // import the auth client

export function User(){

    const {
        data: session,
        isPending, //loading state
        error, //error object
        refetch //refetch the session
    } = authClient.useSession()

    return (
        //...
    )
}
```

index.vue

```
<script setup lang="ts">
import { authClient } from "~/lib/auth-client"

const session = authClient.useSession()
</script>

<template>
    <div>
        <div>
            <pre>{{ session.data }}</pre>
            <button v-if="session.data" @click="authClient.signOut()">
                Sign out
            </button>
        </div>
    </div>
</template>
```

user.svelte

```
<script lang="ts">
import { authClient } from "$lib/auth-client";

const session = authClient.useSession();
</script>
<p>
    {$session.data?.user.email}
</p>
```

user.svelte

```
import { authClient } from "~/lib/auth-client"; //import the auth client

authClient.useSession.subscribe((value)=>{
    //do something with the session //
})
```

user.tsx

```
import { authClient } from "~/lib/auth-client";

export default function Home() {
    const session = authClient.useSession()
    return (
        <pre>{JSON.stringify(session(), null, 2)}</pre>
    );
}
```

#### [Get Session](https://www.better-auth.com/docs/basic-usage\#get-session)

If you prefer not to use the hook, you can use the `getSession` method provided by the client.

user.tsx

```
import { authClient } from "@/lib/auth-client" // import the auth client

const { data: session, error } = await authClient.getSession()
```

You can also use it with client-side data-fetching libraries like [TanStack Query](https://tanstack.com/query/latest).

### [Server Side](https://www.better-auth.com/docs/basic-usage\#server-side)

The server provides a `session` object that you can use to access the session data. It requires request headers object to be passed to the `getSession` method.

**Example: Using some popular frameworks**

Next.jsNuxtSvelteAstroHonoTanStack

server.ts

```
import { auth } from "./auth"; // path to your Better Auth server instance
import { headers } from "next/headers";

const session = await auth.api.getSession({
    headers: await headers() // you need to pass the headers object.
})
```

route.ts

```
import { auth } from "lib/auth"; // path to your Better Auth server instance

export async function loader({ request }: LoaderFunctionArgs) {
    const session = await auth.api.getSession({
        headers: request.headers
    })

    return json({ session })
}
```

index.astro

```
---
import { auth } from "./auth";

const session = await auth.api.getSession({
    headers: Astro.request.headers,
});
---
<!-- Your Astro Template -->
```

+page.ts

```
import { auth } from "./auth";

export async function load({ request }) {
    const session = await auth.api.getSession({
        headers: request.headers
    })
    return {
        props: {
            session
        }
    }
}
```

index.ts

```
import { auth } from "./auth";

const app = new Hono();

app.get("/path", async (c) => {
    const session = await auth.api.getSession({
        headers: c.req.raw.headers
    })
});
```

server/session.ts

```
import { auth } from "~/utils/auth";

export default defineEventHandler((event) => {
    const session = await auth.api.getSession({
        headers: event.headers,
    })
});
```

app/routes/api/index.ts

```
import { auth } from "./auth";
import { createAPIFileRoute } from "@tanstack/start/api";

export const APIRoute = createAPIFileRoute("/api/$")({
    GET: async ({ request }) => {
        const session = await auth.api.getSession({
            headers: request.headers
        })
    },
});
```

For more details check [session-management](https://www.better-auth.com/docs/concepts/session-management) documentation.

## [Using Plugins](https://www.better-auth.com/docs/basic-usage\#using-plugins)

One of the unique features of Better Auth is a plugins ecosystem. It allows you to add complex auth related functionality with small lines of code.

Below is an example of how to add two factor authentication using two factor plugin.

### [Server Configuration](https://www.better-auth.com/docs/basic-usage\#server-configuration)

To add a plugin, you need to import the plugin and pass it to the `plugins` option of the auth instance. For example, to add two factor authentication, you can use the following code:

auth.ts

```
import { betterAuth } from "better-auth"
import { twoFactor } from "better-auth/plugins"

export const auth = betterAuth({
    //...rest of the options
    plugins: [\
        twoFactor()\
    ]
})
```

now two factor related routes and method will be available on the server.

### [Migrate Database](https://www.better-auth.com/docs/basic-usage\#migrate-database)

After adding the plugin, you'll need to add the required tables to your database. You can do this by running the `migrate` command, or by using the `generate` command to create the schema and handle the migration manually.

generating the schema:

terminal

```
npx @better-auth/cli generate
```

using the `migrate` command:

terminal

```
npx @better-auth/cli migrate
```

If you prefer adding the schema manually, you can check the schema required on the [two factor plugin](https://www.better-auth.com/docs/plugins/2fa#schema) documentation.

### [Client Configuration](https://www.better-auth.com/docs/basic-usage\#client-configuration)

Once we're done with the server, we need to add the plugin to the client. To do this, you need to import the plugin and pass it to the `plugins` option of the auth client. For example, to add two factor authentication, you can use the following code:

auth-client.ts

```
import { createAuthClient } from "better-auth/client";
import { twoFactorClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
    plugins: [\
        twoFactorClient({\
            twoFactorPage: "/two-factor" // the page to redirect if a user needs to verify 2nd factor\
        })\
    ]
})
```

now two factor related methods will be available on the client.

profile.ts

```
import { authClient } from "./auth-client"

const enableTwoFactor = async() => {
    const data = await authClient.twoFactor.enable({
        password // the user password is required
    }) // this will enable two factor
}

const disableTwoFactor = async() => {
    const data = await authClient.twoFactor.disable({
        password // the user password is required
    }) // this will disable two factor
}

const signInWith2Factor = async() => {
    const data = await authClient.signIn.email({
        //...
    })
    //if the user has two factor enabled, it will redirect to the two factor page
}

const verifyTOTP = async() => {
    const data = await authClient.twoFactor.verifyTOTP({
        code: "123456", // the code entered by the user
        /**
         * If the device is trusted, the user won't
         * need to pass 2FA again on the same device
         */
        trustDevice: true
    })
}
```

Next step: See the [two factor plugin documentation](https://www.better-auth.com/docs/plugins/2fa).

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/basic-usage.mdx)

[Previous Page\\
\\
Installation](https://www.better-auth.com/docs/installation) [Next Page\\
\\
API](https://www.better-auth.com/docs/concepts/api)

### On this page

[Email & Password](https://www.better-auth.com/docs/basic-usage#email--password) [Sign Up](https://www.better-auth.com/docs/basic-usage#sign-up) [Sign In](https://www.better-auth.com/docs/basic-usage#sign-in) [Server-Side Authentication](https://www.better-auth.com/docs/basic-usage#server-side-authentication) [Social Sign-On](https://www.better-auth.com/docs/basic-usage#social-sign-on) [Sign in with social providers](https://www.better-auth.com/docs/basic-usage#sign-in-with-social-providers) [Signout](https://www.better-auth.com/docs/basic-usage#signout) [Session](https://www.better-auth.com/docs/basic-usage#session) [Client Side](https://www.better-auth.com/docs/basic-usage#client-side) [Use Session](https://www.better-auth.com/docs/basic-usage#use-session) [Get Session](https://www.better-auth.com/docs/basic-usage#get-session) [Server Side](https://www.better-auth.com/docs/basic-usage#server-side) [Using Plugins](https://www.better-auth.com/docs/basic-usage#using-plugins) [Server Configuration](https://www.better-auth.com/docs/basic-usage#server-configuration) [Migrate Database](https://www.better-auth.com/docs/basic-usage#migrate-database) [Client Configuration](https://www.better-auth.com/docs/basic-usage#client-configuration)