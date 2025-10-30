---
title: Tools Overview | Tools & MCP | Mastra Docs
url: 
description: Understand what tools are in Mastra, how to add them to agents, and best practices for designing effective tools.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/tools-mcp/overview#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") Tools & MCPOverview

Copy page

# Tools Overview

Tools are functions that agents can execute to perform specific tasks or access external information. They extend an agent’s capabilities beyond simple text generation, allowing interaction with APIs, databases, or other systems.

Each tool typically defines:

- **Inputs:** What information the tool needs to run (defined with an `inputSchema`, often using Zod).
- **Outputs:** The structure of the data the tool returns (defined with an `outputSchema`).
- **Execution Logic:** The code that performs the tool’s action.
- **Description:** Text that helps the agent understand what the tool does and when to use it.

## Creating Tools [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/overview\#creating-tools)

In Mastra, you create tools using the [`createTool`](https://mastra.ai/reference/tools/create-tool) function from the `@mastra/core/tools` package.

src/mastra/tools/weatherInfo.ts

```nextra-code

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const getWeatherInfo = async (city: string) => {
  // Replace with an actual API call to a weather service
  console.log(`Fetching weather for ${city}...`);
  // Example data structure
  return { temperature: 20, conditions: "Sunny" };
};

export const weatherTool = createTool({
  id: "Get Weather Information",
  description: `Fetches the current weather information for a given city`,
  inputSchema: z.object({
    city: z.string().describe("City name"),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    conditions: z.string(),
  }),
  execute: async ({ context: { city } }) => {
    console.log("Using tool to fetch weather information for", city);
    return await getWeatherInfo(city);
  },
});
```

This example defines a `weatherTool` with an input schema for the city, an output schema for the weather data, and an `execute` function that contains the tool’s logic.

When creating tools, keep tool descriptions simple and focused on **what** the tool does and **when** to use it, emphasizing its primary use case. Technical details belong in the parameter schemas, guiding the agent on _how_ to use the tool correctly with descriptive names, clear descriptions, and explanations of default values.

## Adding Tools to an Agent [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/overview\#adding-tools-to-an-agent)

To make tools available to an agent, you configure them in the agent’s definition. Mentioning available tools and their general purpose in the agent’s system prompt can also improve tool usage. For detailed steps and examples, see the guide on [Using Tools and MCP with Agents](https://mastra.ai/docs/agents/using-tools-and-mcp#add-tools-to-an-agent).

## Compatibility Layer for Tool Schemas [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/overview\#compatibility-layer-for-tool-schemas)

Different models interpret schemas differently. Some error when certain schema properties are passed and some ignore certain schema properties but don’t throw an error. Mastra adds a compatibility layer for tool schemas, ensuring tools work consistently across different model providers and that the schema constraints are respected.

Some providers that we include this layer for:

- **Google Gemini & Anthropic:** Remove unsupported schema properties and append relevant constraints to the tool description.
- **OpenAI (including reasoning models):** Strip or adapt schema fields that are ignored or unsupported, and add instructions to the description for agent guidance.
- **DeepSeek & Meta:** Apply similar compatibility logic to ensure schema alignment and tool usability.

This approach makes tool usage more reliable and model-agnostic for both custom and MCP tools.

## Testing tools locally [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/overview\#testing-tools-locally)

There are two ways to run and test tools.

### Mastra Playground [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/overview\#mastra-playground)

With the Mastra Dev Server running you can test a tool from the Mastra Playground by visiting [http://localhost:4111/tools](http://localhost:4111/tools) in your browser.

> For more information, see the [Local Dev Playground](https://mastra.ai/docs/server-db/local-dev-playground) documentation.

### Command line [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/overview\#command-line)

Invoke a tool using `.execute()`.

src/test-tool.ts

```nextra-code [counter-reset:line]

import { RuntimeContext } from "@mastra/core/runtime-context";
import { testTool } from "./mastra/tools/test-tool";

const runtimeContext = new RuntimeContext();

const result = await testTool.execute({
  context: {
    value: "foo"
  },
  runtimeContext
});

console.log(result);
```

> See [createTool()](https://mastra.ai/en/reference/tools/create-tool) for more information.

To test this tool, run the following:

```nextra-code

npx tsx src/test-tool.ts
```

[Workflow Streaming](https://mastra.ai/en/docs/streaming/workflow-streaming "Workflow Streaming") [MCP Overview](https://mastra.ai/en/docs/tools-mcp/mcp-overview "MCP Overview")