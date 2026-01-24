---
title: Get started with Laminar tracing. - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/quickstart#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing

Get started with Laminar tracing.

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [1\. Get Your Project API Key](https://docs.lmnr.ai/tracing/quickstart#1-get-your-project-api-key)
- [2\. Initialize Laminar in Your Application](https://docs.lmnr.ai/tracing/quickstart#2-initialize-laminar-in-your-application)
- [3\. That’s it! Your LLM API Calls Are Now Traced](https://docs.lmnr.ai/tracing/quickstart#3-that%E2%80%99s-it-your-llm-api-calls-are-now-traced)
- [Tracing Custom Functions](https://docs.lmnr.ai/tracing/quickstart#tracing-custom-functions)
- [Next Steps](https://docs.lmnr.ai/tracing/quickstart#next-steps)

### [​](https://docs.lmnr.ai/tracing/quickstart#1-get-your-project-api-key) 1\. Get Your Project API Key

To get your Project API Key, navigate to your project settings page on the Laminar dashboard and create new project API key.Next, you’ll need to set this key as an environment variable in your project. Create a `.env` file in the root of your project (if you don’t have one already) and add the following line:

Copy

```
LMNR_PROJECT_API_KEY=your_project_api_key_here

```

Replace `your_project_api_key_here` with the actual key you copied.

### [​](https://docs.lmnr.ai/tracing/quickstart#2-initialize-laminar-in-your-application) 2\. Initialize Laminar in Your Application

Adding just two lines to your application enables comprehensive tracing:

- JavaScript/TypeScript

- Python

Copy

```
import { Laminar } from '@lmnr-ai/lmnr';
import { OpenAI } from 'openai';
Laminar.initialize({
    projectApiKey: process.env.LMNR_PROJECT_API_KEY,
    instrumentModules: {
        openAI: OpenAI,
        // add other libraries as you need
    }
});

```

Laminar should be initialized once in your application. This could be
at the server startup, or in the entry point of your application.

This will automatically instrument all major LLM provider SDKs, LLM frameworks including
LangChain and LlamaIndex, and calls to vector databases.

For Node JS setups, you need to manually pass the modules you want to instrument, such as OpenAI.
See the section on [automatic instrumentation](https://docs.lmnr.ai/tracing/automatic-instrumentation#instrument-specific-modules-only).

For more information, refer to the [instrumentation docs](https://docs.lmnr.ai/tracing/automatic-instrumentation).

### [​](https://docs.lmnr.ai/tracing/quickstart#3-that%E2%80%99s-it-your-llm-api-calls-are-now-traced) 3\. That’s it! Your LLM API Calls Are Now Traced

Once initialized, Laminar automatically traces LLM API calls. For example, after initialization, this standard OpenAI call:

- JavaScript/TypeScript

- Python

Copy

```

// Laminar was initialized before this code

import { OpenAI } from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "What is the capital of France?" }],
});

```

Will automatically create a span in your Laminar dashboard:

![OpenAI span visualization](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/trace-openai.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=40091bf165a5a0087ecb5d4794e78c7d)

Laminar automatically captures important LLM metrics including latency, token usage, and cost calculations based on the specific model used.

## [​](https://docs.lmnr.ai/tracing/quickstart#tracing-custom-functions) Tracing Custom Functions

Beyond automatic LLM tracing, you can use the `observe` decorator/wrapper to trace specific functions in your application:

- JavaScript/TypeScript

- Python

You can instrument specific functions by wrapping them in `observe()`.
This is especially helpful when you want to trace functions, or group
separate functions into a single trace.

Copy

```
import { observe } from '@lmnr-ai/lmnr';

const myFunction = async () => observe(
  { name: 'myFunction'},
  async () => {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "What is the capital of France?" }],
    });
    return response.choices[0].message.content;
  }
);

await myFunction();

```

We are now recording `my_function` _and_ the OpenAI call, which is nested inside it, in the same trace. Notice that the OpenAI span is a child of `my_function`. Parent-child relationships are automatically detected and visualized with tree hierarchy.

![OpenAI span as a child](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/trace-observe.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=f54ccbac5b36b211001251b4239ed861)

You can nest as many spans as you want inside each other. By observing both the functions and the LLM/vector DB calls
you can have better visualization of execution flow which is useful for debugging and better understanding of the application.

Input arguments to the function are automatically recorded as inputs of the span. The return value is automatically recorded as the output of the span.Passing arguments to the function in TypeScript is slightly non-obvious. Example:

Copy

```
const myFunction = async () => observe(
  { name: 'myFunction' },
  async (param1, param2) => {
    // ...
  }
  'argValue1',
  'argValue2'
);

```

## [​](https://docs.lmnr.ai/tracing/quickstart#next-steps) Next Steps

- Explore our integrations to see how Laminar works with your favorite tools:
  - [OpenAI](https://docs.lmnr.ai/tracing/integrations/openai)
  - [Anthropic](https://docs.lmnr.ai/tracing/integrations/anthropic)
  - [Gemini](https://docs.lmnr.ai/tracing/integrations/gemini)
  - [Langchain](https://docs.lmnr.ai/tracing/integrations/langchain)
  - [Next.js](https://docs.lmnr.ai/tracing/integrations/nextjs)
  - [Vercel AI SDK](https://docs.lmnr.ai/tracing/integrations/vercel-ai-sdk)
  - [LiteLLM](https://docs.lmnr.ai/tracing/integrations/litellm)
  - [Playwright](https://docs.lmnr.ai/tracing/integrations/playwright)
  - [Browser Use](https://docs.lmnr.ai/tracing/integrations/browser-use)
  - [Stagehand](https://docs.lmnr.ai/tracing/integrations/stagehand)
  - [Puppeteer](https://docs.lmnr.ai/tracing/integrations/puppeteer)
- Continue to [Trace Structure](https://docs.lmnr.ai/tracing/structure) to learn more about adding structure to your traces.
- Explore [Browser agent observability](https://docs.lmnr.ai/tracing/browser-agent-observability) to trace browser sessions and agent execution steps.
- If you want to get into details on OpenTelemetry, check out the in-depth [OpenTelemetry guide](https://docs.lmnr.ai/tracing/otel).

[Introduction](https://docs.lmnr.ai/tracing/introduction) [Automatic LLM tracing](https://docs.lmnr.ai/tracing/automatic-instrumentation)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![OpenAI span visualization](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/trace-openai.png?w=840&fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=949d047329d2d6be117435a83f06e0b0)

![OpenAI span as a child](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/trace-observe.png?w=840&fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=c7136e18a6e60b1524fbfb3ec13885bc)
