---
title: Inspecting agents and workflows with mastra dev | Mastra Local Dev Docs
url: 
description: Documentation for the Mastra local development environment for Mastra applications.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/server-db/local-dev-playground#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") Server & DBLocal Dev Playground

Copy page

# Playground

Mastra provides a local development environment where you can test your agents, workflows, and tools during development.

Start the local development server by running:

npmyarnpnpmbunMastra CLI

```nextra-code

npm run dev
```

```nextra-code

yarn run dev
```

```nextra-code

pnpm run dev
```

```nextra-code

bun run dev
```

```nextra-code

mastra dev
```

The local development server provides access to the following interfaces:

- Playground: [http://localhost:4111/](http://localhost:4111/)
- Mastra API: [http://localhost:4111/api](http://localhost:4111/api)
- OpenAPI Spec: [http://localhost:4111/openapi.json](http://localhost:4111/openapi.json)
- Swagger UI – API explorer: [http://localhost:4111/swagger-ui](http://localhost:4111/swagger-ui)

## Local Development Playground [Permalink for this section](https://mastra.ai/en/docs/server-db/local-dev-playground\#local-development-playground)

The Playground lets you interact with your agents, workflows, and tools. It provides dedicated interfaces for testing each component of your Mastra application during development and is available at: [http://localhost:4111/](http://localhost:4111/).

Getting Started With Mastra - YouTube

[Photo image of Mastra AI](https://www.youtube.com/channel/UCTYjNDUYsrt7DrwU11fdyhQ?embeds_referring_euri=https%3A%2F%2Fmastra.ai%2F)

Mastra AI

3.63K subscribers

[Getting Started With Mastra](https://www.youtube.com/watch?v=spGlcTEjuXY)

Mastra AI

Search

Info

Shopping

Tap to unmute

If playback doesn't begin shortly, try restarting your device.

You're signed out

Videos you watch may be added to the TV's watch history and influence TV recommendations. To avoid this, cancel and sign in to YouTube on your computer.

CancelConfirm

Share

Include playlist

An error occurred while retrieving sharing information. Please try again later.

Watch later

Share

Copy link

Watch on

2:06

/
•Live

•

### Agents [Permalink for this section](https://mastra.ai/en/docs/server-db/local-dev-playground\#agents)

Quickly test and debug your agents during development using the interactive chat interface in the Agent Playground.

Your browser does not support the video tag.

Key features:

- **Chat Interface**: Talk to your agent and see how it responds in real time.
- **Model Settings**: Tweak settings like temperature and top-p to see how they affect output.
- **Agent Endpoints**: See the available REST API routes your agent exposes and how to use them.
- **Agent Traces**: Step through what the agent did behind the scenes, tool calls, decisions, and more.
- **Agent Evals**: Run tests against your agent and see how well it performs.

### Workflows [Permalink for this section](https://mastra.ai/en/docs/server-db/local-dev-playground\#workflows)

Validate workflows by supplying defined inputs and visualizing each step within the Workflow Playground.

Your browser does not support the video tag.

Key features:

- **Workflow Visualization**: See your workflow as a visual graph so you can follow the steps and branches at a glance.
- **Step Inputs & Outputs**: Check the data going into and coming out of each step to see how everything flows.
- **Run Workflows**: Test your workflow with real inputs to validate the logic and debug any issues.
- **Execution JSON**: Get the full picture of a run as raw JSON—inputs, outputs, errors, and results included.
- **Workflow Traces**: Dig into a detailed breakdown of each step, including data flow, tool calls, and any errors along the way.

### Tools [Permalink for this section](https://mastra.ai/en/docs/server-db/local-dev-playground\#tools)

Quickly test and debug custom tools in isolation using the Tools Playground, without running a full agent or workflow.

Your browser does not support the video tag.

Key features:

- **Test Tools in Isolation**: Try out individual tools on their own without running a full agent or workflow.
- **Input & Responses**: Send sample inputs to see how the tool responds.
- **Tool Usage**: Find out which agents rely on this tool and how they’re using it.

### MCP Servers [Permalink for this section](https://mastra.ai/en/docs/server-db/local-dev-playground\#mcp-servers)

Explore connection details, tool usage, and IDE configuration for local MCP server development.

![MCP Servers Playground](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Flocal-dev-mcp-server-playground.a620ec23.jpg&w=3840&q=75)

Key features:

- **Connection Details**: Access the endpoints and config needed to wire up your MCP environment.
- **Available Tools**: See all tools currently published, including their names, versions, and which agents use them.
- **IDE Configuration**: Grab ready-to-use config you can drop into your local setup for testing and publishing tools.

## REST API Endpoints [Permalink for this section](https://mastra.ai/en/docs/server-db/local-dev-playground\#rest-api-endpoints)

The local development server exposes a set of REST API routes via the [Mastra Server](https://mastra.ai/docs/deployment/server-deployment), allowing you to test and interact with your agents and workflows before deployment.

For a full overview of available API routes, including agents, tools, and workflows, visit [http://localhost:4111/swagger-ui](http://localhost:4111/swagger-ui) during `mastra dev`.

## OpenAPI Specification [Permalink for this section](https://mastra.ai/en/docs/server-db/local-dev-playground\#openapi-specification)

The local development server includes an OpenAPI specification available at: [http://localhost:4111/openapi.json](http://localhost:4111/openapi.json).

To include OpenAPI documentation in your production server, enable it in the Mastra instance:

src/mastra/index.ts

```nextra-code

import { Mastra } from "@mastra/core/mastra";

export const mastra = new Mastra({
  server: {
    build: {
      openAPIDocs: true
    }
  },
});
```

## Swagger UI [Permalink for this section](https://mastra.ai/en/docs/server-db/local-dev-playground\#swagger-ui)

The local development server includes an interactive Swagger UI - API explorer available at: [http://localhost:4111/swagger-ui](http://localhost:4111/swagger-ui).

To include Swagger UI in your production server, enable it in the Mastra instance:

src/mastra/index.ts

```nextra-code

import { Mastra } from "@mastra/core/mastra";

export const mastra = new Mastra({
  server: {
    build: {
      swaggerUI: true
    },
  },
});
```

## Architecture [Permalink for this section](https://mastra.ai/en/docs/server-db/local-dev-playground\#architecture)

The local development server runs fully self-contained without external dependencies or containers. It leverages:

- **Dev Server** powered by [Hono](https://hono.dev/) for the core [Mastra Server](https://mastra.ai/docs/deployment/server).
- **In-Memory Storage** via [LibSQL](https://libsql.org/) adapters for agent memory, traces, evals, and workflow snapshots.
- **Vector Storage** using [FastEmbed](https://github.com/qdrant/fastembed) for embeddings, vector search, and semantic retrieval.

This setup lets you start developing immediately with production-like behavior, no database or vector store setup required.

## Configuration [Permalink for this section](https://mastra.ai/en/docs/server-db/local-dev-playground\#configuration)

By default, the server runs on port `4111`. You can customize the `host` and `port` through the Mastra server configuration.

src/mastra/index.ts

```nextra-code

import { Mastra } from "@mastra/core/mastra";

export const mastra = new Mastra({
  server: {
    port: 8080,
    host: "0.0.0.0",
  },
});
```

### Local HTTPS [Permalink for this section](https://mastra.ai/en/docs/server-db/local-dev-playground\#local-https)

Mastra provides a way to use a local HTTPS server for `mastra dev` (through [expo/devcert](https://github.com/expo/devcert)). When you use the `--https` flag, a private key and certificate will be created and used for your project. By default, certificates are issued for `localhost` unless you defined another `host` value.

```nextra-code

mastra dev --https
```

You can provide your own key and cert file by specifying the `server.https` option in the Mastra server configuration.

src/mastra/index.ts

```nextra-code

import { Mastra } from "@mastra/core/mastra";
import fs from 'node:fs'

export const mastra = new Mastra({
  server: {
    https: {
      key: fs.readFileSync('path/to/key.pem'),
      cert: fs.readFileSync('path/to/cert.pem')
    }
  },
});
```

When you provide both `--https` and `server.https` the latter will take precedence.

## Bundler options [Permalink for this section](https://mastra.ai/en/docs/server-db/local-dev-playground\#bundler-options)

Use `transpilePackages` to compile TypeScript packages or libraries. Use `externals` to exclude dependencies resolved at runtime, and `sourcemap` to emit readable stack traces.

src/mastra/index.ts

```nextra-code

import { Mastra } from "@mastra/core/mastra";

export const mastra = new Mastra({
  bundler: {
    transpilePackages: ["utils"],
    externals: ["ui"],
    sourcemap: true
  }
});
```

> See [Mastra Class](https://mastra.ai/en/reference/core/mastra-class) for more configuration options.

## Next steps [Permalink for this section](https://mastra.ai/en/docs/server-db/local-dev-playground\#next-steps)

- [Mastra Cloud](https://mastra.ai/docs/mastra-cloud/overview)
- [Deployment Overview](https://mastra.ai/docs/deployment/overview)
- [Mastra Client SDK](https://mastra.ai/docs/client-js/overview)

[Retrieval](https://mastra.ai/en/docs/rag/retrieval "Retrieval") [Production Server](https://mastra.ai/en/docs/server-db/production-server "Production Server")