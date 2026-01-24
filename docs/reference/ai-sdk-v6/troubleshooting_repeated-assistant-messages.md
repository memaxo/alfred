TroubleshootingRepeated assistant messages in useChat

Copy markdown

# Repeated assistant messages in useChat

## Issue

When using `useChat` with `streamText` on the server, the assistant's messages appear duplicated in the UI - showing both the previous message and the new message, or showing the same message multiple times. This can occur when using tool calls or complex message flows.

    // Server-side code that may experience assistant message duplication on the client

    export async function POST(req: Request) {

      const { messages } = await req.json();




      const result = streamText({

        model: openai('gpt-4o-mini'),

        messages: convertToModelMessages(messages),

        tools: {

          weather: {

            description: 'Get the weather for a location',

            parameters: z.object({

              location: z.string(),

            }),

            execute: async ({ location }) => {

              return { temperature: 72, condition: 'sunny' };

            },

          },

        },

      });




      return result.toUIMessageStreamResponse();

    }

## Background

The duplication occurs because `toUIMessageStreamResponse` generates new message IDs for each new message.

## Solution

Pass the original messages array to `toUIMessageStreamResponse` using the `originalMessages` option. By passing `originalMessages`, the method can reuse existing message IDs instead of generating new ones, ensuring the client properly updates existing messages rather than creating duplicates.

    export async function POST(req: Request) {

      const { messages } = await req.json();




      const result = streamText({

        model: openai('gpt-4o-mini'),

        messages: convertToModelMessages(messages),

        tools: {

          weather: {

            description: 'Get the weather for a location',

            parameters: z.object({

              location: z.string(),

            }),

            execute: async ({ location }) => {

              return { temperature: 72, condition: 'sunny' };

            },

          },

        },

      });




      return result.toUIMessageStreamResponse({

        originalMessages: messages, // Pass the original messages here

        generateMessageId: generateId,

        onFinish: ({ messages }) => {

          saveChat({ id, messages });

        },

      });

    }

Previous

useChat "An error occurred"

Next

onFinish not called when stream is aborted
