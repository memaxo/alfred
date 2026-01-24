---
title: LLM Observability for Anthropic SDK - Laminar documentation
url:
description: Instrument your Anthropic API calls with Laminar
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/integrations/anthropic#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Integrations

LLM Observability for Anthropic SDK

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/integrations/anthropic#overview)
- [Getting Started](https://docs.lmnr.ai/tracing/integrations/anthropic#getting-started)
- [1\. Install Laminar and Anthropic](https://docs.lmnr.ai/tracing/integrations/anthropic#1-install-laminar-and-anthropic)
- [2\. Set up your environment variables](https://docs.lmnr.ai/tracing/integrations/anthropic#2-set-up-your-environment-variables)
- [3\. Initialize Laminar](https://docs.lmnr.ai/tracing/integrations/anthropic#3-initialize-laminar)
- [4\. Use Anthropic as usual](https://docs.lmnr.ai/tracing/integrations/anthropic#4-use-anthropic-as-usual)
- [Monitoring Your Anthropic Usage](https://docs.lmnr.ai/tracing/integrations/anthropic#monitoring-your-anthropic-usage)
- [Advanced Features](https://docs.lmnr.ai/tracing/integrations/anthropic#advanced-features)

## [​](https://docs.lmnr.ai/tracing/integrations/anthropic#overview) Overview

Laminar automatically instruments the official Anthropic package with a single line of code, allowing you to trace and monitor all your Anthropic API calls without modifying your existing code. This provides complete visibility into your AI application’s performance, costs, and behavior.

## [​](https://docs.lmnr.ai/tracing/integrations/anthropic#getting-started) Getting Started

- TypeScript

- Python

### [​](https://docs.lmnr.ai/tracing/integrations/anthropic#1-install-laminar-and-anthropic) 1\. Install Laminar and Anthropic

Copy

```
npm install @lmnr-ai/lmnr @anthropic-ai/sdk

```

### [​](https://docs.lmnr.ai/tracing/integrations/anthropic#2-set-up-your-environment-variables) 2\. Set up your environment variables

Store your API keys in a `.env` file:

Copy

```
# .env file
LMNR_PROJECT_API_KEY=your-laminar-project-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

```

Then load them in your application using a package like [dotenv](https://www.npmjs.com/package/dotenv).

If you are using Anthropic with Next.js, please follow the [Next.js integration guide](https://docs.lmnr.ai/tracing/integrations/nextjs) for best practices and setup instructions.

### [​](https://docs.lmnr.ai/tracing/integrations/anthropic#3-initialize-laminar) 3\. Initialize Laminar

Just add a single line at the start of your application or file to instrument Anthropic with Laminar.

Copy

```
import { Laminar } from '@lmnr-ai/lmnr';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config'; // Load environment variables

// This single line instruments all Anthropic API calls
Laminar.initialize({
  instrumentModules: { anthropic: Anthropic }
});

// Initialize Anthropic client as usual
const anthropic = new Anthropic();

```

It is important to pass `Anthropic` to `instrumentModules` as a named export.

### [​](https://docs.lmnr.ai/tracing/integrations/anthropic#4-use-anthropic-as-usual) 4\. Use Anthropic as usual

Copy

```
// Make API calls to Anthropic as you normally would
const response = await anthropic.messages.create({
  model: "claude-3-7-sonnet",
  max_tokens: 1024,
  messages: [\
    { role: "user", content: "Hello, how are you?" }\
  ],
});

console.log(response.content);

```

All Anthropic API calls are now automatically traced in Laminar.

These features allow you to build more structured traces, add context to your LLM calls, and gain deeper insights into your AI application’s performance.

## [​](https://docs.lmnr.ai/tracing/integrations/anthropic#monitoring-your-anthropic-usage) Monitoring Your Anthropic Usage

After instrumenting your Anthropic calls with Laminar, you’ll be able to:

1. **View detailed traces** of each Anthropic API call, including request and response
2. **Track token usage and cost** across different models
3. **Monitor latency** and performance metrics
4. **Open LLM span in Playground** for prompt engineering
5. **Debug issues** with failed API calls or unexpected model outputs

Visit your Laminar dashboard to view your Anthropic traces and analytics.

## [​](https://docs.lmnr.ai/tracing/integrations/anthropic#advanced-features) Advanced Features

- [Sessions](https://docs.lmnr.ai/tracing/structure/session) \- Learn how to add session structure to your traces
- [Metadata](https://docs.lmnr.ai/tracing/structure/metadata) \- Discover how to add additional context to your LLM spans
- [Trace structure](https://docs.lmnr.ai/tracing/structure) \- Explore creating custom spans and more advanced tracing
- [Realtime Monitoring](https://docs.lmnr.ai/tracing/realtime) \- See how to monitor your Anthropic calls in real-time

[OpenAI](https://docs.lmnr.ai/tracing/integrations/openai) [Gemini](https://docs.lmnr.ai/tracing/integrations/gemini)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
