---
title: Runtime context | Tools & MCP | Mastra Docs
url: 
description: Learn how to use Mastra's RuntimeContext to provide dynamic, request-specific configuration to tools.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/tools-mcp/runtime-context#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Tools & MCP](https://mastra.ai/en/docs/tools-mcp/overview "Tools & MCP") Runtime Context

Copy page

# Tool Runtime Context

Mastra provides `RuntimeContext`, a dependency injection system that lets you configure tools with runtime variables. If you find yourself creating multiple tools that perform similar tasks, runtime context allows you to consolidate them into a single, more flexible tool.

## Overview [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/runtime-context\#overview)

The dependency injection system allows you to:

1. Pass runtime configuration variables to tools through a type-safe `runtimeContext`.
2. Access these variables within tool execution context.
3. Modify tool behavior without changing the underlying code.
4. Share configuration across multiple tools within the same agent.

**Note:** `RuntimeContext` is primarily used for passing data _into_ tool
executions. It’s distinct from agent memory, which handles conversation
history and state persistence across multiple calls.

## Accessing `runtimeContext` in tools [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/runtime-context\#accessing-runtimecontext-in-tools)

Tools can access the same `runtimeContext` used by their parent agent, allowing them to adjust behavior based on runtime configuration. In this example, the `temperature-unit` is retrieved within the tool’s `execute` function to ensure consistent formatting with the agent’s instructions.

src/mastra/tools/test-weather-tool

```nextra-code [counter-reset:line]

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

type WeatherRuntimeContext = {
  "temperature-unit": "celsius" | "fahrenheit";
};

export const testWeatherTool = createTool({
  id: "getWeather",
  description: "Get the current weather for a location",
  inputSchema: z.object({
    location: z.string().describe("The location to get weather for")
  }),
  execute: async ({ context, runtimeContext }) => {
    const temperatureUnit = runtimeContext.get("temperature-unit") as WeatherRuntimeContext["temperature-unit"];

    const weather = await fetchWeather(context.location, temperatureUnit);

    return { result: weather };
  }
});

async function fetchWeather(location: string, temperatureUnit: WeatherRuntimeContext["temperature-unit"]) {
  // ...
}
```

## Related [Permalink for this section](https://mastra.ai/en/docs/tools-mcp/runtime-context\#related)

[Agent Runtime Context](https://mastra.ai/en/docs/agents/runtime-context)

[MCP Overview](https://mastra.ai/en/docs/tools-mcp/mcp-overview "MCP Overview") [Advanced Usage](https://mastra.ai/en/docs/tools-mcp/advanced-usage "Advanced Usage")