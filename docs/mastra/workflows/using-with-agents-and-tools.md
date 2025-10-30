---
title: Using Workflows with Agents and Tools | Workflows | Mastra Docs
url: 
description: Steps in Mastra workflows provide a structured way to manage operations by defining inputs, outputs, and execution logic.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/workflows/using-with-agents-and-tools#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Workflows](https://mastra.ai/en/docs/workflows/overview "Workflows") Agents and Tools

Copy page

# Agents and Tools

Workflow steps are composable and typically run logic directly within the `execute` function. However, there are cases where calling an agent or tool is more appropriate. This pattern is especially useful when:

- Generating natural language responses from user input using an LLM.
- Abstracting complex or reusable logic into a dedicated tool.
- Interacting with third-party APIs in a structured or reusable way.

Workflows can use Mastra agents or tools directly as steps, for example: `createStep(testAgent)` or `createStep(testTool)`.

## Using agents in workflows [Permalink for this section](https://mastra.ai/en/docs/workflows/using-with-agents-and-tools\#using-agents-in-workflows)

To include an agent in a workflow, define it in the usual way, then either add it directly to the workflow using `createStep(testAgent)` or, invoke it from within a step’s `execute` function using `.generate()`.

### Example agent [Permalink for this section](https://mastra.ai/en/docs/workflows/using-with-agents-and-tools\#example-agent)

This agent uses OpenAI to generate a fact about a city, country, and timezone.

src/mastra/agents/test-agent.ts

```nextra-code [counter-reset:line]

import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const testAgent = new Agent({
  name: "test-agent",
  description: "Create facts for a country based on the city",
  instructions: `Return an interesting fact about the country based on the city provided`,
  model: openai("gpt-4o")
});
```

### Adding an agent as a step [Permalink for this section](https://mastra.ai/en/docs/workflows/using-with-agents-and-tools\#adding-an-agent-as-a-step)

In this example, `step1` uses the `testAgent` to generate an interesting fact about the country based on a given city.

The `.map` method transforms the workflow input into a `prompt` string compatible with the `testAgent`.

The step is composed into the workflow using `.then()`, allowing it to receive the mapped input and return the agent’s structured output. The workflow is finalized with `.commit()`.

![Agent as step](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fworkflows-agent-tools-agent-step.1c16a9af.jpg&w=3840&q=75)

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { testAgent } from "../agents/test-agent";

const step1 = createStep(testAgent);

export const testWorkflow = createWorkflow({
  id: "test-workflow",
  description: 'Test workflow',
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  })
})
  .map(({ inputData }) => {
    const { input } = inputData;
    return {
      prompt: `Provide facts about the city: ${input}`
    };
  })
  .then(step1)
  .commit();
```

### Calling an agent with `.generate()` [Permalink for this section](https://mastra.ai/en/docs/workflows/using-with-agents-and-tools\#calling-an-agent-with-generate)

In this example, the `step1` builds a prompt using the provided `input` and passes it to the `testAgent`, which returns a plain-text response containing facts about the city and its country.

The step is added to the workflow using the sequential `.then()` method, allowing it to receive input from the workflow and return structured output. The workflow is finalized with `.commit()`.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { testAgent } from "../agents/test-agent";

const step1 = createStep({
  id: "step-1",
  description: "Create facts for a country based on the city",
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  }),

  execute: async ({ inputData }) => {
    const { input } = inputData;

    const  prompt = `Provide facts about the city: ${input}`

    const { text } = await testAgent.generate([\
      { role: "user", content: prompt }\
    ]);

    return {
      output: text
    };
  }
});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .commit();
```

## Using tools in workflows [Permalink for this section](https://mastra.ai/en/docs/workflows/using-with-agents-and-tools\#using-tools-in-workflows)

To use a tool within a workflow, define it in the usual way, then either add it directly to the workflow using `createStep(testTool)` or, invoke it from within a step’s `execute` function using `.execute()`.

### Example tool [Permalink for this section](https://mastra.ai/en/docs/workflows/using-with-agents-and-tools\#example-tool)

The example below uses the Open Meteo API to retrieve geolocation details for a city, returning its name, country, and timezone.

src/mastra/tools/test-tool.ts

```nextra-code [counter-reset:line]

import { createTool } from "@mastra/core";
import { z } from "zod";

export const testTool = createTool({
  id: "test-tool",
  description: "Gets country for a city",
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    country_name: z.string()
  }),
  execute: async ({ context }) => {
    const { input } = context;
    const geocodingResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${input}`);
    const geocodingData = await geocodingResponse.json();

    const { country } = geocodingData.results[0];

    return {
      country_name: country
    };
  }
});
```

### Adding a tool as a step [Permalink for this section](https://mastra.ai/en/docs/workflows/using-with-agents-and-tools\#adding-a-tool-as-a-step)

In this example, `step1` uses the `testTool`, which performs a geocoding lookup using the provided `city` and returns the resolved `country`.

The step is added to the workflow using the sequential `.then()` method, allowing it to receive input from the workflow and return structured output. The workflow is finalized with `.commit()`.

![Tool as step](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fworkflows-agent-tools-tool-step.972e2ea7.jpg&w=3840&q=75)

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { testTool } from "../tools/test-tool";

const step1 = createStep(testTool);

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .commit();
```

### Calling a tool with `.execute()` [Permalink for this section](https://mastra.ai/en/docs/workflows/using-with-agents-and-tools\#calling-a-tool-with-execute)

In this example, `step1` directly invokes `testTool` using its `.execute()` method. The tool performs a geocoding lookup with the provided `city` and returns the corresponding `country`.

The result is returned as structured output from the step. The step is composed into the workflow using `.then()`, enabling it to process workflow input and produce typed output. The workflow is finalized with `.commit()`

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { RuntimeContext } from "@mastra/core/di";

import { testTool } from "../tools/test-tool";

const runtimeContext = new RuntimeContext();

const step1 = createStep({
  id: "step-1",
  description: "Gets country for a city",
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  }),

  execute: async ({ inputData }) => {
    const { input } = inputData;

    const { country_name } = await testTool.execute({
      context: { input },
      runtimeContext
    });

    return {
      output: country_name
    };
  }
});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .commit();
```

## Using workflows as tools [Permalink for this section](https://mastra.ai/en/docs/workflows/using-with-agents-and-tools\#using-workflows-as-tools)

In this example the `cityStringWorkflow` workflow has been added to the main Mastra instance.

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";

import { testWorkflow, cityStringWorkflow } from "./workflows/test-workflow";

export const mastra = new Mastra({
  ...
  workflows: { testWorkflow, cityStringWorkflow },
});
```

Once a workflow has been registered it can be referenced using `getWorkflow` from withing a tool.

src/mastra/tools/test-tool.ts

```nextra-code [counter-reset:line]

export const cityCoordinatesTool = createTool({
  id: "city-tool",
  description: "Convert city details",
  inputSchema: z.object({
    city: z.string()
  }),
  outputSchema: z.object({
    outcome: z.string()
  }),
  execute: async ({ context, mastra }) => {
    const { city } = context;
    const geocodingResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}`);
    const geocodingData = await geocodingResponse.json();

    const { name, country, timezone } = geocodingData.results[0];

    const workflow = mastra?.getWorkflow("cityStringWorkflow");

    const run = await workflow?.createRunAsync();

    const { result } = await run?.start({
      inputData: {
        city_name: name,
        country_name: country,
        country_timezone: timezone
      }
    });

    return {
      outcome: result.outcome
    };
  }
});
```

## Using workflows in agents [Permalink for this section](https://mastra.ai/en/docs/workflows/using-with-agents-and-tools\#using-workflows-in-agents)

You can also use Workflows in Agents. This agent is able to choose between using the test tool or the test workflow.

```nextra-code

import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { testTool } from "../tools/test-tool";
import { testWorkflow } from "../workflows/test-workflow";

export const testAgent = new Agent({
  name: "test-agent",
  description: "Create facts for a country based on the city",
  instructions: `Return an interesting fact about the country based on the city provided`,
  model: openai("gpt-4o"),
  workflows: {
    test_workflow: testWorkflow
  },
  tools: {
    test_tool: testTool
  },
});
```

## Exposing workflows with `MCPServer` [Permalink for this section](https://mastra.ai/en/docs/workflows/using-with-agents-and-tools\#exposing-workflows-with-mcpserver)

You can convert your workflows into tools by passing them into an instance of a Mastra `MCPServer`. This allows any MCP-compatible client to access your workflow.

The workflow description becomes the tool description and the input schema becomes the tool’s input schema.

When you provide workflows to the server, each workflow is automatically exposed as a callable tool for example:

- `run_testWorkflow`.

src/test-mcp-server.ts

```nextra-code [counter-reset:line]

import { MCPServer } from "@mastra/mcp";

import { testAgent } from "./mastra/agents/test-agent";
import { testTool } from "./mastra/tools/test-tool";
import { testWorkflow } from "./mastra/workflows/test-workflow";

async function startServer() {
  const server = new MCPServer({
    name: "test-mcp-server",
    version: "1.0.0",
    workflows: {
      testWorkflow
    }
  });

  await server.startStdio();
  console.log("MCPServer started on stdio");
}

startServer().catch(console.error);
```

To verify that your workflow is available on the server, you can connect with an MCPClient.

src/test-mcp-client.ts

```nextra-code [counter-reset:line]

import { MCPClient } from "@mastra/mcp";

async function main() {
  const mcp = new MCPClient({
    servers: {
      local: {
        command: "npx",
        args: ["tsx", "src/test-mcp-server.ts"]
      }
    }
  });

  const tools = await mcp.getTools();
  console.log(tools);
}

main().catch(console.error);
```

Run the client script to see your workflow tool.

```nextra-code

npx tsx src/test-mcp-client.ts
```

## More resources [Permalink for this section](https://mastra.ai/en/docs/workflows/using-with-agents-and-tools\#more-resources)

- [MCPServer reference documentation](https://mastra.ai/reference/tools/mcp-server).
- [MCPClient reference documentation](https://mastra.ai/reference/tools/mcp-client).

[Input Data Mapping](https://mastra.ai/en/docs/workflows/input-data-mapping "Input Data Mapping") [Inngest Workflowexp.](https://mastra.ai/en/docs/workflows/inngest-workflow "Inngest Workflow")