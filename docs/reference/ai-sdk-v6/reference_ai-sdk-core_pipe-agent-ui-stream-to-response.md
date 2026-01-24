AI SDK CorepipeAgentUIStreamToResponse

Copy markdown

# `pipeAgentUIStreamToResponse`

The `pipeAgentUIStreamToResponse` function executes an Agent and streams its output as a UI message stream directly to a Node.js `ServerResponse` object. This is ideal for building API endpoints in Node.js servers (such as Express, Hono, or custom servers) that require low-latency, real-time UI message streaming from an Agent (e.g., for chat- or tool-use-based applications).

## Import

    import { pipeAgentUIStreamToResponse } from "ai"

## Usage

    import { pipeAgentUIStreamToResponse } from 'ai';

    import { MyCustomAgent } from './agent';




    export async function handler(req, res) {

      const { messages } = JSON.parse(req.body);




      await pipeAgentUIStreamToResponse({

        response: res, // Node.js ServerResponse

        agent: MyCustomAgent,

        messages,

        // ...other optional streaming options

      });

    }

## Parameters

### response:

ServerResponse

The Node.js ServerResponse object to which the UI message stream will be piped.

### agent:

Agent

The agent instance to use for streaming responses. Must implement `.stream({ prompt })` and define tools.

### messages:

unknown[]

Array of input UI messages sent to the agent (typically user and assistant message objects).

### ...options:

UIMessageStreamResponseInit & UIMessageStreamOptions

Options for response headers, status, and additional streaming configuration.

## Returns

A `Promise`. This function returns a promise that resolves when piping the UI message stream to the ServerResponse is complete.

## Example: Hono/Express Route Handler

    import { pipeAgentUIStreamToResponse } from 'ai';

    import { openaiWebSearchAgent } from './openai-web-search-agent';




    // Hono/Express handler signature

    app.post('/chat', async (req, res) => {

      const { messages } = await getJsonBody(req);




      await pipeAgentUIStreamToResponse({

        response: res,

        agent: openaiWebSearchAgent,

        messages,

        // status: 200,

        // headers: { 'X-Custom': 'foo' },

        // ...additional streaming options

      });

    });

## How It Works

1. **Streams Output:** The function creates a UI message stream from the agent and efficiently pipes it to the provided Node.js `ServerResponse`, setting appropriate HTTP headers (including content type and streaming-friendly headers) and status.
2. **No Response Object:** Unlike serverless `Response`-returning APIs, this function does _not_ return a Response object. It writes streaming bytes directly to the Node.js response. This is more memory- and latency-efficient for Node.js server frameworks.

## Notes

- **Only for Node.js:** This function is intended for use in Node.js environments with access to `ServerResponse` objects, not for Edge/serverless/server-side frameworks using web `Response` objects.
- **Streaming Support:** Ensure your client and reverse proxy/server infrastructure support streaming HTTP responses.
- Supports both Hono (`@hono/node-server`), Express, and similar Node.js frameworks.

## See Also

- `createAgentUIStreamResponse`
- `Agent`
- `UIMessageStreamOptions`
- `UIMessage`

Previous

createAgentUIStreamResponse

Next

tool
