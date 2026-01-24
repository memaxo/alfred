AI SDK UIInferUITool

Copy markdown

# InferUITool

Infers the input and output types of a tool.

This type helper is useful when working with individual tools to ensure type safety for your tool inputs and outputs in `UIMessage`s.

## Import

    import { InferUITool } from 'ai';

## API Signature

### Type Parameters

### TOOL:

Tool

The tool to infer types from.

### Returns

A type that contains the inferred input and output types of the tool.

The resulting type has the shape:

    {

      input: InferToolInput;

      output: InferToolOutput;

    }

## Examples

### Basic Usage

    import { InferUITool } from 'ai';

    import { z } from 'zod';




    const weatherTool = {

      description: 'Get the current weather',

      parameters: z.object({

        location: z.string().describe('The city and state'),

      }),

      execute: async ({ location }) => {

        return `The weather in ${location} is sunny.`;

      },

    };




    // Infer the types from the tool

    type WeatherUITool = InferUITool;

    // This creates a type with:

    // {

    //   input: { location: string };

    //   output: string;

    // }

## Related

- `InferUITools` \- Infer types for a tool set
- `ToolUIPart` \- Tool part type for UI messages

Previous

InferUITools

Next

AI SDK RSC
