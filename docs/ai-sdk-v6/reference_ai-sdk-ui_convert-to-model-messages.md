AI SDK UIconvertToModelMessages

Copy markdown

# `convertToModelMessages()`

The `convertToModelMessages` function is used to transform an array of UI messages from the `useChat` hook into an array of `ModelMessage` objects. These `ModelMessage` objects are compatible with AI core functions like `streamText`.

app/api/chat/route.ts
    
    
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

## Import
    
    
    import { convertToModelMessages } from "ai"

## API Signature

### Parameters

### messages:

Message[]

An array of UI messages from the useChat hook to be converted

### options:

{ tools?: ToolSet, convertDataPart?: (part: DataUIPart) => TextPart | FilePart | null }

Optional configuration object. Provide tools to enable multi-modal tool responses, and convertDataPart to transform custom data parts into model-compatible content.

### Returns

An array of `ModelMessage` objects.

### ModelMessage[]:

Array

An array of ModelMessage objects

## Multi-modal Tool Responses

The `convertToModelMessages` function supports tools that can return multi-modal content. This is useful when tools need to return non-text content like images.
    
    
    import { tool } from 'ai';
    
    import { z } from 'zod';
    
    
    
    
    const screenshotTool = tool({
    
      parameters: z.object({}),
    
      execute: async () => 'imgbase64',
    
      toModelOutput: result => [{ type: 'image', data: result }],
    
    });
    
    
    
    
    const result = streamText({
    
      model: openai('gpt-4'),
    
      messages: convertToModelMessages(messages, {
    
        tools: {
    
          screenshot: screenshotTool,
    
        },
    
      }),
    
    });

Tools can implement the optional `toModelOutput` method to transform their results into multi-modal content. The content is an array of content parts, where each part has a `type` (e.g., 'text', 'image') and corresponding data.

## Custom Data Part Conversion

The `convertToModelMessages` function supports converting custom data parts attached to user messages. This is useful when users need to include additional context (URLs, code files, JSON configs) with their messages.

### Basic Usage

By default, data parts in user messages are filtered out during conversion. To include them, provide a `convertDataPart` callback that transforms data parts into text or file parts that the model can understand:

app/api/chat/route.ts
    
    
    import { openai } from '@ai-sdk/openai';
    
    import { convertToModelMessages, streamText } from 'ai';
    
    
    
    
    type CustomUIMessage = UIMessage;
    
    
    
    
    export async function POST(req: Request) {
    
      const { messages } = await req.json();
    
    
    
    
      const result = streamText({
    
        model: openai('gpt-4o'),
    
        messages: convertToModelMessages(messages, {
    
          convertDataPart: part => {
    
            // Convert URL attachments to text
    
            if (part.type === 'data-url') {
    
              return {
    
                type: 'text',
    
                text: `[Reference: ${part.data.title}](${part.data.url})\n\n${part.data.content}`,
    
              };
    
            }
    
    
    
    
            // Convert code file attachments
    
            if (part.type === 'data-code-file') {
    
              return {
    
                type: 'text',
    
                text: `\`\`\`${part.data.language}\n// ${part.data.filename}\n${part.data.code}\n\`\`\``,
    
              };
    
            }
    
    
    
    
            // Other data parts are ignored
    
          },
    
        }),
    
      });
    
    
    
    
      return result.toUIMessageStreamResponse();
    
    }

### Use Cases

**Attaching URL Content** Allow users to attach URLs to their messages, with the content fetched and formatted for the model:
    
    
    // Client side
    
    sendMessage({
    
      parts: [
    
        { type: 'text', text: 'Analyze this article' },
    
        {
    
          type: 'data-url',
    
          data: {
    
            url: 'https://example.com/article',
    
            title: 'Important Article',
    
            content: '...',
    
          },
    
        },
    
      ],
    
    });

**Including Code Files as Context** Let users reference code files in their conversations:
    
    
    convertDataPart: part => {
    
      if (part.type === 'data-code-file') {
    
        return {
    
          type: 'text',
    
          text: `\`\`\`${part.data.language}\n${part.data.code}\n\`\`\``,
    
        };
    
      }
    
    };

**Selective Inclusion** Only data parts for which you return a text or file model message part are included, all other data parts are ignored.
    
    
    const result = convertToModelMessages
    
    >(messages, {
    
      convertDataPart: part => {
    
        if (part.type === 'data-url') {
    
          return {
    
            type: 'text',
    
            text: `[${part.data.title}](${part.data.url})`,
    
          };
    
        }
    
    
    
    
        // data-code and data-node are ignored
    
      },
    
    });

### Type Safety

The generic parameter ensures full type safety for your custom data parts:
    
    
    type MyUIMessage = UIMessage;
    
    
    
    
    // TypeScript knows the exact shape of part.data
    
    convertToModelMessages(messages, {
    
      convertDataPart: part => {
    
        if (part.type === 'data-url') {
    
          // part.data is typed as { url: string; content: string }
    
          return { type: 'text', text: part.data.url };
    
        }
    
        return null;
    
      },
    
    });

Previous

useObject

Next

pruneMessages