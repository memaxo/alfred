---
title: Next.js integration | Better Auth
url:
description: Integrate Better Auth with Next.js.
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

# Next.js integration

Copy MarkdownOpen in

Better Auth can be easily integrated with Next.js. Before you start, make sure you have a Better Auth instance configured. If you haven't done that yet, check out the [installation](https://www.better-auth.com/docs/installation).

### [Create API Route](https://www.better-auth.com/docs/integrations/next#create-api-route)

We need to mount the handler to an API route. Create a route file inside `/api/auth/[...all]` directory. And add the following code:

api/auth/\[...all\]/route.ts

```
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth.handler);
```

You can change the path on your better-auth configuration but it's recommended to keep it as `/api/auth/[...all]`

For `pages` route, you need to use `toNodeHandler` instead of `toNextJsHandler` and set `bodyParser` to `false` in the `config` object. Here is an example:

pages/api/auth/\[...all\].ts

```
import { toNodeHandler } from "better-auth/node"
import { auth } from "@/lib/auth"

// Disallow body parsing, we will parse it manually
export const config = { api: { bodyParser: false } }

export default toNodeHandler(auth.handler)
```

## [Create a client](https://www.better-auth.com/docs/integrations/next#create-a-client)

Create a client instance. You can name the file anything you want. Here we are creating `client.ts` file inside the `lib/` directory.

auth-client.ts

```
import { createAuthClient } from "better-auth/react" // make sure to import from better-auth/react

export const authClient =  createAuthClient({
    //you can pass client configuration here
})
```

Once you have created the client, you can use it to sign up, sign in, and perform other actions.
Some of the actions are reactive. The client uses [nano-store](https://github.com/nanostores/nanostores) to store the state and re-render the components when the state changes.

The client also uses [better-fetch](https://github.com/bekacru/better-fetch) to make the requests. You can pass the fetch configuration to the client.

## [RSC and Server actions](https://www.better-auth.com/docs/integrations/next#rsc-and-server-actions)

The `api` object exported from the auth instance contains all the actions that you can perform on the server. Every endpoint made inside Better Auth is a invocable as a function. Including plugins endpoints.

**Example: Getting Session on a server action**

server.ts

```
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

const someAuthenticatedAction = async () => {
    "use server";
    const session = await auth.api.getSession({
        headers: await headers()
    })
};
```

**Example: Getting Session on a RSC**

```
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function ServerComponent() {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if(!session) {
        return <div>Not authenticated</div>
    }
    return (
        <div>
            <h1>Welcome {session.user.name}</h1>
        </div>
    )
}
```

As RSCs cannot set cookies, the [cookie cache](https://www.better-auth.com/docs/concepts/session-management#cookie-cache) will not be refreshed until the server is interacted with from the client via Server Actions or Route Handlers.

### [Server Action Cookies](https://www.better-auth.com/docs/integrations/next#server-action-cookies)

When you call a function that needs to set cookies, like `signInEmail` or `signUpEmail` in a server action, cookies won’t be set. This is because server actions need to use the `cookies` helper from Next.js to set cookies.

To simplify this, you can use the `nextCookies` plugin, which will automatically set cookies for you whenever a `Set-Cookie` header is present in the response.

auth.ts

```
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
    //...your config
    plugins: [nextCookies()] // make sure this is the last plugin in the array
})
```

Now, when you call functions that set cookies, they will be automatically set.

```
"use server";
import { auth } from "@/lib/auth"

const signIn = async () => {
    await auth.api.signInEmail({
        body: {
            email: "user@email.com",
            password: "password",
        }
    })
}
```

## [Middleware](https://www.better-auth.com/docs/integrations/next#middleware)

In Next.js middleware, it's recommended to only check for the existence of a session cookie to handle redirection. To avoid blocking requests by making API or database calls.

You can use the `getSessionCookie` helper from Better Auth for this purpose:

The `getSessionCookie()` function does not automatically reference the auth config specified in `auth.ts`. Therefore, if you customized the cookie name or prefix, you need to ensure that the configuration in `getSessionCookie()` matches the config defined in your `auth.ts`.

```
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
	const sessionCookie = getSessionCookie(request);

    // THIS IS NOT SECURE!
    // This is the recommended approach to optimistically redirect users
    // We recommend handling auth checks in each page/route
	if (!sessionCookie) {
		return NextResponse.redirect(new URL("/", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/dashboard"], // Specify the routes the middleware applies to
};
```

**Security Warning:** The `getSessionCookie` function only checks for the
existence of a session cookie; it does **not** validate it. Relying solely
on this check for security is dangerous, as anyone can manually create a
cookie to bypass it. You must always validate the session on your server for
any protected actions or pages.

If you have a custom cookie name or prefix, you can pass it to the `getSessionCookie` function.

```
const sessionCookie = getSessionCookie(request, {
    cookieName: "my_session_cookie",
    cookiePrefix: "my_prefix"
});
```

Alternatively, you can use the `getCookieCache` helper to get the session object from the cookie cache.

```
import { getCookieCache } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
	const session = await getCookieCache(request);
	if (!session) {
		return NextResponse.redirect(new URL("/sign-in", request.url));
	}
	return NextResponse.next();
}
```

### [How to handle auth checks in each page/route](https://www.better-auth.com/docs/integrations/next#how-to-handle-auth-checks-in-each-pageroute)

In this example, we are using the `auth.api.getSession` function within a server component to get the session object,
then we are checking if the session is valid. If it's not, we are redirecting the user to the sign-in page.

app/dashboard/page.tsx

```
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if(!session) {
        redirect("/sign-in")
    }

    return (
        <div>
            <h1>Welcome {session.user.name}</h1>
        </div>
    )
}
```

### [For Next.js release `15.1.7` and below](https://www.better-auth.com/docs/integrations/next#for-nextjs-release-1517-and-below)

If you need the full session object, you'll have to fetch it from the `/get-session` API route. Since Next.js middleware doesn't support running Node.js APIs directly, you must make an HTTP request.

The example uses [better-fetch](https://better-fetch.vercel.app/), but you can use any fetch library.

```
import { betterFetch } from "@better-fetch/fetch";
import type { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

type Session = typeof auth.$Infer.Session;

export async function middleware(request: NextRequest) {
	const { data: session } = await betterFetch<Session>("/api/auth/get-session", {
		baseURL: request.nextUrl.origin,
		headers: {
			cookie: request.headers.get("cookie") || "", // Forward the cookies from the request
		},
	});

	if (!session) {
		return NextResponse.redirect(new URL("/sign-in", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/dashboard"], // Apply middleware to specific routes
};
```

### [For Next.js release `15.2.0` and above](https://www.better-auth.com/docs/integrations/next#for-nextjs-release-1520-and-above)

From the version 15.2.0, Next.js allows you to use the `Node.js` runtime in middleware. This means you can use the `auth.api` object directly in middleware.

You may refer to the [Next.js documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware#runtime) for more information about runtime configuration, and how to enable it.
Be careful when using the new runtime. It's an experimental feature and it may be subject to breaking changes.

```
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function middleware(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if(!session) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: ["/dashboard"], // Apply middleware to specific routes
};
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/integrations/next.mdx)

[Previous Page\\
\\
Remix](https://www.better-auth.com/docs/integrations/remix) [Next Page\\
\\
Nuxt](https://www.better-auth.com/docs/integrations/nuxt)

### On this page

[Create API Route](https://www.better-auth.com/docs/integrations/next#create-api-route) [Create a client](https://www.better-auth.com/docs/integrations/next#create-a-client) [RSC and Server actions](https://www.better-auth.com/docs/integrations/next#rsc-and-server-actions) [Server Action Cookies](https://www.better-auth.com/docs/integrations/next#server-action-cookies) [Middleware](https://www.better-auth.com/docs/integrations/next#middleware) [How to handle auth checks in each page/route](https://www.better-auth.com/docs/integrations/next#how-to-handle-auth-checks-in-each-pageroute) [For Next.js release `15.1.7` and below](https://www.better-auth.com/docs/integrations/next#for-nextjs-release-1517-and-below) [For Next.js release `15.2.0` and above](https://www.better-auth.com/docs/integrations/next#for-nextjs-release-1520-and-above)
