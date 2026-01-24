AI SDK CorecreateAgentUIStream

Copy markdown

# `createAgentUIStream`

The `createAgentUIStream` function runs an Agent and returns a streaming UI message stream as an async iterable. This allows you to consume an agent's reasoning and UI messages incrementally in your own server, edge function, or background job—ideal for building custom streaming interfaces or piping the data to different outputs.

## Import

    import { createAgentUIStream } from "ai"

## Usage

    import { ToolLoopAgent, createAgentUIStream } from 'ai';




    const agent = new ToolLoopAgent({

      model: 'openai/gpt-4o',

      instructions: 'You are a helpful assistant.',

      tools: { weather: weatherTool, calculator: calculatorTool },

    });




    export async function* streamAgent(messages: unknown[]) {

      const stream = await createAgentUIStream({

        agent,

        messages,

        // ...other options

      });




      for await (const chunk of stream) {

        yield chunk; // UI message chunk object (see UIMessageStream)

      }

    }

## Parameters

### agent:

Agent

The agent instance to run. Must define its tools and implement `.stream({ prompt })`.

### messages:

unknown[]

Array of input UI messages sent to the agent (e.g., from user/assistant).

### ...options:

UIMessageStreamOptions

Additional options for customizing UI message streaming, such as source inclusion or error formatting.

## Returns

A `Promise>`, where each yielded value is a UI message chunk representing incremental agent UI output. This stream can be piped to HTTP responses, processed for dashboards, or logged.

## Example

    import { createAgentUIStream } from 'ai';




    const stream = await createAgentUIStream({

      agent,

      messages: [{ role: 'user', content: 'What is the weather in SF today?' }],

      sendStart: true,

    });




    for await (const chunk of stream) {

      // Process each UI message chunk (e.g., send to client)

      console.log(chunk);

    }

## How It Works

1. **Message Validation:** The incoming array of `messages` is validated and normalized according to the agent's tools and requirements. Invalid messages will cause an error.
2. **Model Message Conversion:** The validated UI messages are converted into the model message format the agent expects.
3. **Agent Streaming:** The agent's `.stream({ prompt })` method is invoked to produce a low-level result stream.
4. **UI Message Stream:** That result stream is exposed as a streaming async iterable of UI message chunks.

## Notes

- The agent **must** define its `tools` and a `.stream({ prompt })` method.
- This utility returns an async iterator for full streaming flexibility. To produce an HTTP response, see `createAgentUIStreamResponse` or `pipeAgentUIStreamToResponse`.
- You can provide UI message stream options (see `UIMessageStreamOptions`) for fine-grained control over the output.

## See Also

- `Agent`
- `ToolLoopAgent`
- `UIMessage`
- `UIMessageStreamOptions`
- `createAgentUIStreamResponse`
- `pipeAgentUIStreamToResponse`

Previous

ToolLoopAgent

Next

createAgentUIStreamResponse
