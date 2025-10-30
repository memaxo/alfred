---
title: API | Better Auth
url: 
description: Better Auth API.
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

# API

Copy MarkdownOpen in

When you create a new Better Auth instance, it provides you with an `api` object. This object exposes every endpoint that exists in your Better Auth instance. And you can use this to interact with Better Auth server side.

Any endpoint added to Better Auth, whether from plugins or the core, will be accessible through the `api` object.

## [Calling API Endpoints on the Server](https://www.better-auth.com/docs/concepts/api\#calling-api-endpoints-on-the-server)

To call an API endpoint on the server, import your `auth` instance and call the endpoint using the `api` object.

server.ts

```
import { betterAuth } from "better-auth";
import { headers } from "next/headers";

export const auth = betterAuth({
    //...
})

// calling get session on the server
await auth.api.getSession({
    headers: await headers() // some endpoints might require headers
})
```

### [Body, Headers, Query](https://www.better-auth.com/docs/concepts/api\#body-headers-query)

Unlike the client, the server needs the values to be passed as an object with the key `body` for the body, `headers` for the headers, and `query` for query parameters.

server.ts

```
await auth.api.getSession({
    headers: await headers()
})

await auth.api.signInEmail({
    body: {
        email: "john@doe.com",
        password: "password"
    },
    headers: await headers() // optional but would be useful to get the user IP, user agent, etc.
})

await auth.api.verifyEmail({
    query: {
        token: "my_token"
    }
})
```

Better Auth API endpoints are built on top of [better-call](https://github.com/bekacru/better-call), a tiny web framework that lets you call REST API endpoints as if they were regular functions and allows us to easily infer client types from the server.

### [Getting `headers` and `Response` Object](https://www.better-auth.com/docs/concepts/api\#getting-headers-and-response-object)

When you invoke an API endpoint on the server, it will return a standard JavaScript object or array directly as it's just a regular function call.

But there are times when you might want to get the `headers` or the `Response` object instead. For example, if you need to get the cookies or the headers.

#### [Getting `headers`](https://www.better-auth.com/docs/concepts/api\#getting-headers)

To get the `headers`, you can pass the `returnHeaders` option to the endpoint.

```
const { headers, response } = await auth.api.signUpEmail({
	returnHeaders: true,
	body: {
		email: "john@doe.com",
		password: "password",
		name: "John Doe",
	},
});
```

The `headers` will be a `Headers` object, which you can use to get the cookies or the headers.

```
const cookies = headers.get("set-cookie");
const headers = headers.get("x-custom-header");
```

#### [Getting `Response` Object](https://www.better-auth.com/docs/concepts/api\#getting-response-object)

To get the `Response` object, you can pass the `asResponse` option to the endpoint.

server.ts

```
const response = await auth.api.signInEmail({
    body: {
        email: "",
        password: ""
    },
    asResponse: true
})
```

### [Error Handling](https://www.better-auth.com/docs/concepts/api\#error-handling)

When you call an API endpoint on the server, it will throw an error if the request fails. You can catch the error and handle it as you see fit. The error instance is an instance of `APIError`.

server.ts

```
import { APIError } from "better-auth/api";

try {
    await auth.api.signInEmail({
        body: {
            email: "",
            password: ""
        }
    })
} catch (error) {
    if (error instanceof APIError) {
        console.log(error.message, error.status)
    }
}
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/api.mdx)

[Previous Page\\
\\
Basic Usage](https://www.better-auth.com/docs/basic-usage) [Next Page\\
\\
CLI](https://www.better-auth.com/docs/concepts/cli)

### On this page

[Calling API Endpoints on the Server](https://www.better-auth.com/docs/concepts/api#calling-api-endpoints-on-the-server) [Body, Headers, Query](https://www.better-auth.com/docs/concepts/api#body-headers-query) [Getting `headers` and `Response` Object](https://www.better-auth.com/docs/concepts/api#getting-headers-and-response-object) [Getting `headers`](https://www.better-auth.com/docs/concepts/api#getting-headers) [Getting `Response` Object](https://www.better-auth.com/docs/concepts/api#getting-response-object) [Error Handling](https://www.better-auth.com/docs/concepts/api#error-handling)