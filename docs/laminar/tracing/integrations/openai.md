---
title: LLM Observability for OpenAI SDK in JS and Python - Laminar documentation
url: 
description: Instrument your OpenAI API calls with Laminar
language: en
---
[Skip to main content](https://docs.lmnr.ai/tracing/integrations/openai#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Integrations

LLM Observability for OpenAI SDK in JS and Python

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/integrations/openai#overview)
- [Getting Started](https://docs.lmnr.ai/tracing/integrations/openai#getting-started)
- [1\. Install Laminar and OpenAI](https://docs.lmnr.ai/tracing/integrations/openai#1-install-laminar-and-openai)
- [2\. Set up your environment variables](https://docs.lmnr.ai/tracing/integrations/openai#2-set-up-your-environment-variables)
- [3\. Initialize Laminar](https://docs.lmnr.ai/tracing/integrations/openai#3-initialize-laminar)
- [4\. Use OpenAI as usual](https://docs.lmnr.ai/tracing/integrations/openai#4-use-openai-as-usual)
- [Monitoring Your OpenAI Usage](https://docs.lmnr.ai/tracing/integrations/openai#monitoring-your-openai-usage)
- [Advanced Features](https://docs.lmnr.ai/tracing/integrations/openai#advanced-features)

## [​](https://docs.lmnr.ai/tracing/integrations/openai\#overview)  Overview

Laminar automatically instruments the official OpenAI package with a single line of code, allowing you to trace and monitor all your OpenAI API calls without modifying your existing code. This provides complete visibility into your AI application’s performance, costs, and behavior.

## [​](https://docs.lmnr.ai/tracing/integrations/openai\#getting-started)  Getting Started

- TypeScript

- Python


### [​](https://docs.lmnr.ai/tracing/integrations/openai\#1-install-laminar-and-openai)  1\. Install Laminar and OpenAI

Copy

```
npm install @lmnr-ai/lmnr openai

```

### [​](https://docs.lmnr.ai/tracing/integrations/openai\#2-set-up-your-environment-variables)  2\. Set up your environment variables

Store your API keys in a `.env` file:

Copy

```
# .env file
LMNR_PROJECT_API_KEY=your-laminar-project-api-key
OPENAI_API_KEY=your-openai-api-key

```

Then load them in your application using a package like [dotenv](https://www.npmjs.com/package/dotenv).

If you are using OpenAI with Next.js, please follow the [Next.js integration guide](https://docs.lmnr.ai/tracing/integrations/nextjs) for best practices and setup instructions.

### [​](https://docs.lmnr.ai/tracing/integrations/openai\#3-initialize-laminar)  3\. Initialize Laminar

Just add a single line at the start of your application or file to instrument OpenAI with Laminar.

Copy

```
import { Laminar } from '@lmnr-ai/lmnr';
import OpenAI from 'openai';
import 'dotenv/config'; // Load environment variables

// This single line instruments all OpenAI API calls
Laminar.initialize({
  instrumentModules: { OpenAI: OpenAI }
});

// Initialize OpenAI client as usual
const openai = new OpenAI();

```

It is important to pass `OpenAI` to `instrumentModules` as a named export.

### [​](https://docs.lmnr.ai/tracing/integrations/openai\#4-use-openai-as-usual)  4\. Use OpenAI as usual

Copy

```
// Make API calls to OpenAI as you normally would
const response = await openai.chat.completions.create({
  model: "gpt-4.1-mini",
  messages: [\
    { role: "system", content: "You are a helpful assistant." },\
    { role: "user", content: "Hello, how are you?" }\
  ],
});

console.log(response.choices[0].message.content);

```

All OpenAI API calls are now automatically traced in Laminar.

These features allow you to build more structured traces, add context to your LLM calls, and gain deeper insights into your AI application’s performance.

## [​](https://docs.lmnr.ai/tracing/integrations/openai\#monitoring-your-openai-usage)  Monitoring Your OpenAI Usage

After instrumenting your OpenAI calls with Laminar, you’ll be able to:

1. **View detailed traces** of each OpenAI API call, including request and response
2. **Track token usage and cost** across different models
3. **Monitor latency** and performance metrics
4. **Open LLM span in Playground** for prompt engineering
5. **Debug issues** with failed API calls or unexpected model outputs

Visit your Laminar dashboard to view your OpenAI traces and analytics.

## [​](https://docs.lmnr.ai/tracing/integrations/openai\#advanced-features)  Advanced Features

- [Sessions](https://docs.lmnr.ai/tracing/structure/session) \- Learn how to add session structure to your traces
- [Metadata](https://docs.lmnr.ai/tracing/structure/metadata) \- Discover how to add additional context to your LLM spans
- [Trace structure](https://docs.lmnr.ai/tracing/structure) \- Explore creating custom spans and more advanced tracing
- [Realtime Monitoring](https://docs.lmnr.ai/tracing/realtime) \- See how to monitor your OpenAI calls in real-time

[Automatic LLM tracing](https://docs.lmnr.ai/tracing/automatic-instrumentation) [Anthropic](https://docs.lmnr.ai/tracing/integrations/anthropic)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.