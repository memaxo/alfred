---
title: Agent Overview | Agents | Mastra Docs
url: 
description: Overview of agents in Mastra, detailing their capabilities and how they interact with tools, workflows, and external systems.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/agents/overview#nextra-skip-nav)

Loading...

[Docs](https://mastra.ai/en/docs "Docs") AgentsOverview

Copy page

# Using Agents

Agents use LLMs and tools to solve open-ended tasks. They reason about goals, decide which tools to use, retain conversation memory, and iterate internally until the model emits a final answer or an optional stop condition is met. Agents produce structured responses you can render in your UI or process programmatically. Use agents directly or compose them into workflows or agent networks.

![Agents overview](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fagents-overview.1552bdfe.jpg&w=3840&q=75)

> **📹 Watch**: → An introduction to agents, and how they compare to workflows [YouTube (7 minutes)](https://youtu.be/0jg2g3sNvgw)

## Getting started [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#getting-started)

Mastra model routerVercel AI SDK

### Mastra model router

### Install dependencies [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#install-dependencies)

Add the Mastra core package to your project:

```nextra-code

npm install @mastra/core
```

### Set your API key [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#set-your-api-key)

Mastra’s model router auto-detects environment variables for your chosen provider. For OpenAI, set `OPENAI_API_KEY`:

.env

```nextra-code

OPENAI_API_KEY=<your-api-key>
```

> Mastra supports more than 600 models. Choose from the full list [here](https://mastra.ai/en/docs/getting-started/model-providers).

### Create an agent [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#create-an-agent)

Create an agent by instantiating the `Agent` class with system `instructions` and a `model`:

src/mastra/agents/test-agent.ts

```nextra-code [counter-reset:line]

import { Agent } from "@mastra/core/agent";

export const testAgent = new Agent({
  name: "test-agent",
  instructions: "You are a helpful assistant.",
  model: "openai/gpt-4o-mini"
});
```

### Vercel AI SDK

### Install dependencies [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#install-dependencies-1)

Include the Mastra core package alongside the Vercel AI SDK provider you want to use:

```nextra-code

npm install @mastra/core @ai-sdk/openai
```

### Set your API key [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#set-your-api-key-1)

Set the corresponding environment variable for your provider. For OpenAI via the AI SDK:

.env

```nextra-code

OPENAI_API_KEY=<your-api-key>
```

> See the [AI SDK Providers](https://ai-sdk.dev/providers/ai-sdk-providers) in the Vercel AI SDK docs for additional configuration options.

### Create an agent [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#create-an-agent-1)

To create an agent in Mastra, use the `Agent` class. Every agent must include `instructions` to define its behavior, and a `model` parameter to specify the LLM provider and model. When using the Vercel AI SDK, provide the client to your agent’s `model` field:

src/mastra/agents/test-agent.ts

```nextra-code [counter-reset:line]

import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const testAgent = new Agent({
  name: "test-agent",
  instructions: "You are a helpful assistant.",
  model: openai("gpt-4o-mini")
});
```

#### Instruction formats [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#instruction-formats)

Instructions define the agent’s behavior, personality, and capabilities.
They are system-level prompts that establish the agent’s core identity and expertise.

Instructions can be provided in multiple formats for greater flexibility. The examples below illustrate the supported shapes:

```nextra-code

// String (most common)
instructions: "You are a helpful assistant."

// Array of strings
instructions: [\
  "You are a helpful assistant.",\
  "Always be polite.",\
  "Provide detailed answers."\
]

// Array of system messages
instructions: [\
  { role: "system", content: "You are a helpful assistant." },\
  { role: "system", content: "You have expertise in TypeScript." }\
]
```

#### Provider-specific options [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#provider-specific-options)

Each model provider also enables a few different options, including prompt caching and configuring reasoning. We provide a `providerOptions` flag to manage these. You can set `providerOptions` on the instruction level to set different caching strategy per system instruction/prompt.

```nextra-code

// With provider-specific options (e.g., caching, reasoning)
instructions: {
  role: "system",
  content:
    "You are an expert code reviewer. Analyze code for bugs, performance issues, and best practices.",
  providerOptions: {
    openai: { reasoning_effort: "high" },        // OpenAI's reasoning models
    anthropic: { cache_control: { type: "ephemeral" } }  // Anthropic's prompt caching
  }
}
```

> See the [Agent reference doc](https://mastra.ai/en/reference/agents/agent) for more information.

### Registering an agent [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#registering-an-agent)

Register your agent in the Mastra instance to make it available throughout your application. Once registered, it can be called from workflows, tools, or other agents, and has access to shared resources such as memory, logging, and observability features:

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { testAgent } from './agents/test-agent';

export const mastra = new Mastra({
  // ...
  agents: { testAgent },
});
```

## Referencing an agent [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#referencing-an-agent)

You can call agents from workflow steps, tools, the Mastra Client, or the command line. Get a reference by calling `.getAgent()` on your `mastra` or `mastraClient` instance, depending on your setup:

```nextra-code [counter-reset:line]

const testAgent = mastra.getAgent("testAgent");
```

`mastra.getAgent()` is preferred over a direct import, since it preserves the Mastra instance configuration (tools registered, telemetry, vector stores configuration for agent memory, etc.)

> See [Calling agents](https://mastra.ai/en/examples/agents/calling-agents) for more information.

## Generating responses [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#generating-responses)

Agents can return results in two ways: generating the full output before returning it or streaming tokens in real time. Choose the approach that fits your use case: generate for short, internal responses or debugging, and stream to deliver pixels to end users as quickly as possible.

GenerateStream

### Generate

Pass a single string for simple prompts, an array of strings when providing multiple pieces of context, or an array of message objects with `role` and `content`.

(The `role` defines the speaker for each message. Typical roles are `user` for human input, `assistant` for agent responses, and `system` for instructions.)

```nextra-code [counter-reset:line]

const response = await testAgent.generate([\
  { role: "user", content: "Help me organize my day" },\
  { role: "user", content: "My day starts at 9am and finishes at 5.30pm" },\
  { role: "user", content: "I take lunch between 12:30 and 13:30" },\
  { role: "user", content: "I have meetings Monday to Friday between 10:30 and 11:30" }\
]);

console.log(response.text);
```

### Stream

Pass a single string for simple prompts, an array of strings when providing multiple pieces of context, or an array of message objects with `role` and `content`.

(The `role` defines the speaker for each message. Typical roles are `user` for human input, `assistant` for agent responses, and `system` for instructions.)

```nextra-code [counter-reset:line]

const stream = await testAgent.stream([\
  { role: "user", content: "Help me organize my day" },\
  { role: "user", content: "My day starts at 9am and finishes at 5.30pm" },\
  { role: "user", content: "I take lunch between 12:30 and 13:30" },\
  { role: "user", content: "I have meetings Monday to Friday between 10:30 and 11:30" }\
]);

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

### Completion using `onFinish()` [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#completion-using-onfinish)

When streaming responses, the `onFinish()` callback runs after the LLM finishes generating its response and all tool executions are complete.
It provides the final `text`, execution `steps`, `finishReason`, token `usage` statistics, and other metadata useful for monitoring or logging.

```nextra-code [counter-reset:line]

const stream = await testAgent.stream("Help me organize my day", {
  onFinish: ({ steps, text, finishReason, usage }) => {
    console.log({ steps, text, finishReason, usage });
  }
});

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

> See [.generate()](https://mastra.ai/en/reference/agents/generate) or [.stream()](https://mastra.ai/en/reference/agents/stream) for more information.

## Structured output [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#structured-output)

Agents can return structured, type-safe data by defining the expected output using either [Zod](https://zod.dev/) or [JSON Schema](https://json-schema.org/). We recommend Zod for better TypeScript support and developer experience. The parsed result is available on `response.object`, allowing you to work directly with validated and typed data.

### Using Zod [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#using-zod)

Define the `output` shape using [Zod](https://zod.dev/):

```nextra-code [counter-reset:line]

import { z } from "zod";

const response = await testAgent.generate(
  [\
    {\
      role: "system",\
      content: "Provide a summary and keywords for the following text:"\
    },\
    {\
      role: "user",\
      content: "Monkey, Ice Cream, Boat"\
    }\
  ],
  {
    structuredOutput: {
      schema: z.object({
        summary: z.string(),
        keywords: z.array(z.string())
      })
    },
    maxSteps: 1
  }
);

console.log(response.object);
```

## Working with images [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#working-with-images)

Agents can analyze and describe images by processing both the visual content and any text within them. To enable image analysis, pass an object with `type: 'image'` and the image URL in the `content` array. You can combine image content with text prompts to guide the agent’s analysis.

```nextra-code [counter-reset:line]

const response = await testAgent.generate([\
  {\
    role: "user",\
    content: [\
      {\
        type: "image",\
        image: "https://placebear.com/cache/395-205.jpg",\
        mimeType: "image/jpeg"\
      },\
      {\
        type: "text",\
        text: "Describe the image in detail, and extract all the text in the image."\
      }\
    ]\
  }\
]);

console.log(response.text);
```

For a detailed guide to creating and configuring tools, see the [Tools Overview](https://mastra.ai/en/docs/tools-mcp/overview) page.

### Using `maxSteps` [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#using-maxsteps)

The `maxSteps` parameter controls the maximum number of sequential LLM calls an agent can make. Each step includes generating a response, executing any tool calls, and processing the result. Limiting steps helps prevent infinite loops, reduce latency, and control token usage for agents that use tools. The default is 1, but can be increased:

```nextra-code [counter-reset:line]

const response = await testAgent.generate("Help me organize my day", {
  maxSteps: 5
});

console.log(response.text);
```

### Using `onStepFinish` [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#using-onstepfinish)

You can monitor the progress of multi-step operations using the `onStepFinish` callback. This is useful for debugging or providing progress updates to users.

`onStepFinish` is only available when streaming or generating text without structured output.

```nextra-code [counter-reset:line]

const response = await testAgent.generate("Help me organize my day", {
  onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
    console.log({ text, toolCalls, toolResults, finishReason, usage });
  }
});
```

## Using tools [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#using-tools)

Agents can use tools to go beyond language generation, enabling structured interactions with external APIs and services. Tools allow agents to access data and perform clearly defined operations in a reliable, repeatable way.

See the [using tools](https://mastra.ai/en/docs/agents/using-tools) section for more information.

## Testing agents locally [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#testing-agents-locally)

There are two ways to run and test agents.

### Mastra Playground [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#mastra-playground)

With the Mastra Dev Server running you can test an agent from the Mastra Playground by visiting [http://localhost:4111/agents](http://localhost:4111/agents) in your browser.

> For more information, see the [Local Dev Playground](https://mastra.ai/docs/server-db/local-dev-playground) documentation.

### Command line [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#command-line)

Create an agent response using `.generate()` or `.stream()`.

src/test-agent.ts

```nextra-code [counter-reset:line]

import "dotenv/config";

import { mastra } from "./mastra";

const agent = mastra.getAgent("testAgent");

const response = await agent.generate("Help me organize my day");

console.log(response.text);
```

> See [.generate()](https://mastra.ai/en/reference/agents/generate) or [.stream()](https://mastra.ai/en/reference/agents/stream) for more information.

To test this agent, run the following:

```nextra-code

npx tsx src/test-agent.ts
```

## Related [Permalink for this section](https://mastra.ai/en/docs/agents/overview\#related)

- [Using Tools](https://mastra.ai/en/docs/agents/using-tools)
- [Agent Memory](https://mastra.ai/en/docs/agents/agent-memory)
- [Runtime Context](https://mastra.ai/en/docs/agents/runtime-context)
- [Calling Agents](https://mastra.ai/en/examples/agents/calling-agents)

[Templates](https://mastra.ai/en/docs/getting-started/templates "Templates") [Using Tools](https://mastra.ai/en/docs/agents/using-tools "Using Tools")