---
title: Open API | Better Auth
url:
description: Open API reference for Better Auth.
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

# Open API

Copy MarkdownOpen in

This is a plugin that provides an Open API reference for Better Auth. It shows all endpoints added by plugins and the core. It also provides a way to test the endpoints. It uses [Scalar](https://scalar.com/) to display the Open API reference.

This plugin is still in the early stages of development. We are working on adding more features to it and filling in the gaps.

## [Installation](https://www.better-auth.com/docs/plugins/open-api#installation)

### [Add the plugin to your **auth** config](https://www.better-auth.com/docs/plugins/open-api#add-the-plugin-to-your-auth-config)

auth.ts

```
import { betterAuth } from "better-auth"
import { openAPI } from "better-auth/plugins"

export const auth = betterAuth({
    plugins: [\
        openAPI(),\
    ]
})
```

### [Navigate to `/api/auth/reference` to view the Open API reference](https://www.better-auth.com/docs/plugins/open-api#navigate-to-apiauthreference-to-view-the-open-api-reference)

Each plugin endpoints are grouped by the plugin name. The core endpoints are grouped under the `Default` group. And Model schemas are grouped under the `Models` group.

![Open API reference](https://www.better-auth.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fopen-api-reference.fd15e5db.png&w=3840&q=75&dpl=dpl_4MmBt66n3btWMfjLv1cf5raHfP4Y)

## [Usage](https://www.better-auth.com/docs/plugins/open-api#usage)

The Open API reference is generated using the [OpenAPI 3.0](https://swagger.io/specification/) specification. You can use the reference to generate client libraries, documentation, and more.

The reference is generated using the [Scalar](https://scalar.com/) library. Scalar provides a way to view and test the endpoints. You can test the endpoints by clicking on the `Try it out` button and providing the required parameters.

![Open API reference](https://www.better-auth.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fopen-api-reference.fd15e5db.png&w=3840&q=75&dpl=dpl_4MmBt66n3btWMfjLv1cf5raHfP4Y)

### [Generated Schema](https://www.better-auth.com/docs/plugins/open-api#generated-schema)

To get the generated Open API schema directly as JSON, you can do `auth.api.generateOpenAPISchema()`. This will return the Open API schema as a JSON object.

```
import { auth } from "~/lib/auth"

const openAPISchema = await auth.api.generateOpenAPISchema()
console.log(openAPISchema)
```

### [Using Scalar with Multiple Sources](https://www.better-auth.com/docs/plugins/open-api#using-scalar-with-multiple-sources)

If you're using Scalar for your API documentation, you can add Better Auth as an additional source alongside your main API:

When using Hono with Scalar for OpenAPI documentation, you can integrate Better Auth by adding it as a source:

```
app.get("/docs", Scalar({
  pageTitle: "API Documentation",
  sources: [\
    { url: "/api/open-api", title: "API" },\
    // Better Auth schema generation endpoint\
    { url: "/api/auth/open-api/generate-schema", title: "Auth" },\
  ],
}));
```

## [Configuration](https://www.better-auth.com/docs/plugins/open-api#configuration)

`path` \- The path where the Open API reference is served. Default is `/api/auth/reference`. You can change it to any path you like, but keep in mind that it will be appended to the base path of your auth server.

`disableDefaultReference` \- If set to `true`, the default Open API reference UI by Scalar will be disabled. Default is `false`.

This allows you to display both your application's API and Better Auth's authentication endpoints in a unified documentation interface.

`theme` \- Allows you to change the theme of the OpenAPI reference page. Default is `default`.

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/open-api.mdx)

[Previous Page\\
\\
One-Time Token](https://www.better-auth.com/docs/plugins/one-time-token) [Next Page\\
\\
JWT](https://www.better-auth.com/docs/plugins/jwt)

### On this page

[Installation](https://www.better-auth.com/docs/plugins/open-api#installation) [Add the plugin to your **auth** config](https://www.better-auth.com/docs/plugins/open-api#add-the-plugin-to-your-auth-config) [Navigate to `/api/auth/reference` to view the Open API reference](https://www.better-auth.com/docs/plugins/open-api#navigate-to-apiauthreference-to-view-the-open-api-reference) [Usage](https://www.better-auth.com/docs/plugins/open-api#usage) [Generated Schema](https://www.better-auth.com/docs/plugins/open-api#generated-schema) [Using Scalar with Multiple Sources](https://www.better-auth.com/docs/plugins/open-api#using-scalar-with-multiple-sources) [Configuration](https://www.better-auth.com/docs/plugins/open-api#configuration)
