TroubleshootinguseChat No Response

Copy markdown

# `useChat` No Response

## Issue

I am using `useChat`. When I log the incoming messages on the server, I can see the tool call and the tool result, but the model does not respond with anything.

## Solution

To resolve this issue, convert the incoming messages to the `ModelMessage` format using the `convertToModelMessages` function.

    import { openai } from '@ai-sdk/openai';

    import { convertToModelMessages, streamText } from 'ai';




    export async function POST(req: Request) {

      const { messages } = await req.json();




      const result = streamText({

        model: openai('gpt-4o'),

        messages: convertToModelMessages(messages),

      });




      return result.toUIMessageStreamResponse();

    }

Previous

Server Action Plain Objects Error

Next

Custom headers, body, and credentials not working with useChat
