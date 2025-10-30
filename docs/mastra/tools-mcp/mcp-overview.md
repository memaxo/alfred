---
title: MCP Overview | Tools & MCP | Mastra Docs
url: 
description: Learn about the Model Context Protocol (MCP), how to use third-party tools via MCPClient, connect to registries, and share your own tools using MCPServer.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/tools-mcp/mcp-overview#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Tools & MCP](https://mastra.ai/en/docs/tools-mcp/overview "Tools & MCP") MCP Overview

Copy page

# MCP Overview

Mastra supports the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction), an open standard for connecting AI agents to external tools and resources. It serves as a universal plugin system, enabling agents to call tools regardless of language or hosting environment.

Mastra can also be used to author MCP servers, exposing agents, tools, and other structured resources via the MCP interface. These can then be accessed by any system or agent that supports the protocol.

Mastra currently supports two MCP classes:

1. **`MCPClient`**: Connects to one or many MCP servers to access their tools, resources, prompts, and handle elicitation requests.
2. **`MCPServer`**: Exposes Mastra tools, agents, workflows, prompts, and resources to MCP compatible clients.

## Getting started [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/mcp-overview\#getting-started)

To use MCP, install the required dependency:

```nextra-code

npm install @mastra/mcp@latest
```

## Configuring `MCPClient` [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/mcp-overview\#configuring-mcpclient)

The `MCPClient` connects Mastra primitives to external MCP servers, which can be local packages (invoked using `npx`) or remote HTTP(S) endpoints. Each server must be configured with either a `command` or a `url`, depending on how it’s hosted.

src/mastra/mcp/test-mcp-client.ts

```nextra-code [counter-reset:line]

import { MCPClient } from "@mastra/mcp";

export const testMcpClient = new MCPClient({
  id: "test-mcp-client",
  servers: {
    wikipedia: {
      command: "npx",
      args: ["-y", "wikipedia-mcp"]
    },
    weather: {
      url: new URL(`https://server.smithery.ai/@smithery-ai/national-weather-service/mcp?api_key=${process.env.SMITHERY_API_KEY}`)
    },
  }
});
```

> See [MCPClient](https://mastra.ai/en/reference/tools/mcp-client) for a full list of configuration options.

## Using `MCPClient` with an agent [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/mcp-overview\#using-mcpclient-with-an-agent)

To use tools from an MCP server in an agent, import your `MCPClient` and call `.getTools()` in the `tools` parameter. This loads from the defined MCP servers, making them available to the agent.

src/mastra/agents/test-agent.ts

```nextra-code [counter-reset:line]

import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

import { testMcpClient } from "../mcp/test-mcp-client";

export const testAgent = new Agent({
  name: "Test Agent",
  description: "You are a helpful AI assistant",
  instructions: `
      You are a helpful assistant that has access to the following MCP Servers.
      - Wikipedia MCP Server
      - US National Weather Service

      Answer questions using the information you find using the MCP Servers.`,
  model: openai("gpt-4o-mini"),
  tools: await testMcpClient.getTools()
});
```

> See the [Agent Class](https://mastra.ai/en/reference/agents/agent) for a full list of configuration options.

## Configuring `MCPServer` [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/mcp-overview\#configuring-mcpserver)

To expose agents, tools, and workflows from your Mastra application to external systems over HTTP(S) use the `MCPServer` class. This makes them accessible to any system or agent that supports the protocol.

src/mastra/mcp/test-mcp-server.ts

```nextra-code [counter-reset:line]

import { MCPServer } from "@mastra/mcp";

import { testAgent } from "../agents/test-agent";
import { testWorkflow } from "../workflows/test-workflow";
import { testTool } from "../tools/test-tool";

export const testMcpServer = new MCPServer({
  id: "test-mcp-server",
  name: "Test Server",
  version: "1.0.0",
  agents: { testAgent },
  tools: { testTool },
  workflows: { testWorkflow }
});
```

> See [MCPServer](https://mastra.ai/en/reference/tools/mcp-server) for a full list of configuration options.

## Registering an `MCPServer` [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/mcp-overview\#registering-an-mcpserver)

To make an MCP server available to other systems or agents that support the protocol, register it in the main `Mastra` instance using `mcpServers`.

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";

import { testMcpServer } from "./mcp/test-mcp-server";

export const mastra = new Mastra({
  // ...
  mcpServers: { testMcpServer }
});
```

## Static and dynamic tools [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/mcp-overview\#static-and-dynamic-tools)

`MCPClient` offers two approaches to retrieving tools from connected servers, suitable for different application architectures:

| Feature | Static Configuration ( `await mcp.getTools()`) | Dynamic Configuration ( `await mcp.getToolsets()`) |
| --- | --- | --- |
| **Use Case** | Single-user, static config (e.g., CLI tool) | Multi-user, dynamic config (e.g., SaaS app) |
| **Configuration** | Fixed at agent initialization | Per-request, dynamic |
| **Credentials** | Shared across all uses | Can vary per user/request |
| **Agent Setup** | Tools added in `Agent` constructor | Tools passed in `.generate()` or `.stream()` options |

### Static tools [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/mcp-overview\#static-tools)

Use the `.getTools()` method to fetch tools from all configured MCP servers. This is suitable when configuration (such as API keys) is static and consistent across users or requests. Call it once and pass the result to the `tools` property when defining your agent.

> See [getTools()](https://mastra.ai/en/reference/tools/mcp-client#gettools) for more information.

src/mastra/agents/test-agent.ts

```nextra-code [counter-reset:line]

import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

import { testMcpClient } from "../mcp/test-mcp-client";

export const testAgent = new Agent({
  // ...
  tools: await testMcpClient.getTools()
});
```

### Dynamic tools [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/mcp-overview\#dynamic-tools)

Use the `.getToolsets()` method when tool configuration may vary by request or user, such as in a multi-tenant system where each user provides their own API key. This method returns toolsets that can be passed to the `toolsets` option in the agent’s `.generate()` or `.stream()` calls.

```nextra-code [counter-reset:line]

import { MCPClient } from "@mastra/mcp";
import { mastra } from "./mastra";

async function handleRequest(userPrompt: string, userApiKey: string) {
  const userMcp = new MCPClient({
    servers: {
      weather: {
        url: new URL("http://localhost:8080/mcp"),
        requestInit: {
          headers: {
            Authorization: `Bearer ${userApiKey}`
          }
        }
      }
    }
  });

  const agent = mastra.getAgent("testAgent");

  const response = await agent.generate(userPrompt, {
    toolsets: await userMcp.getToolsets()
  });

  await userMcp.disconnect();

  return Response.json({
    data: response.text
  });
}
```

> See [getToolsets()](https://mastra.ai/en/reference/tools/mcp-client#gettoolsets) for more information.

## Connecting to an MCP registry [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/mcp-overview\#connecting-to-an-mcp-registry)

MCP servers can be discovered through registries. Here’s how to connect to some popular ones using `MCPClient`:

Klavis AImcp.runComposio.devSmithery.aiAmpersand

### Klavis AI

[Klavis AI](https://klavis.ai/) provides hosted, enterprise-authenticated, high-quality MCP servers.

```nextra-code

import { MCPClient } from "@mastra/mcp";

const mcp = new MCPClient({
  servers: {
    salesforce: {
      url: new URL("https://salesforce-mcp-server.klavis.ai/mcp/?instance_id={private-instance-id}"),
    },
    hubspot: {
      url: new URL("https://hubspot-mcp-server.klavis.ai/mcp/?instance_id={private-instance-id}"),
    },
  },
});
```

Klavis AI offers enterprise-grade authentication and security for production deployments.

For more details on how to integrate Mastra with Klavis, check out their [documentation](https://docs.klavis.ai/documentation/ai-platform-integration/mastra).

### mcp.run

[mcp.run](https://www.mcp.run/) provides pre-authenticated, managed MCP servers. Tools are grouped into Profiles, each with a unique, signed URL.

```nextra-code

import { MCPClient } from "@mastra/mcp";

const mcp = new MCPClient({
  servers: {
    marketing: { // Example profile name
      url: new URL(process.env.MCP_RUN_SSE_URL!), // Get URL from mcp.run profile
    },
  },
});
```

> **Important:** Treat the mcp.run SSE URL like a password. Store it securely, for example, in an environment variable.
>
> .env
>
> ```nextra-code
>
> MCP_RUN_SSE_URL=https://www.mcp.run/api/mcp/sse?nonce=...
> ```

### Composio.dev

[Composio.dev](https://composio.dev/) offers a registry of [SSE-based MCP servers](https://mcp.composio.dev/). You can use the SSE URL generated for tools like Cursor directly.

```nextra-code

import { MCPClient } from "@mastra/mcp";

const mcp = new MCPClient({
  servers: {
    googleSheets: {
      url: new URL("https://mcp.composio.dev/googlesheets/[private-url-path]"),
    },
    gmail: {
      url: new URL("https://mcp.composio.dev/gmail/[private-url-path]"),
    },
  },
});
```

Authentication with services like Google Sheets often happens interactively through the agent conversation.

_Note: Composio URLs are typically tied to a single user account, making them best suited for personal automation rather than multi-tenant applications._

### Smithery.ai

[Smithery.ai](https://smithery.ai/) provides a registry accessible via their CLI.

```nextra-code

// Unix/Mac
import { MCPClient } from "@mastra/mcp";

const mcp = new MCPClient({
  servers: {
    sequentialThinking: {
      command: "npx",
      args: [\
        "-y",\
        "@smithery/cli@latest",\
        "run",\
        "@smithery-ai/server-sequential-thinking",\
        "--config",\
        "{}",\
      ],
    },
  },
});
```

```nextra-code

// Windows
import { MCPClient } from "@mastra/mcp";

const mcp = new MCPClient({
  servers: {
    sequentialThinking: {
      command: "npx",
      args: [\
        "-y",\
        "@smithery/cli@latest",\
        "run",\
        "@smithery-ai/server-sequential-thinking",\
        "--config",\
        "{}",\
      ],
    },
  },
});
```

### Ampersand

[Ampersand](https://withampersand.com/?utm_source=mastra-docs) offers an [MCP Server](https://docs.withampersand.com/mcp) that allows you to connect your agent to 150+ integrations with SaaS products like Salesforce, Hubspot, and Zendesk.

```nextra-code


// MCPClient with Ampersand MCP Server using SSE
export const mcp = new MCPClient({
    servers: {
    "@amp-labs/mcp-server": {
      "url": `https://mcp.withampersand.com/v1/sse?${new URLSearchParams({
        apiKey: process.env.AMPERSAND_API_KEY,
        project: process.env.AMPERSAND_PROJECT_ID,
        integrationName: process.env.AMPERSAND_INTEGRATION_NAME,
        groupRef: process.env.AMPERSAND_GROUP_REF
      })}`
    }
  }
});

```

```nextra-code

// If you prefer to run the MCP server locally:

import { MCPClient } from "@mastra/mcp";

// MCPClient with Ampersand MCP Server using stdio transport
export const mcp = new MCPClient({
    servers: {
      "@amp-labs/mcp-server": {
        command: "npx",
        args: [\
          "-y",\
          "@amp-labs/mcp-server@latest",\
          "--transport",\
          "stdio",\
          "--project",\
          process.env.AMPERSAND_PROJECT_ID,\
          "--integrationName",\
          process.env.AMPERSAND_INTEGRATION_NAME,\
          "--groupRef",\
          process.env.AMPERSAND_GROUP_REF, // optional\
        ],
        env: {
          AMPERSAND_API_KEY: process.env.AMPERSAND_API_KEY,
        },
      },
    },
});
```

As an alternative to MCP, Ampersand’s AI SDK also has an adapter for Mastra, so you can [directly import Ampersand tools](https://docs.withampersand.com/ai-sdk#use-with-mastra) for your agent to access.

## Related [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/mcp-overview\#related)

- [Using Tools and MCP](https://mastra.ai/en/docs/agents/using-tools-and-mcp)
- [MCPClient](https://mastra.ai/en/reference/tools/mcp-client)
- [MCPServer](https://mastra.ai/en/reference/tools/mcp-server)

[Overview](https://mastra.ai/en/docs/tools-mcp/overview "Overview") [Runtime Context](https://mastra.ai/en/docs/tools-mcp/runtime-context "Runtime Context")