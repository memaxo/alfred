---
title: Tool Streaming | Streaming | Mastra
url: 
description: Learn how to use tool streaming in Mastra, including handling tool calls, tool results, and tool execution events during streaming.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/streaming/tool-streaming#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Streamingexp.](https://mastra.ai/en/docs/streaming/overview "Streaming") Tool Streaming

Copy page

# Tool streaming

Tool streaming in Mastra enables tools to send incremental results while they run, rather than waiting until execution finishes. This allows you to surface partial progress, intermediate states, or progressive data directly to users or upstream agents and workflows.

Streams can be written to in two main ways:

- **From within a tool**: every tool receives a `writer` argument, which is a writable stream you can use to push updates as execution progresses.
- **From an agent stream**: you can also pipe an agent’s `stream` output directly into a tool’s writer, making it easy to chain agent responses into tool results without extra glue code.

By combining writable tool streams with agent streaming, you gain fine grained control over how intermediate results flow through your system and into the user experience.

## Agent using tool [Permalink for this section](https://mastra.ai/en/docs/streaming/tool-streaming\#agent-using-tool)

Agent streaming can be combined with tool calls, allowing tool outputs to be written directly into the agent’s streaming response. This makes it possible to surface tool activity as part of the overall interaction.

```nextra-code [counter-reset:line]

import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

import { testTool } from "../tools/test-tool";

export const testAgent = new Agent({
  name: "test-agent",
  instructions: "You are a weather agent.",
  model: openai("gpt-4o-mini"),
  tools: { testTool }
});
```

### Using the `writer` argument [Permalink for this section](https://mastra.ai/en/docs/streaming/tool-streaming\#using-the-writer-argument)

The `writer` argument is passed to a tool’s `execute` function and can be used to emit custom events, data, or values into the active stream. This enables tools to provide intermediate results or status updates while execution is still in progress.

You must `await` the call to `writer.write(...)` or else you will lock the stream and get a `WritableStream is locked` error.

```nextra-code [counter-reset:line]

import { createTool } from "@mastra/core/tools";

export const testTool = createTool({
  // ...
  execute: async ({ context, writer }) => {
    const { value } = context;

   await writer?.write({
      type: "custom-event",
      status: "pending"
    });

    const response = await fetch(...);

   await writer?.write({
      type: "custom-event",
      status: "success"
    });

    return {
      value: ""
    };
  }
});
```

### Inspecting stream payloads [Permalink for this section](https://mastra.ai/en/docs/streaming/tool-streaming\#inspecting-stream-payloads)

Events written to the stream are included in the emitted chunks. These chunks can be inspected to access any custom fields, such as event types, intermediate values, or tool-specific data.

```nextra-code [counter-reset:line]

const stream = await testAgent.stream([\
  "What is the weather in London?",\
  "Use the testTool"\
]);

for await (const chunk of stream) {
  if (chunk.payload.output?.type === "custom-event") {
    console.log(JSON.stringify(chunk, null, 2));
  }
}
```

## Tool using an agent [Permalink for this section](https://mastra.ai/en/docs/streaming/tool-streaming\#tool-using-an-agent)

Pipe an agent’s `textStream` to the tool’s `writer`. This streams partial output, and Mastra automatically aggregates the agent’s usage into the tool run.

```nextra-code [counter-reset:line]

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const testTool = createTool({
  // ...
  execute: async ({ context, mastra, writer }) => {
    const { city } = context;

    const testAgent = mastra?.getAgent("testAgent");
    const stream = await testAgent?.stream(`What is the weather in ${city}?`);

    await stream!.textStream.pipeTo(writer!);

    return {
      value: await stream!.text
    };
  }
});
```

[Events](https://mastra.ai/en/docs/streaming/events "Events") [Workflow Streaming](https://mastra.ai/en/docs/streaming/workflow-streaming "Workflow Streaming")