AI SDK UIMessage Metadata

Copy markdown

# Message Metadata

Message metadata allows you to attach custom information to messages at the message level. This is useful for tracking timestamps, model information, token usage, user context, and other message-level data.

## Overview

Message metadata differs from data parts in that it's attached at the message level rather than being part of the message content. While data parts are ideal for dynamic content that forms part of the message, metadata is perfect for information about the message itself.

## Getting Started

Here's a simple example of using message metadata to track timestamps and model information:

### Defining Metadata Types

First, define your metadata type for type safety:

app/types.ts

    import { UIMessage } from 'ai';

    import { z } from 'zod';




    // Define your metadata schema

    export const messageMetadataSchema = z.object({

      createdAt: z.number().optional(),

      model: z.string().optional(),

      totalTokens: z.number().optional(),

    });




    export type MessageMetadata = z.infer;




    // Create a typed UIMessage

    export type MyUIMessage = UIMessage;

### Sending Metadata from the Server

Use the `messageMetadata` callback in `toUIMessageStreamResponse` to send metadata at different streaming stages:

app/api/chat/route.ts

    import { openai } from '@ai-sdk/openai';

    import { convertToModelMessages, streamText } from 'ai';

    import type { MyUIMessage } from '@/types';




    export async function POST(req: Request) {

      const { messages }: { messages: MyUIMessage[] } = await req.json();




      const result = streamText({

        model: openai('gpt-4o'),

        messages: convertToModelMessages(messages),

      });




      return result.toUIMessageStreamResponse({

        originalMessages: messages, // pass this in for type-safe return objects

        messageMetadata: ({ part }) => {

          // Send metadata when streaming starts

          if (part.type === 'start') {

            return {

              createdAt: Date.now(),

              model: 'gpt-4o',

            };

          }




          // Send additional metadata when streaming completes

          if (part.type === 'finish') {

            return {

              totalTokens: part.totalUsage.totalTokens,

            };

          }

        },

      });

    }

To enable type-safe metadata return object in `messageMetadata`, pass in the `originalMessages` parameter typed to your UIMessage type.

### Accessing Metadata on the Client

Access metadata through the `message.metadata` property:

app/page.tsx

    'use client';




    import { useChat } from '@ai-sdk/react';

    import { DefaultChatTransport } from 'ai';

    import type { MyUIMessage } from '@/types';




    export default function Chat() {

      const { messages } = useChat({

        transport: new DefaultChatTransport({

          api: '/api/chat',

        }),

      });




      return (



          {messages.map(message => (





                {message.role === 'user' ? 'User: ' : 'AI: '}

                {message.metadata?.createdAt && (



                    {new Date(message.metadata.createdAt).toLocaleTimeString()}



                )}






              {/* Render message content */}

              {message.parts.map((part, index) =>

                part.type === 'text' ? {part.text} : null,

              )}




              {/* Display additional metadata */}

              {message.metadata?.totalTokens && (



                  {message.metadata.totalTokens} tokens



              )}



          ))}



      );

    }

For streaming arbitrary data that changes during generation, consider using data parts instead.

## Common Use Cases

Message metadata is ideal for:

- **Timestamps** : When messages were created or completed
- **Model Information** : Which AI model was used
- **Token Usage** : Track costs and usage limits
- **User Context** : User IDs, session information
- **Performance Metrics** : Generation time, time to first token
- **Quality Indicators** : Finish reason, confidence scores

## See Also

- Chatbot Guide \- Message metadata in the context of building chatbots
- Streaming Data \- Comparison with data parts
- UIMessage Reference \- Complete UIMessage type reference

Previous

Reading UIMessage Streams

Next

Stream Protocols
