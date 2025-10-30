---
title: Create A Mastra Production Server
url: 
description: Learn how to configure and deploy a production-ready Mastra server with custom settings for APIs, CORS, and more
language: en
---
[Skip to Content](https://mastra.ai/en/docs/server-db/production-server#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Server & DB](https://mastra.ai/en/docs/server-db/local-dev-playground "Server & DB") Production Server

Copy page

# Create a Mastra Production Server

When deploying your Mastra application to production, it runs as an HTTP server that exposes your agents, workflows, and other functionality as API endpoints. This page covers how to configure and customize the server for a production environment.

## Server architecture [Permalink for this section](https://mastra.ai/en/docs/server-db/production-server\#server-architecture)

Mastra uses [Hono](https://hono.dev/) as its underlying HTTP server framework. When you build a Mastra application using `mastra build`, it generates a Hono-based HTTP server in the `.mastra` directory.

The server provides:

- API endpoints for all registered agents
- API endpoints for all registered workflows
- Custom API route support
- Custom middleware support
- Configuration of timeout
- Configuration of port
- Configuration of body limit

See the [Middleware](https://mastra.ai/docs/server-db/middleware) and
[Custom API Routes](https://mastra.ai/docs/server-db/custom-api-routes) pages for details on
adding additional server behaviour.

## Server configuration [Permalink for this section](https://mastra.ai/en/docs/server-db/production-server\#server-configuration)

You can configure server `port` and `timeout` in the Mastra instance.

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";

export const mastra = new Mastra({
  // ...
  server: {
    port: 3000, // Defaults to 4111
    timeout: 10000, // Defaults to 30000 (30s)
  },
});
```

The `method` option can be one of `"GET"`, `"POST"`, `"PUT"`,
`"DELETE"` or `"ALL"`. Using `"ALL"` will cause the handler to be
invoked for any HTTP method that matches the path.

## TypeScript configuration [Permalink for this section](https://mastra.ai/en/docs/server-db/production-server\#typescript-configuration)

Mastra requires `module` and `moduleResolution` values that support modern Node.js versions. Older settings like `CommonJS` or `node` are incompatible with Mastra’s packages and will cause resolution errors.

tsconfig.json

```nextra-code

{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "outDir": "dist"
  },
  "include": [\
    "src/**/*"\
  ]
}
```

> This TypeScript configuration is optimized for Mastra projects, using modern module resolution and strict type checking.

## CORS configuration [Permalink for this section](https://mastra.ai/en/docs/server-db/production-server\#cors-configuration)

Mastra allows you to configure CORS (Cross-Origin Resource Sharing) settings for your server.

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";

export const mastra = new Mastra({
  // ...
  server: {
    cors: {
      origin: ["https://example.com"], // Allow specific origins or '*' for all
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: false,
    },
  },
});
```

[Local Dev Playground](https://mastra.ai/en/docs/server-db/local-dev-playground "Local Dev Playground") [Middleware](https://mastra.ai/en/docs/server-db/middleware "Middleware")