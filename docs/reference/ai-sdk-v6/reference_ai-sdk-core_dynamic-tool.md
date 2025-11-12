AI SDK CoredynamicTool

Copy markdown

# `dynamicTool()`

The `dynamicTool` function creates tools where the input and output types are not known at compile time. This is useful for scenarios such as:

  * MCP (Model Context Protocol) tools without schemas
  * User-defined functions loaded at runtime
  * Tools loaded from external sources or databases
  * Dynamic tool generation based on user input

Unlike the regular `tool` function, `dynamicTool` accepts and returns `unknown` types, allowing you to work with tools that have runtime-determined schemas.
    
    
    import { dynamicTool } from 'ai';
    
    import { z } from 'zod';
    
    
    
    
    export const customTool = dynamicTool({
    
      description: 'Execute a custom user-defined function',
    
      inputSchema: z.object({}),
    
      // input is typed as 'unknown'
    
      execute: async input => {
    
        const { action, parameters } = input as any;
    
    
    
    
        // Execute your dynamic logic
    
        return {
    
          result: `Executed ${action} with ${JSON.stringify(parameters)}`,
    
        };
    
      },
    
    });

## Import
    
    
    import { dynamicTool } from "ai"

## API Signature

### Parameters

### tool:

Object

The dynamic tool definition.

Object

### description?:

string

Information about the purpose of the tool including details on how and when it can be used by the model.

### inputSchema:

FlexibleSchema

The schema of the input that the tool expects. While the type is unknown, a schema is still required for validation. You can use Zod schemas with z.unknown() or z.any() for fully dynamic inputs.

### execute:

ToolExecuteFunction

An async function that is called with the arguments from the tool call. The input is typed as unknown and must be validated/cast at runtime.

ToolCallOptions

### toolCallId:

string

The ID of the tool call.

### messages:

ModelMessage[]

Messages that were sent to the language model.

### abortSignal?:

AbortSignal

An optional abort signal.

### toModelOutput?:

(output: unknown) => LanguageModelV3ToolResultPart['output']

Optional conversion function that maps the tool result to an output that can be used by the language model.

### providerOptions?:

ProviderOptions

Additional provider-specific metadata.

### Returns

A `Tool` with `type: 'dynamic'` that can be used with `generateText`, `streamText`, and other AI SDK functions.

## Type-Safe Usage

When using dynamic tools alongside static tools, you need to check the `dynamic` flag for proper type narrowing:
    
    
    const result = await generateText({
    
      model: openai('gpt-4'),
    
      tools: {
    
        // Static tool with known types
    
        weather: weatherTool,
    
        // Dynamic tool with unknown types
    
        custom: dynamicTool({
    
          /* ... */
    
        }),
    
      },
    
      onStepFinish: ({ toolCalls, toolResults }) => {
    
        for (const toolCall of toolCalls) {
    
          if (toolCall.dynamic) {
    
            // Dynamic tool: input/output are 'unknown'
    
            console.log('Dynamic tool:', toolCall.toolName);
    
            console.log('Input:', toolCall.input);
    
            continue;
    
          }
    
    
    
    
          // Static tools have full type inference
    
          switch (toolCall.toolName) {
    
            case 'weather':
    
              // TypeScript knows the exact types
    
              console.log(toolCall.input.location); // string
    
              break;
    
          }
    
        }
    
      },
    
    });

## Usage with `useChat`

When used with useChat (`UIMessage` format), dynamic tools appear as `dynamic-tool` parts:
    
    
    {
    
      message.parts.map(part => {
    
        switch (part.type) {
    
          case 'dynamic-tool':
    
            return (
    
              
    
                Tool: {part.toolName}
    
                {JSON.stringify(part.input, null, 2)}
    
              
    
            );
    
          // ... handle other part types
    
        }
    
      });
    
    }

Previous

tool

Next

experimental_createMCPClient