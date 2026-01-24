TroubleshootingServer Actions in Client Components

Copy markdown

# Server Actions in Client Components

You may use Server Actions in client components, but sometimes you may encounter the following issues.

## Issue

It is not allowed to define inline `"use server"` annotated Server Actions in Client Components.

## Solution

To use Server Actions in a Client Component, you can either:

- Export them from a separate file with `"use server"` at the top.
- Pass them down through props from a Server Component.
- Implement a combination of `createAI` and `useActions` hooks to access them.

Learn more about Server Actions and Mutations.

    'use server';




    import { generateText } from 'ai';

    import { openai } from '@ai-sdk/openai';




    export async function getAnswer(question: string) {

      'use server';




      const { text } = await generateText({

        model: openai.chat('gpt-3.5-turbo'),

        prompt: question,

      });




      return { answer: text };

    }

Previous

Client-Side Function Calls Not Invoked

Next

useChat/useCompletion stream output contains 0:... instead of text
