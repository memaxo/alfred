TroubleshootingClient-Side Function Calls Not Invoked

Copy markdown

# Client-Side Function Calls Not Invoked

## Issue

I upgraded the AI SDK to v3.0.20 or newer. I am using `OpenAIStream`. Client-side function calls are no longer invoked.

## Solution

You will need to add a stub for `experimental_onFunctionCall` to `OpenAIStream` to enable the correct forwarding of the function calls to the client.

    const stream = OpenAIStream(response, {

      async experimental_onFunctionCall() {

        return;

      },

    });

Previous

Azure OpenAI Slow to Stream

Next

Server Actions in Client Components
