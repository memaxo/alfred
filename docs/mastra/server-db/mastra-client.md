---
title: Mastra Client SDK | Mastra Docs
url: 
description: Learn how to set up and use the Mastra Client SDK
language: en
---
[Skip to Content](https://mastra.ai/en/docs/server-db/mastra-client#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Server & DB](https://mastra.ai/en/docs/server-db/local-dev-playground "Server & DB") Mastra Client

Copy page

# Mastra Client SDK

The Mastra Client SDK provides a simple and type-safe interface for interacting with your [Mastra Server](https://mastra.ai/docs/deployment/server) from your client environment.

## Prerequisites [Permalink for this section](https://mastra.ai/en/docs/server-db/mastra-client\#prerequisites)

To ensure smooth local development, make sure you have:

- Node.js `v18` or higher
- TypeScript `v4.7` or higher (if using TypeScript)
- Your local Mastra server running (typically on port `4111`)

## Usage [Permalink for this section](https://mastra.ai/en/docs/server-db/mastra-client\#usage)

The Mastra Client SDK is designed for browser environments and uses the native `fetch` API for making HTTP requests to your Mastra server.

## Installation [Permalink for this section](https://mastra.ai/en/docs/server-db/mastra-client\#installation)

To use the Mastra Client SDK, install the required dependencies:

npmyarnpnpmbun

### npm

```nextra-code

npm install @mastra/client-js@latest
```

### yarn

```nextra-code

yarn add @mastra/client-js@latest
```

### pnpm

```nextra-code

pnpm add @mastra/client-js@latest
```

### bun

```nextra-code

bun add @mastra/client-js@latest
```

### Initialize the `MastraClient` [Permalink for this section](https://mastra.ai/en/docs/server-db/mastra-client\#initialize-the-mastraclient)

Once initialized with a `baseUrl`, `MastraClient` exposes a type-safe interface for calling agents, tools, and workflows.

lib/mastra-client.ts

```nextra-code [counter-reset:line]

import { MastraClient } from "@mastra/client-js";

export const mastraClient = new MastraClient({
  baseUrl: process.env.MASTRA_API_URL || "http://localhost:4111"
});
```

## Core APIs [Permalink for this section](https://mastra.ai/en/docs/server-db/mastra-client\#core-apis)

The Mastra Client SDK exposes all resources served by the Mastra Server

- **[Agents](https://mastra.ai/reference/client-js/agents)**: Generate responses and stream conversations.
- **[Memory](https://mastra.ai/reference/client-js/memory)**: Manage conversation threads and message history.
- **[Tools](https://mastra.ai/reference/client-js/tools)**: Executed and managed tools.
- **[Workflows](https://mastra.ai/reference/client-js/workflows)**: Trigger workflows and track their execution.
- **[Vectors](https://mastra.ai/reference/client-js/vectors)**: Use vector embeddings for semantic search.
- **[Logs](https://mastra.ai/reference/client-js/logs)**: View logs and debug system behavior.
- **[Telemetry](https://mastra.ai/reference/client-js/telemetry)**: Monitor app performance and trace activity.

## Generating responses [Permalink for this section](https://mastra.ai/en/docs/server-db/mastra-client\#generating-responses)

Call `.generate()` with an array of message objects that include `role` and `content`:

```nextra-code [counter-reset:line]

import { mastraClient } from "lib/mastra-client";

const testAgent = async () => {
  try {
    const agent = mastraClient.getAgent("testAgent");

    const response = await agent.generate({
      messages: [\
        {\
          role: "user",\
          content: "Hello"\
        }\
      ]
    });

    console.log(response.text);
  } catch (error) {
    return "Error occurred while generating response";
  }
};
```

> See [.generate()](https://mastra.ai/en/reference/client-js/agents#generate-response) for more information.

## Streaming responses [Permalink for this section](https://mastra.ai/en/docs/server-db/mastra-client\#streaming-responses)

Use `.stream()` for real-time responses with an array of message objects that include `role` and `content`:

```nextra-code [counter-reset:line]

import { mastraClient } from "lib/mastra-client";

const testAgent = async () => {
  try {
    const agent = mastraClient.getAgent("testAgent");

    const stream = await agent.stream({
      messages: [\
        {\
          role: "user",\
          content: "Hello"\
        }\
      ]
    });

    stream.processDataStream({
      onTextPart: (text) => {
        console.log(text);
      }
    });
  } catch (error) {
    return "Error occurred while generating response";
  }
};
```

> See [.stream()](https://mastra.ai/en/reference/client-js/agents#stream-response) for more information.

## Configuration options [Permalink for this section](https://mastra.ai/en/docs/server-db/mastra-client\#configuration-options)

`MastraClient` accepts optional parameters like `retries`, `backoffMs`, and `headers` to control request behavior. These parameters are useful for controlling retry behavior and including diagnostic metadata.

lib/mastra-client.ts

```nextra-code [counter-reset:line]

import { MastraClient } from "@mastra/client-js";

export const mastraClient = new MastraClient({
  // ...
  retries: 3,
  backoffMs: 300,
  maxBackoffMs: 5000,
  headers: {
    "X-Development": "true",
  },
});
```

> See [MastraClient](https://mastra.ai/en/reference/client-js/mastra-client) for more configuration options.

## Adding request cancelling [Permalink for this section](https://mastra.ai/en/docs/server-db/mastra-client\#adding-request-cancelling)

`MastraClient` supports request cancellation using the standard Node.js `AbortSignal` API. Useful for canceling in-flight requests, such as when users abort an operation or to clean up stale network calls.

Pass an `AbortSignal` to the client constructor to enable cancellation across all requests.

lib/mastra-client.ts

```nextra-code [counter-reset:line]

import { MastraClient } from "@mastra/client-js";

export const controller = new AbortController();

export const mastraClient = new MastraClient({
  baseUrl: process.env.MASTRA_API_URL || "http://localhost:4111",
  abortSignal: controller.signal
});
```

### Using the `AbortController` [Permalink for this section](https://mastra.ai/en/docs/server-db/mastra-client\#using-the-abortcontroller)

Calling `.abort()` will cancel any ongoing requests tied to that signal.

```nextra-code [counter-reset:line]

import { mastraClient, controller } from "lib/mastra-client";

const handleAbort = () => {
  controller.abort();
};
```

## Client tools [Permalink for this section](https://mastra.ai/en/docs/server-db/mastra-client\#client-tools)

Define tools directly in client-side applications using the `createTool()` function. Pass them to agents via the `clientTools` parameter in `.generate()` or `.stream()` calls.

This lets agents trigger browser-side functionality such as DOM manipulation, local storage access, or other Web APIs, enabling tool execution in the user’s environment rather than on the server.

```nextra-code [counter-reset:line]

import { createTool } from '@mastra/client-js';
import { z } from 'zod';

const handleClientTool = async () => {
  try {
    const agent = mastraClient.getAgent("colorAgent");

    const colorChangeTool = createTool({
      id: "color-change-tool",
      description: "Changes the HTML background color",
      inputSchema: z.object({
        color: z.string()
      }),
      outputSchema: z.object({
        success: z.boolean()
      }),
      execute: async ({ context }) => {
        const { color } = context

        document.body.style.backgroundColor = color;
        return { success: true };
      }
    });

    const response = await agent.generate({
      messages: "Change the background to blue",
      clientTools: { colorChangeTool }
    });

    console.log(response);
  } catch (error) {
    console.error(error);
  }
};
```

### Client tool’s agent [Permalink for this section](https://mastra.ai/en/docs/server-db/mastra-client\#client-tools-agent)

This is a standard Mastra [agent](https://mastra.ai/en/docs/agents/overview#creating-an-agent) configured to return hex color codes, intended to work with the browser-based client tool defined above.

src/mastra/agents/color-agent

```nextra-code [counter-reset:line]

import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const colorAgent = new Agent({
  name: "test-agent",
  instructions: `You are a helpful CSS assistant.
  You can change the background color of web pages.
  Respond with a hex reference for the color requested by the user`,
  model: openai("gpt-4o-mini")
});
```

## Server-side environments [Permalink for this section](https://mastra.ai/en/docs/server-db/mastra-client\#server-side-environments)

You can also use `MastraClient` in server-side environments such as API routes, serverless functions or actions. The usage will broadly remain the same but you may need to recreate the response to your client:

```nextra-code [counter-reset:line]

export async function action() {
  const agent = mastraClient.getAgent("testAgent");

  const stream = await agent.stream({
    messages: [{ role: "user", content: "Hello" }]
  });

  return new Response(stream.body);
}
```

## Best practices [Permalink for this section](https://mastra.ai/en/docs/server-db/mastra-client\#best-practices)

1. **Error Handling**: Implement proper [error handling](https://mastra.ai/reference/client-js/error-handling) for development scenarios.
2. **Environment Variables**: Use environment variables for configuration.
3. **Debugging**: Enable detailed [logging](https://mastra.ai/reference/client-js/logs) when needed.
4. **Performance**: Monitor application performance, [telemetry](https://mastra.ai/reference/client-js/telemetry) and traces.

[Snapshots](https://mastra.ai/en/docs/server-db/snapshots "Snapshots") [Overview](https://mastra.ai/en/docs/deployment/overview "Overview")