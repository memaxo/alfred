---
title: Using Tools | Agents | Mastra Docs
url: 
description: Learn how to create tools and add them to agents to extend capabilities beyond text generation.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/agents/using-tools#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Agents](https://mastra.ai/en/docs/agents/overview "Agents") Using Tools

Copy page

# Using Tools

Agents use tools to call APIs, query databases, or run custom functions from your codebase. [Tools](https://mastra.ai/en/docs/tools-mcp/overview) give agents capabilities beyond language generation by providing structured access to data and performing clearly defined operations. You can also load tools from remote [MCP servers](https://mastra.ai/en/docs/tools-mcp/mcp-overview) to expand an agent’s capabilities.

## When to use tools [Permalink for this section](https://mastra.ai/en/docs/agents/using-tools\#when-to-use-tools)

Use tools when an agent needs additional context or information from remote resources, or when it needs to run code that performs a specific operation. This includes tasks a model can’t reliably handle on its own, such as fetching live data or returning consistent, well defined outputs.

## Creating a tool [Permalink for this section](https://mastra.ai/en/docs/agents/using-tools\#creating-a-tool)

This example shows how to create a tool that fetches weather data from an API. When the agent calls the tool, it provides the required input as defined by the tool’s `inputSchema`. The tool accesses this data through its `context` argument, which in this example includes the `location` used in the weather API query.

src/mastra/tools/weather-tool.ts

```nextra-code [counter-reset:line]

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const weatherTool = createTool({
  id: "weather-tool",
  description: "Fetches weather for a location",
  inputSchema: z.object({
    location: z.string()
  }),
  outputSchema: z.object({
    weather: z.string()
  }),
  execute: async ({ context }) => {
    const { location } = context;

    const response = await fetch(`https://wttr.in/${location}?format=3`);
    const weather = await response.text();

    return { weather };
  }
});
```

## Adding tools to an agent [Permalink for this section](https://mastra.ai/en/docs/agents/using-tools\#adding-tools-to-an-agent)

To make a tool available to an agent, add it to the `tools` option and reference it by name in the agent’s instructions.

src/mastra/agents/weather-agent.ts

```nextra-code [counter-reset:line]

import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { weatherTool } from "../tools/weather-tool";

export const weatherAgent = new Agent({
  name: "weather-agent",
  instructions: `
      You are a helpful weather assistant.
      Use the weatherTool to fetch current weather data.`,
  model: openai("gpt-4o-mini"),
  tools: { weatherTool }
});
```

## Calling an agent [Permalink for this section](https://mastra.ai/en/docs/agents/using-tools\#calling-an-agent)

The agent uses the tool’s `inputSchema` to infer what data the tool expects. In this case, it extracts `London` as the `location` from the message and makes it available to the tool’s context.

src/test-tool.ts

```nextra-code [counter-reset:line]

import { mastra } from "./mastra";

const agent = mastra.getAgent("weatherAgent");

const result = await agent.generate("What's the weather in London?");
```

## Using multiple tools [Permalink for this section](https://mastra.ai/en/docs/agents/using-tools\#using-multiple-tools)

An agent can use multiple tools to handle more complex tasks by delegating specific parts to individual tools. The agent decides which tools to use based on the user’s message, the agent’s instructions, and the tool descriptions and schemas.

When multiple tools are available, the agent may choose to use one, several, or none, depending on what’s needed to answer the query.

src/mastra/agents/weather-agent.ts

```nextra-code [counter-reset:line]

import { weatherTool } from "../tools/weather-tool";
import { activitiesTool } from "../tools/activities-tool";

export const weatherAgent = new Agent({
  // ..
  tools: { weatherTool, activitiesTool }
});
```

## Related [Permalink for this section](https://mastra.ai/en/docs/agents/using-tools\#related)

- [Tools Overview](https://mastra.ai/en/docs/tools-mcp/overview)
- [Agent Memory](https://mastra.ai/en/docs/agents/agent-memory)
- [Runtime Context](https://mastra.ai/en/docs/agents/runtime-context)
- [Calling Agents](https://mastra.ai/en/examples/agents/calling-agents)

[Overview](https://mastra.ai/en/docs/agents/overview "Overview") [Agent Memory](https://mastra.ai/en/docs/agents/agent-memory "Agent Memory")