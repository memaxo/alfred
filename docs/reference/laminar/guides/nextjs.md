---
title: Tracing LLM calls in Next.js with Laminar - Laminar documentation
url:
description: Next.js Integration with Laminar Tracing for AI Applications
language: en
---

[Skip to main content](https://docs.lmnr.ai/guides/nextjs#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing LLM calls in Next.js with Laminar

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/guides/nextjs#overview)
- [Setup](https://docs.lmnr.ai/guides/nextjs#setup)
- [Implementation](https://docs.lmnr.ai/guides/nextjs#implementation)
- [1\. instrumentation.ts](https://docs.lmnr.ai/guides/nextjs#1-instrumentation-ts)
- [2\. app/page.tsx](https://docs.lmnr.ai/guides/nextjs#2-app%2Fpage-tsx)
- [3\. app/api/chat/route.ts](https://docs.lmnr.ai/guides/nextjs#3-app%2Fapi%2Fchat%2Froute-ts)
- [4\. lib/openai.ts and lib/anthropic.ts](https://docs.lmnr.ai/guides/nextjs#4-lib%2Fopenai-ts-and-lib%2Fanthropic-ts)
- [5\. components/chat-ui.tsx](https://docs.lmnr.ai/guides/nextjs#5-components%2Fchat-ui-tsx)
- [Running the Application](https://docs.lmnr.ai/guides/nextjs#running-the-application)
- [Testing the Application](https://docs.lmnr.ai/guides/nextjs#testing-the-application)
- [Viewing Traces](https://docs.lmnr.ai/guides/nextjs#viewing-traces)
- [Key Features Demonstrated](https://docs.lmnr.ai/guides/nextjs#key-features-demonstrated)
- [Example Traces](https://docs.lmnr.ai/guides/nextjs#example-traces)
- [Troubleshooting](https://docs.lmnr.ai/guides/nextjs#troubleshooting)

## [​](https://docs.lmnr.ai/guides/nextjs#overview) Overview

We’ll explore a simple emotional support chat application built with Next.js that:

1. Provides a chat interface for users seeking emotional support
2. Uses OpenAI or Anthropic models to generate empathetic responses
3. Traces the entire process with Laminar

## [​](https://docs.lmnr.ai/guides/nextjs#setup) Setup

You can use the example app from our GitHub [repo](https://github.com/lmnr-ai/lmnr-ts/tree/main/examples/nextjs).Alternatively, for a clean install, follow these steps:

1

Initialize a Next.js app

Copy

```
npx create-next-app@latest

```

Learn more in the [Next.js docs](https://nextjs.org/docs/app/getting-started/installation).

2

Install Dependencies

Let’s now install the required packages:

Copy

```
npm install openai @anthropic-ai/sdk @lmnr-ai/lmnr

```

3

Environment Setup

Copy

```
cp .env.local.example .env.local

```

And then fill in the `.env.local` file.
Get [Laminar project API key](https://docs.lmnr.ai/tracing/introduction#2-initialize-laminar-in-your-application).
Get [OpenAI API key](https://platform.openai.com/api-keys).
Get [Anthropic API key](https://console.anthropic.com/settings/keys).

4

Update next.config.ts

Add the following to your `next.config.ts` file:

next.config.ts

Copy

```
const nextConfig = {
  serverExternalPackages: ['@lmnr-ai/lmnr'],
};

export default nextConfig;

```

This is because Laminar depends on OpenTelemetry, which uses some Node.js-specific functionality,
and we need to inform Next.js about it. Learn more in the [Next.js docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages).

5

Project Structure

The project has the following structure:

Copy

```
nextjs-app/
├── .env.local
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts
│   ├── page.tsx
│   └── layout.tsx
├── components/
│   └── chat-ui.tsx
├── lib/
│   └── openai.ts
│   └── anthropic.ts
├── instrumentation.ts
└── ...

```

## [​](https://docs.lmnr.ai/guides/nextjs#implementation) Implementation

Let’s look at the key components of our Next.js application with Laminar tracing:

### [​](https://docs.lmnr.ai/guides/nextjs#1-instrumentation-ts) 1\. instrumentation.ts

This file is crucial as it initializes Laminar for tracing.
Next.js automatically loads this file during initialization.

instrumentation.ts

Copy

```
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { Laminar } = await import('@lmnr-ai/lmnr')

    // Make sure to initialize Laminar **after** you initialize other
    // tracing libraries, e.g. `registerOTel` from `@vercel/otel`.
    Laminar.initialize({
      apiKey: process.env.LMNR_PROJECT_API_KEY,
    })
  }
}

```

Laminar only works in the ‘nodejs’ runtime of Next.js.Learn more about the `instrumentation.ts` file in the [Next.js docs](https://nextjs.org/docs/app/guides/instrumentation).

Laminar must be initialized at the entry point of the application, but after other tracing libraries are initialized.
For Next.js, the `instrumentation.ts` file is ideal for this purpose as it’s loaded early in the application lifecycle.

### [​](https://docs.lmnr.ai/guides/nextjs#2-app%2Fpage-tsx) 2\. app/page.tsx

This file contains the main page layout for our chat application:

app/page.tsx

Copy

```
import ChatUI from "@/components/chat-ui";

export default function Home() {
  return (
    <div className="grid grid-rows-[auto_1fr_auto] min-h-screen p-4 sm:p-6 font-[family-name:var(--font-geist-sans)]">
      <header className="py-4 text-center">
        <h1 className="text-2xl font-bold text-blue-600 mb-1">Therapy Chat</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
          A safe space to share your thoughts and receive supportive guidance.
          Your conversation is private and confidential.
        </p>
      </header>
      <main className="w-full max-w-4xl mx-auto my-4">
        <ChatUI />
      </main>
      <footer className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>AI-powered support | Not a substitute for professional medical advice</p>
      </footer>
    </div>
  );
}

```

### [​](https://docs.lmnr.ai/guides/nextjs#3-app%2Fapi%2Fchat%2Froute-ts) 3\. app/api/chat/route.ts

This file contains the API route handler that processes chat messages and communicates with the OpenAI API.Make sure to enable `experimental_telemetry` in the `generateText` function and pass the tracer to it.

app/api/chat/route.ts

Copy

```
import { openai } from "@lib/openai";
import { anthropic } from "@lib/anthropic";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, provider } = body;

    const llmProvider = provider ?? process.env.LLM_PROVIDER ?? "openai";

    // Create system message with therapeutic instructions
    const systemMessage = {
      role: 'system',
      content: `You are an AI-powered therapist assistant. Respond with empathy, understanding, and professionalism.
Your goal is to provide supportive responses that help the user process their feelings and thoughts.
Never give medical advice or diagnose conditions.`
    };

    let response;
    if (llmProvider === "openai") {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [systemMessage, ...messages],
      });
      response = completion.choices[0].message.content;
    } else if (llmProvider === "anthropic") {
      const completion = await anthropic.messages.create({
        model: "claude-3-5-haiku-latest",
        system: systemMessage.content,
        messages: messages,
        max_tokens: 1000,
      });
      response = completion.content[0].type === "text" ? completion.content[0].text : "";
    } else {
      throw new Error(`Unsupported provider: ${llmProvider}`);
    }
    return NextResponse.json({ message: response });

  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

```

### [​](https://docs.lmnr.ai/guides/nextjs#4-lib%2Fopenai-ts-and-lib%2Fanthropic-ts) 4\. lib/openai.ts and lib/anthropic.ts

These files contain the LLM clients, but more importantly patching those functions by Laminar.

lib/openai.ts

Copy

```
import { OpenAI } from "openai";
import { Laminar } from "@lmnr-ai/lmnr";
Laminar.patch({
    OpenAI: OpenAI
});

const openai = new OpenAI();
export { openai };

```

lib/anthropic.ts

Copy

```
import * as anthropic from "@anthropic-ai/sdk";
import { Laminar } from "@lmnr-ai/lmnr";
Laminar.patch({
    anthropic: anthropic
});

const anthropicClient = new anthropic.Anthropic();

export { anthropicClient as anthropic };

```

### [​](https://docs.lmnr.ai/guides/nextjs#5-components%2Fchat-ui-tsx) 5\. components/chat-ui.tsx

This component handles the chat interface and manages the chat state.Feel free to modify the UI as you see fit, this is just an example.

components/chat-ui.tsx

Copy

```
'use client'

import { useState, useRef, useEffect } from "react";

type Message = {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([\
    {\
      role: 'assistant',\
      content: "Hello, I'm here to help. Feel free to share your thoughts or concerns, and I'll listen and provide support. What's on your mind today?"\
    }\
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() === "") return;

    // Add user message
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Call API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          provider
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get a response");
      }

      const data = await response.json();

      // Add assistant's response
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (error) {
      console.error("Error:", error);
      setMessages(prev => [...prev, {\
        role: 'assistant',\
        content: "I'm sorry, I'm having trouble responding right now. Please try again in a moment."\
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto h-[70vh]">
      <div className="mb-4 flex justify-end">
        <div className="flex items-center">
          <label htmlFor="provider" className="mr-2 text-sm text-gray-700 dark:text-gray-300">Provider:</label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as "openai" | "anthropic")}
            className="border rounded-md py-1 px-2 text-sm bg-white dark:bg-gray-800
                      text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-t-lg p-4 border border-gray-200 dark:border-gray-700 overflow-y-auto flex-grow">
        <div className="space-y-4">
          {messages.map((message, i) => (
            <div key={i} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${message.role === 'user'
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                  }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex items-center border border-gray-200 dark:border-gray-700 rounded-b-lg overflow-hidden">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message here..."
          className="flex-grow mt-2 p-4 focus:outline-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 resize-none"
          disabled={isLoading}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-600 text-white p-4 disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </form>
    </div>
  );
}

```

See all 144 lines

## [​](https://docs.lmnr.ai/guides/nextjs#running-the-application) Running the Application

Start the Next.js development server:

Copy

```
npm run dev

```

## [​](https://docs.lmnr.ai/guides/nextjs#testing-the-application) Testing the Application

1. Navigate to `http://localhost:3000` in your browser
2. Interact with the chat interface by typing messages

## [​](https://docs.lmnr.ai/guides/nextjs#viewing-traces) Viewing Traces

After interacting with the chat, you can view the traces in your Laminar dashboard at [https://www.lmnr.ai](https://www.lmnr.ai/). The trace will show:

1. The Next.js API route execution
2. The OpenAI or Anthropic API calls
3. Token usage and response details

## [​](https://docs.lmnr.ai/guides/nextjs#key-features-demonstrated) Key Features Demonstrated

1. **Next.js Instrumentation**: Using Next.js’s instrumentation API to initialize Laminar
2. **OpenAI or Anthropic Tracing**: Automatic tracing of OpenAI or Anthropic API calls
3. **Token Usage**: Automatic calculation of tokens used for each OpenAI or Anthropic call
4. **Cost Estimation**: Automatic estimation of the cost of each OpenAI or Anthropic call

## [​](https://docs.lmnr.ai/guides/nextjs#example-traces) Example Traces

![Next.js Example Traces](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/tutorials/nextjs-guide-example-trace.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=c8f81b2ffe40b4b6774ebbe003867c0e)

A screenshot of a trace from the example app.

## [​](https://docs.lmnr.ai/guides/nextjs#troubleshooting) Troubleshooting

If you encounter issues:

- Check that your API keys are correctly set in the `.env.local` file
- Verify that Laminar is properly initialized in the `instrumentation.ts` file
- Verify that the `next.config.ts` file is correctly configured
- Verify that Laminar.patch is called after LLM SDKs are imported
- Ensure all dependencies are installed
- Review the Next.js logs for any application errors

[Tracing AI SDK in Next.js](https://docs.lmnr.ai/guides/nextjs-aisdk) [Evaluating Tool Calls](https://docs.lmnr.ai/guides/evaluating-tool-calls)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Next.js Example Traces](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/tutorials/nextjs-guide-example-trace.png?w=840&fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=24bf86bcf85c59a4d2f84546e4b510ee)
