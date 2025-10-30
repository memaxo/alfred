---
title: Using with Vercel AI SDK
url: 
description: Learn how Mastra leverages the Vercel AI SDK library and how you can leverage it further with Mastra
language: en
---
[Skip to Content](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") FrameworksAgentic UIsWith Vercel AI SDK

Copy page

# Using Vercel AI SDK

Mastra integrates with [Vercel’s AI SDK](https://sdk.vercel.ai/) to support model routing, React Hooks, and data streaming methods.

## AI SDK v5 [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#ai-sdk-v5)

Mastra also supports AI SDK v5 see the following section for v5 specific methods: [Vercel AI SDK v5](https://mastra.ai/docs/frameworks/agentic-uis/ai-sdk#vercel-ai-sdk-v5)

The code examples contained with this page assume you’re using the Next.js App Router at the root of your
project, e.g., `app` rather than `src/app`.

## Model routing [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#model-routing)

When creating agents in Mastra, you can specify any AI SDK-supported model.

agents/weather-agent.ts

```nextra-code [counter-reset:line]

import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const weatherAgent = new Agent({
  name: "Weather Agent",
  instructions: "Instructions for the agent...",
  model: openai("gpt-4-turbo"),
});
```

> See [Model Providers](https://mastra.ai/docs/getting-started/model-providers) and [Model Capabilities](https://mastra.ai/docs/getting-started/model-capability) for more information.

## React Hooks [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#react-hooks)

Mastra supports AI SDK hooks for connecting frontend components directly to agents using HTTP streams.

Install the required AI SDK React package:

npmyarnpnpmbun

### npm

```nextra-code

npm install @ai-sdk/react
```

### yarn

```nextra-code

yarn add @ai-sdk/react
```

### pnpm

```nextra-code

pnpm add @ai-sdk/react
```

### bun

```nextra-code

bun add @ai-sdk/react
```

### Using the `useChat()` Hook [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#using-the-usechat-hook)

The `useChat` hook handles real-time chat interactions between your frontend and a Mastra agent, enabling you to send prompts and receive streaming responses over HTTP.

app/test/chat.tsx

```nextra-code [counter-reset:line]

"use client";

import { useChat } from "@ai-sdk/react";

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: "/api/chat"
  });
  return (
    <div>
      <pre>{JSON.stringify(messages, null, 2)}</pre>
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} placeholder="Name of city" />
      </form>
    </div>
  );
}
```

Requests sent using the `useChat` hook are handled by a standard server route. This example shows how to define a POST route using a Next.js Route Handler.

app/api/chat/route.ts

```nextra-code [counter-reset:line]

import { mastra } from "../../mastra";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const myAgent = mastra.getAgent("weatherAgent");
  const stream = await myAgent.stream(messages);

  return stream.toDataStreamResponse();
}
```

> When using `useChat` with agent memory, refer to the [Agent Memory section](https://mastra.ai/docs/agents/agent-memory#usechat) for key implementation details.

### Using the `useCompletion()` Hook [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#using-the-usecompletion-hook)

The `useCompletion` hook handles single-turn completions between your frontend and a Mastra agent, allowing you to send a prompt and receive a streamed response over HTTP.

app/test/completion.tsx

```nextra-code [counter-reset:line]

"use client";

import { useCompletion } from "@ai-sdk/react";

export function Completion() {
  const { completion, input, handleInputChange, handleSubmit } = useCompletion({
    api: "api/completion"
  });

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} placeholder="Name of city" />
      </form>
      <p>Completion result: {completion}</p>
    </div>
  );
}
```

Requests sent using the `useCompletion` hook are handled by a standard server route. This example shows how to define a POST route using a Next.js Route Handler.

app/api/completion/route.ts

```nextra-code [counter-reset:line]

import { mastra } from "../../../mastra";

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const myAgent = mastra.getAgent("weatherAgent");
  const stream = await myAgent.stream([{ role: "user", content: prompt }]);

  return stream.toDataStreamResponse();
}
```

### Using the `useObject()` Hook [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#using-the-useobject-hook)

The `useObject` hook consumes streamed text from a Mastra agent and parses it into a structured JSON object based on a defined schema.

app/test/object.tsx

```nextra-code [counter-reset:line]

"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { z } from "zod";

export function Object() {
  const { object, submit } = useObject({
    api: "api/object",
    schema: z.object({
      weather: z.string()
    })
  });

  return (
    <div>
      <button onClick={() => submit("London")}>Generate</button>
      {object ? <pre>{JSON.stringify(object, null, 2)}</pre> : null}
    </div>
  );
}
```

Requests sent using the `useObject` hook are handled by a standard server route. This example shows how to define a POST route using a Next.js Route Handler.

app/api/object/route.ts

```nextra-code [counter-reset:line]

import { mastra } from "../../../mastra";
import { z } from "zod";

export async function POST(req: Request) {
  const body = await req.json();
  const myAgent = mastra.getAgent("weatherAgent");
  const stream = await myAgent.stream(body, {
    structuredOutput: {
      schema: z.object({
        weather: z.string()
      })
    },
    maxSteps: 1
  });

  return stream.toTextStreamResponse();
}
```

### Passing additional data with `sendExtraMessageFields` [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#passing-additional-data-with-sendextramessagefields)

The `sendExtraMessageFields` option allows you to pass additional data from the frontend to Mastra. This data is available on the server as `RuntimeContext`.

app/test/chat-extra.tsx

```nextra-code [counter-reset:line]

"use client";

import { useChat } from "@ai-sdk/react";

export function ChatExtra() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: "/api/chat-extra",
    sendExtraMessageFields: true
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(e, {
      data: {
        userId: "user123",
        preferences: {
          language: "en",
          temperature: "celsius"
        }
      }
    });
  };

  return (
    <div>
      <pre>{JSON.stringify(messages, null, 2)}</pre>
      <form onSubmit={handleFormSubmit}>
        <input value={input} onChange={handleInputChange} placeholder="Name of city" />
      </form>
    </div>
  );
}
```

Requests sent using `sendExtraMessageFields` are handled by a standard server route. This example shows how to extract the custom data and populate a `RuntimeContext` instance.

app/api/chat-extra/route.ts

```nextra-code [counter-reset:line]

import { mastra } from "../../../mastra";
import { RuntimeContext } from "@mastra/core/runtime-context";

export async function POST(req: Request) {
  const { messages, data } = await req.json();
  const myAgent = mastra.getAgent("weatherAgent");

  const runtimeContext = new RuntimeContext();

  if (data) {
    for (const [key, value] of Object.entries(data)) {
      runtimeContext.set(key, value);
    }
  }

  const stream = await myAgent.stream(messages, { runtimeContext });
  return stream.toDataStreamResponse();
}
```

### Handling `runtimeContext` with `server.middleware` [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#handling-runtimecontext-with-servermiddleware)

You can also populate the `RuntimeContext` by reading custom data in a server middleware:

mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";

export const mastra = new Mastra({
  agents: { weatherAgent },
  server: {
    middleware: [\
      async (c, next) => {\
        const runtimeContext = c.get("runtimeContext");\
\
        if (c.req.method === "POST") {\
          try {\
            const clonedReq = c.req.raw.clone();\
            const body = await clonedReq.json();\
\
            if (body?.data) {\
              for (const [key, value] of Object.entries(body.data)) {\
                runtimeContext.set(key, value);\
              }\
            }\
          } catch {\
          }\
        }\
        await next();\
      },\
    ],
  },
});
```

> You can then access this data in your tools via the `runtimeContext` parameter. See the [Agent Runtime Context documentation](https://mastra.ai/docs/agents/runtime-context) for more details.

## Streaming data [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#streaming-data)

The `ai` package provides utilities for managing custom data streams. In some cases, you may want to send structured updates or annotations to the client using an agent’s `dataStream`.

Install the required package:

npmyarnpnpmbun

### npm

```nextra-code

npm install ai
```

### yarn

```nextra-code

yarn add ai
```

### pnpm

```nextra-code

pnpm add ai
```

### bun

```nextra-code

bun add ai
```

### Using `createDataStream()` [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#using-createdatastream)

The `createDataStream` function allows you to stream additional data to the client.

mastra/agents/weather-agent.ts

```nextra-code [counter-reset:line]

import { createDataStream } from "ai";
import { Agent } from "@mastra/core/agent";

export const weatherAgent = new Agent({...});

createDataStream({
  async execute(dataStream) {
    dataStream.writeData({ value: "Hello" });

    dataStream.writeMessageAnnotation({ type: "status", value: "processing" });

    const agentStream = await weatherAgent.stream("What is the weather");

    agentStream.mergeIntoDataStream(dataStream);
  },
  onError: (error) => `Custom error: ${error}`
});
```

### Using `createDataStreamResponse()` [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#using-createdatastreamresponse)

The `createDataStreamResponse` function creates a response object that streams data to the client.

app/api/chat-stream/route.ts

```nextra-code [counter-reset:line]

import { mastra } from "../../../mastra";
import { createDataStreamResponse } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const myAgent = mastra.getAgent("weatherAgent");
  const agentStream = await myAgent.stream(messages);

  const response = createDataStreamResponse({
    status: 200,
    statusText: "OK",
    headers: {
      "Custom-Header": "value"
    },
    async execute(dataStream) {
      dataStream.writeData({ value: "Hello" });

      dataStream.writeMessageAnnotation({
        type: "status",
        value: "processing"
      });

      agentStream.mergeIntoDataStream(dataStream);
    },
    onError: (error) => `Custom error: ${error}`
  });

  return response;
}
```

## Vercel AI SDK v5 [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#vercel-ai-sdk-v5)

This guide covers Mastra-specific considerations when migrating from AI SDK v4 to v5.

> Please add any feedback or bug reports to the [AI SDK v5 mega issue in Github.](https://github.com/mastra-ai/mastra/issues/5470)

### Stream Support [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#stream-support)

Mastra’s experimental `stream` method now includes native AI SDK v5 support through the `format` parameter. This provides seamless integration with AI SDK v5’s streaming interfaces without requiring compatibility wrappers.

```nextra-code

// Use stream with AI SDK v5 format
const stream = await agent.stream(messages, {
  format: 'aisdk'  // Enable AI SDK v5 compatibility
});

// The stream is now compatible with AI SDK v5 interfaces
return stream.toUIMessageStreamResponse();
```

### Official migration guide [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#official-migration-guide)

Follow the official [AI SDK v5 Migration Guide](https://v5.ai-sdk.dev/docs/migration-guides/migration-guide-5-0) for all AI SDK core breaking changes, package updates, and API changes.

This guide covers only the Mastra-specific aspects of the migration.

- **Data compatibility**: New data stored in v5 format will no longer work if you downgrade from v5 to v4
- **Backup recommendation**: Keep DB backups from before you upgrade to v5

### Memory and Storage [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#memory-and-storage)

Mastra automatically handles AI SDK v4 data using its internal `MessageList` class, which manages format conversion—including v4 to v5. No database migrations are required; your existing messages are translated on the fly and continue working after you upgrade.

### Message Format Conversion [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#message-format-conversion)

For cases where you need to manually convert messages between AI SDK and Mastra formats, use the `convertMessages` utility:

```nextra-code

import { convertMessages } from '@mastra/core/agent';

// Convert AI SDK v4 messages to v5
const aiv5Messages = convertMessages(aiv4Messages).to('AIV5.UI');

// Convert Mastra messages to AI SDK v5
const aiv5Messages = convertMessages(mastraMessages).to('AIV5.Core');

// Supported output formats:
// 'Mastra.V2', 'AIV4.UI', 'AIV5.UI', 'AIV5.Core', 'AIV5.Model'
```

This utility is helpful when you want to fetch messages directly from your storage DB and convert them for use in AI SDK.

### Enabling stream compatibility [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#enabling-stream-compatibility)

To enable AI SDK v5 compatibility, use the `@mastra/ai-sdk` package:

npmyarnpnpmbun

### npm

```nextra-code

npm install @mastra/ai-sdk
```

### yarn

```nextra-code

yarn add @mastra/ai-sdk
```

### pnpm

```nextra-code

pnpm add @mastra/ai-sdk
```

### bun

```nextra-code

bun add @mastra/ai-sdk
```

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from '@mastra/core/mastra';
import { chatRoute } from '@mastra/ai-sdk';

export const mastra = new Mastra({
  server: {
    apiRoutes: [\
      chatRoute({\
        path: '/chat',\
        agent: 'weatherAgent',\
      }),\
    ],
  },
});
```

In your application call the `useChat()` hook.

```nextra-code

const { error, status, sendMessage, messages, regenerate, stop } =
  useChat({
    transport: new DefaultChatTransport({
      api: 'http://localhost:4111/chat',
    }),
  });
```

### Type Inference for Tools [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#type-inference-for-tools)

When using tools with TypeScript in AI SDK v5, Mastra provides type inference helpers to ensure type safety for your tool inputs and outputs.

#### InferUITool [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#inferuitool)

The `InferUITool` type helper infers the input and output types of a single Mastra tool:

app/types.ts

```nextra-code [counter-reset:line]

import { InferUITool, createTool } from "@mastra/core/tools";
import { z } from "zod";

const weatherTool = createTool({
  id: "get-weather",
  description: "Get the current weather",
  inputSchema: z.object({
    location: z.string().describe("The city and state"),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    conditions: z.string(),
  }),
  execute: async ({ context }) => {
    return {
      temperature: 72,
      conditions: "sunny",
    };
  },
});

// Infer the types from the tool
type WeatherUITool = InferUITool<typeof weatherTool>;
// This creates:
// {
//   input: { location: string };
//   output: { temperature: number; conditions: string };
// }
```

#### InferUITools [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk\#inferuitools)

The `InferUITools` type helper infers the input and output types of multiple tools:

app/mastra/tools.ts

```nextra-code [counter-reset:line]

import { InferUITools, createTool } from "@mastra/core/tools";
import { z } from "zod";

// Using weatherTool from the previous example
const tools = {
  weather: weatherTool,
  calculator: createTool({
    id: "calculator",
    description: "Perform basic arithmetic",
    inputSchema: z.object({
      operation: z.enum(["add", "subtract", "multiply", "divide"]),
      a: z.number(),
      b: z.number(),
    }),
    outputSchema: z.object({
      result: z.number(),
    }),
    execute: async ({ context }) => {
      // implementation...
      return { result: 0 };
    },
  }),
};

// Infer types from the tool set
export type MyUITools = InferUITools<typeof tools>;
// This creates:
// {
//   weather: { input: { location: string }; output: { temperature: number; conditions: string } };
//   calculator: { input: { operation: "add" | "subtract" | "multiply" | "divide"; a: number; b: number }; output: { result: number } };
// }
```

These type helpers provide full TypeScript support when using Mastra tools with AI SDK v5 UI components, ensuring type safety across your application.

[Speech to Speechnew](https://mastra.ai/en/docs/voice/speech-to-speech "Speech to Speech") [With CopilotKit](https://mastra.ai/en/docs/frameworks/agentic-uis/copilotkit "With CopilotKit")