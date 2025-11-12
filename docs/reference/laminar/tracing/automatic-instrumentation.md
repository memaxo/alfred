---
title: Automatic LLM tracing with Laminar - Laminar documentation
url: 
language: en
---
[Skip to main content](https://docs.lmnr.ai/tracing/automatic-instrumentation#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing

Automatic LLM tracing with Laminar

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/automatic-instrumentation#overview)
- [Instrument all supported libraries](https://docs.lmnr.ai/tracing/automatic-instrumentation#instrument-all-supported-libraries)
- [Instrument specific libraries](https://docs.lmnr.ai/tracing/automatic-instrumentation#instrument-specific-libraries)
- [Disable Automatic Instrumentation](https://docs.lmnr.ai/tracing/automatic-instrumentation#disable-automatic-instrumentation)
- [Supported Libraries](https://docs.lmnr.ai/tracing/automatic-instrumentation#supported-libraries)
- [Integration-Specific Guides](https://docs.lmnr.ai/tracing/automatic-instrumentation#integration-specific-guides)
- [What Gets Traced](https://docs.lmnr.ai/tracing/automatic-instrumentation#what-gets-traced)
- [LLM Calls](https://docs.lmnr.ai/tracing/automatic-instrumentation#llm-calls)
- [Framework Operations](https://docs.lmnr.ai/tracing/automatic-instrumentation#framework-operations)
- [Error Handling](https://docs.lmnr.ai/tracing/automatic-instrumentation#error-handling)
- [Next Steps](https://docs.lmnr.ai/tracing/automatic-instrumentation#next-steps)

## [​](https://docs.lmnr.ai/tracing/automatic-instrumentation\#overview)  Overview

Simply by initializing Laminar at the start of your application, you can start tracing **prompts, responses, token usage, and costs** of LLM calls from:

- **LLM providers SDKs** (OpenAI, Anthropic, Gemini, etc.)
- **LLM Frameworks** (LangChain, LangGraph, Vercel AI SDK, Browser Use, etc.)
- **Vector database operations** (Pinecone, Qdrant, etc.)

To learn more about the integrations with the LLM frameworks and SDKs, see the [integrations](https://docs.lmnr.ai/tracing/integrations) section.

- JavaScript/TypeScript

- Python


In JavaScript/TypeScript, **recommended approach** is to specify which modules to instrument using the `instrumentModules` parameter.

Copy

```
import { Laminar } from '@lmnr-ai/lmnr';
import { OpenAI } from 'openai';

// Enable automatic instrumentation for specific modules
Laminar.initialize({
  projectApiKey: process.env.LMNR_PROJECT_API_KEY,
  instrumentModules: {
    openai: OpenAI
  }
});

// All OpenAI calls are now automatically traced
const client = new OpenAI();
const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }]
});

```

## [​](https://docs.lmnr.ai/tracing/automatic-instrumentation\#instrument-all-supported-libraries)  Instrument all supported libraries

This approach instruments all supported libraries automatically.

- JavaScript/TypeScript

- Python


Copy

```
import { Laminar } from '@lmnr-ai/lmnr';

// Initialize before importing LLM libraries
Laminar.initialize({
  projectApiKey: process.env.LMNR_PROJECT_API_KEY
});

// Import after initialization
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';

```

This approach may not work with all bundlers. If you encounter issues, use [selective instrumentation](https://docs.lmnr.ai/tracing/automatic-instrumentation#instrument-specific-libraries) instead.

## [​](https://docs.lmnr.ai/tracing/automatic-instrumentation\#instrument-specific-libraries)  Instrument specific libraries

For better control and compatibility, instrument only the libraries you need.

- JavaScript/TypeScript

- Python


**Recommended approach** for JavaScript/TypeScript applications:

Copy

```
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Laminar } from '@lmnr-ai/lmnr';

Laminar.initialize({
  projectApiKey: process.env.LMNR_PROJECT_API_KEY,
  instrumentModules: {
    openai: OpenAI,
    anthropic: Anthropic
  }
});

// Both OpenAI and Anthropic calls are now traced
const openaiClient = new OpenAI();
const anthropicClient = new Anthropic();

```

## [​](https://docs.lmnr.ai/tracing/automatic-instrumentation\#disable-automatic-instrumentation)  Disable Automatic Instrumentation

- JavaScript/TypeScript

- Python


Copy

```
import { Laminar } from '@lmnr-ai/lmnr';

Laminar.initialize({
  projectApiKey: process.env.LMNR_PROJECT_API_KEY,
  instrumentModules: {} // Empty object = no instrumentation
});

// No LLM calls will be automatically traced
// Use manual instrumentation instead

```

## [​](https://docs.lmnr.ai/tracing/automatic-instrumentation\#supported-libraries)  Supported Libraries

Laminar supports automatic instrumentation for a wide range of libraries:

- JavaScript/TypeScript

- Python


**LLM Providers:**

- OpenAI ( `openai`)
- Anthropic ( `@anthropic-ai/sdk`)
- Google AI ( `@google/generative-ai`)
- Cohere ( `cohere-ai`)

**Frameworks:**

- Vercel AI SDK ( `ai`)
- LangChain ( `langchain`, `@langchain/core`)

**Vector Databases:**

- Pinecone ( `@pinecone-database/pinecone`)
- Qdrant ( `@qdrant/js-client-rest`)

Show View complete list of supported modules

- `openAI`
- `anthropic`
- `azureOpenAI`
- `cohere`
- `bedrock`
- `google_vertexai`
- `google_aiplatform`
- `pinecone`
- `langchain`:

  - `chainsModule`
  - `agentsModule`
  - `toolsModule`
  - `runnablesModule`
  - `vectorStoreModule`
- `llamaIndex`
- `chromadb`
- `qdrant`
- `playwright`
- `puppeteer` / `puppeteer-core`

## [​](https://docs.lmnr.ai/tracing/automatic-instrumentation\#integration-specific-guides)  Integration-Specific Guides

Some frameworks require additional configuration:

- **Next.js applications**: See the [Next.js integration guide](https://docs.lmnr.ai/tracing/integrations/nextjs)
- **Vercel AI SDK**: See the [Vercel AI SDK guide](https://docs.lmnr.ai/tracing/integrations/vercel-ai-sdk)
- **LangChain**: See the [LangChain integration guide](https://docs.lmnr.ai/tracing/integrations/langchain)

## [​](https://docs.lmnr.ai/tracing/automatic-instrumentation\#what-gets-traced)  What Gets Traced

When automatic instrumentation is enabled, you’ll see detailed traces including:

### [​](https://docs.lmnr.ai/tracing/automatic-instrumentation\#llm-calls)  LLM Calls

- Request parameters (model, messages, temperature, etc.)
- Response content and metadata
- Token usage (input, output, total)
- Latency and performance metrics
- Automatic cost calculation

### [​](https://docs.lmnr.ai/tracing/automatic-instrumentation\#framework-operations)  Framework Operations

- Chain executions in LangChain
- Agent reasoning steps
- Tool calls and results
- Vector similarity searches

### [​](https://docs.lmnr.ai/tracing/automatic-instrumentation\#error-handling)  Error Handling

- Exception details and stack traces
- Retry attempts and failures
- Rate limiting and quota errors

## [​](https://docs.lmnr.ai/tracing/automatic-instrumentation\#next-steps)  Next Steps

Once automatic instrumentation is working:

1. **Add structure** with the [`observe` decorator](https://docs.lmnr.ai/tracing/structure/observe) to group related operations
2. **Organize traces** into [sessions](https://docs.lmnr.ai/tracing/structure/session) for multi-turn conversations
3. **Add metadata** for better filtering and analysis
4. **Set up evaluations** to monitor quality and performance

Automatic instrumentation provides comprehensive observability with minimal setup, making it easy to understand and optimize your LLM applications.

[Quickstart](https://docs.lmnr.ai/tracing/quickstart) [OpenAI](https://docs.lmnr.ai/tracing/integrations/openai)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.