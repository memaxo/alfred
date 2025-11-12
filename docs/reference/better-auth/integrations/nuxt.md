---
title: Nuxt Integration | Better Auth
url: 
description: Integrate Better Auth with Nuxt.
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

# Nuxt Integration

Copy MarkdownOpen in

Before you start, make sure you have a Better Auth instance configured. If you haven't done that yet, check out the [installation](https://www.better-auth.com/docs/installation).

### [Create API Route](https://www.better-auth.com/docs/integrations/nuxt\#create-api-route)

We need to mount the handler to an API route. Create a file inside `/server/api/auth` called `[...all].ts` and add the following code:

server/api/auth/\[...all\].ts

```
import { auth } from "~/lib/auth"; // import your auth config

export default defineEventHandler((event) => {
	return auth.handler(toWebRequest(event));
});
```

You can change the path on your better-auth configuration but it's recommended to keep it as `/api/auth/[...all]`

### [Migrate the database](https://www.better-auth.com/docs/integrations/nuxt\#migrate-the-database)

Run the following command to create the necessary tables in your database:

```
npx @better-auth/cli migrate
```

## [Create a client](https://www.better-auth.com/docs/integrations/nuxt\#create-a-client)

Create a client instance. You can name the file anything you want. Here we are creating `client.ts` file inside the `lib/` directory.

auth-client.ts

```
import { createAuthClient } from "better-auth/vue" // make sure to import from better-auth/vue

export const authClient = createAuthClient({
    //you can pass client configuration here
})
```

Once you have created the client, you can use it to sign up, sign in, and perform other actions.
Some of the actions are reactive.

### [Example usage](https://www.better-auth.com/docs/integrations/nuxt\#example-usage)

index.vue

```
<script setup lang="ts">
import { authClient } from "~/lib/client"
const session = authClient.useSession()
</script>

<template>
    <div>
        <button v-if="!session?.data" @click="() => authClient.signIn.social({
            provider: 'github'
        })">
            Continue with GitHub
        </button>
        <div>
            <pre>{{ session.data }}</pre>
            <button v-if="session.data" @click="authClient.signOut()">
                Sign out
            </button>
        </div>
    </div>
</template>
```

### [Server Usage](https://www.better-auth.com/docs/integrations/nuxt\#server-usage)

The `api` object exported from the auth instance contains all the actions that you can perform on the server. Every endpoint made inside Better Auth is a invocable as a function. Including plugins endpoints.

**Example: Getting Session on a server API route**

server/api/example.ts

```
import { auth } from "~/lib/auth";

export default defineEventHandler((event) => {
    const session = await auth.api.getSession({
      headers: event.headers
    });

   if(session) {
     // access the session.session && session.user
   }
});
```

### [SSR Usage](https://www.better-auth.com/docs/integrations/nuxt\#ssr-usage)

If you are using Nuxt with SSR, you can use the `useSession` function in the `setup` function of your page component and pass `useFetch` to make it work with SSR.

index.vue

```
<script setup lang="ts">
import { authClient } from "~/lib/auth-client";

const { data: session } = await authClient.useSession(useFetch);
</script>

<template>
    <p>
        {{ session }}
    </p>
</template>
```

### [Middleware](https://www.better-auth.com/docs/integrations/nuxt\#middleware)

To add middleware to your Nuxt project, you can use the `useSession` method from the client.

middleware/auth.global.ts

```
import { authClient } from "~/lib/auth-client";
export default defineNuxtRouteMiddleware(async (to, from) => {
	const { data: session } = await authClient.useSession(useFetch);
	if (!session.value) {
		if (to.path === "/dashboard") {
			return navigateTo("/");
		}
	}
});
```

### [Resources & Examples](https://www.better-auth.com/docs/integrations/nuxt\#resources--examples)

- [Nuxt and Nuxt Hub example](https://github.com/atinux/nuxthub-better-auth) on GitHub.
- [NuxtZzle is Nuxt,Drizzle ORM example](https://github.com/leamsigc/nuxt-better-auth-drizzle) on GitHub [preview](https://nuxt-better-auth.giessen.dev/)
- [Nuxt example](https://stackblitz.com/github/better-auth/better-auth/tree/main/examples/nuxt-example) on StackBlitz.
- [NuxSaaS (Github)](https://github.com/NuxSaaS/NuxSaaS) is a full-stack SaaS Starter Kit that leverages Better Auth for secure and efficient user authentication. [Demo](https://nuxsaas.com/)
- [NuxtOne (Github)](https://github.com/nuxtone/nuxt-one) is a Nuxt-based starter template for building AIaaS (AI-as-a-Service) applications [preview](https://www.one.devv.zone/)

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/integrations/nuxt.mdx)

[Previous Page\\
\\
Next](https://www.better-auth.com/docs/integrations/next) [Next Page\\
\\
SvelteKit](https://www.better-auth.com/docs/integrations/svelte-kit)

### On this page

[Create API Route](https://www.better-auth.com/docs/integrations/nuxt#create-api-route) [Migrate the database](https://www.better-auth.com/docs/integrations/nuxt#migrate-the-database) [Create a client](https://www.better-auth.com/docs/integrations/nuxt#create-a-client) [Example usage](https://www.better-auth.com/docs/integrations/nuxt#example-usage) [Server Usage](https://www.better-auth.com/docs/integrations/nuxt#server-usage) [SSR Usage](https://www.better-auth.com/docs/integrations/nuxt#ssr-usage) [Middleware](https://www.better-auth.com/docs/integrations/nuxt#middleware) [Resources & Examples](https://www.better-auth.com/docs/integrations/nuxt#resources--examples)