---
title: Remix Integration | Better Auth
url:
description: Integrate Better Auth with Remix.
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

# Remix Integration

Copy MarkdownOpen in

Better Auth can be easily integrated with Remix. This guide will show you how to integrate Better Auth with Remix.

You can follow the steps from [installation](https://www.better-auth.com/docs/installation) to get started or you can follow this guide to make it the Remix-way.

If you have followed the installation steps, you can skip the first step.

## [Create auth instance](https://www.better-auth.com/docs/integrations/remix#create-auth-instance)

Create a file named `auth.server.ts` in one of these locations:

- Project root
- `lib/` folder
- `utils/` folder

You can also nest any of these folders under `app/` folder. (e.g. `app/lib/auth.server.ts`)

And in this file, import Better Auth and create your instance.

Make sure to export the auth instance with the variable name `auth` or as a `default` export.

app/lib/auth.server.ts

```
import { betterAuth } from "better-auth"

export const auth = betterAuth({
    database: {
        provider: "postgres", //change this to your database provider
        url: process.env.DATABASE_URL, // path to your database or connection string
    }
})
```

## [Create API Route](https://www.better-auth.com/docs/integrations/remix#create-api-route)

We need to mount the handler to a API route. Create a resource route file `api.auth.$.ts` inside `app/routes/` directory. And add the following code:

app/routes/api.auth.$.ts

```
import { auth } from '~/lib/auth.server' // Adjust the path as necessary
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node"

export async function loader({ request }: LoaderFunctionArgs) {
    return auth.handler(request)
}

export async function action({ request }: ActionFunctionArgs) {
    return auth.handler(request)
}
```

You can change the path on your better-auth configuration but it's recommended to keep it as `routes/api.auth.$.ts`

## [Create a client](https://www.better-auth.com/docs/integrations/remix#create-a-client)

Create a client instance. Here we are creating `auth-client.ts` file inside the `lib/` directory.

app/lib/auth-client.ts

```
import { createAuthClient } from "better-auth/react" // make sure to import from better-auth/react

export const authClient = createAuthClient({
    //you can pass client configuration here
})
```

Once you have created the client, you can use it to sign up, sign in, and perform other actions.

### [Example usage](https://www.better-auth.com/docs/integrations/remix#example-usage)

#### [Sign Up](https://www.better-auth.com/docs/integrations/remix#sign-up)

app/routes/signup.tsx

```
import { Form } from "@remix-run/react"
import { useState } from "react"
import { authClient } from "~/lib/auth-client"

export default function SignUp() {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")

  const signUp = async () => {
    await authClient.signUp.email(
      {
        email,
        password,
        name,
      },
      {
        onRequest: (ctx) => {
          // show loading state
        },
        onSuccess: (ctx) => {
          // redirect to home
        },
        onError: (ctx) => {
          alert(ctx.error)
        },
      },
    )
  }

  return (
    <div>
      <h2>
        Sign Up
      </h2>
      <Form
        onSubmit={signUp}
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button
          type="submit"
        >
          Sign Up
        </button>
      </Form>
    </div>
  )
}
```

#### [Sign In](https://www.better-auth.com/docs/integrations/remix#sign-in)

app/routes/signin.tsx

```
import { Form } from "@remix-run/react"
import { useState } from "react"
import { authClient } from "~/services/auth-client"

export default function SignIn() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const signIn = async () => {
    await authClient.signIn.email(
      {
        email,
        password,
      },
      {
        onRequest: (ctx) => {
          // show loading state
        },
        onSuccess: (ctx) => {
          // redirect to home
        },
        onError: (ctx) => {
          alert(ctx.error)
        },
      },
    )
  }

  return (
    <div>
      <h2>
        Sign In
      </h2>
      <Form onSubmit={signIn}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
        >
          Sign In
        </button>
      </Form>
    </div>
  )
}
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/integrations/remix.mdx)

[Previous Page\\
\\
Astro](https://www.better-auth.com/docs/integrations/astro) [Next Page\\
\\
Next](https://www.better-auth.com/docs/integrations/next)

### On this page

[Create auth instance](https://www.better-auth.com/docs/integrations/remix#create-auth-instance) [Create API Route](https://www.better-auth.com/docs/integrations/remix#create-api-route) [Create a client](https://www.better-auth.com/docs/integrations/remix#create-a-client) [Example usage](https://www.better-auth.com/docs/integrations/remix#example-usage) [Sign Up](https://www.better-auth.com/docs/integrations/remix#sign-up) [Sign In](https://www.better-auth.com/docs/integrations/remix#sign-in)
