TroubleshootingType Error with onToolCall

Copy markdown

# Type Error with onToolCall

When using the `onToolCall` callback with TypeScript, you may encounter type errors when trying to pass tool properties directly to `addToolOutput`.

## Problem

TypeScript cannot automatically narrow the type of `toolCall.toolName` when you have both static and dynamic tools, leading to type errors:

    // ❌ This causes a TypeScript error

    const { messages, sendMessage, addToolOutput } = useChat({

      async onToolCall({ toolCall }) {

        addToolOutput({

          tool: toolCall.toolName, // Type 'string' is not assignable to type '"yourTool" | "yourOtherTool"'

          toolCallId: toolCall.toolCallId,

          output: someOutput,

        });

      },

    });

The error occurs because:

- Static tools have specific literal types for their names (e.g., `"getWeatherInformation"`)
- Dynamic tools have `toolName` as a generic `string`
- TypeScript can't guarantee that `toolCall.toolName` matches your specific tool names

## Solution

Check if the tool is dynamic first to enable proper type narrowing:

    // ✅ Correct approach with type narrowing

    const { messages, sendMessage, addToolOutput } = useChat({

      async onToolCall({ toolCall }) {

        // Check if it's a dynamic tool first

        if (toolCall.dynamic) {

          return;

        }




        // Now TypeScript knows this is a static tool with the correct type

        addToolOutput({

          tool: toolCall.toolName, // No type error!

          toolCallId: toolCall.toolCallId,

          output: someOutput,

        });

      },

    });

If you're still using the deprecated `addToolResult` method, this solution applies the same way. Consider migrating to `addToolOutput` for consistency with the latest API.

## Related

- Chatbot Tool Usage
- Dynamic Tools
- useChat Reference

Previous

Stale body values with useChat

Next

Unsupported model version error
