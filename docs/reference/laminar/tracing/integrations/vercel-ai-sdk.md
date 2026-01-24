---
title: LLM Observability for AI SDK by Vercel - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/integrations/vercel-ai-sdk#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Integrations

LLM Observability for AI SDK by Vercel

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

[AI SDK](https://sdk.vercel.ai/docs/introduction) is a library that allows you to add LLM features to your JS/TS applications. It supports tracing using [OpenTelemetry](https://opentelemetry.io/).Laminar tracing is based on OpenTelemetry, so it is fully compatible with Vercel AI SDK tracing and you can start sending Vercel AI SDK traces to Laminar right away.

1

Get your project API key

To get the project API key, go to the Laminar dashboard, click the project settings,
and generate a project API key. This is available both in the cloud and in the self-hosted version of Laminar.Specify the key at `Laminar` initialization. If not specified,
Laminar will look for the key in the `LMNR_PROJECT_API_KEY` environment variable.

2

Initialize Laminar

- Next.js

- Node.js

In Next.js, place `Laminar.initialize` in the `instrumentation.ts` file.

instrumentation.ts

Copy

```
export async function register() {
  // prevent this from running in the edge runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { Laminar } = await import('@lmnr-ai/lmnr');

    Laminar.initialize({
      projectApiKey: process.env.LMNR_PROJECT_API_KEY,
    });
  }
}

```

You will also need to update your `next.config.ts` file to include the `serverExternalPackages` option.

next.config.ts

Copy

```
const nextConfig = {
  serverExternalPackages: ['@lmnr-ai/lmnr'],
};

```

This is because Laminar depends on OpenTelemetry, which uses some Node.js-specific functionality, and we need to inform Next.js about it. Learn more in the [Next.js docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages).

3

Update your AI SDK calls

We need to pass the Laminar tracer to the `generateText`, or `streamText`, or any other `generate*` calls.

Copy

```
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { getTracer } from '@lmnr-ai/lmnr';

const { text } = await generateText({
  model: openai('gpt-4.1-nano'),
  prompt: 'What is Laminar flow?',
  experimental_telemetry: {
    isEnabled: true,
    tracer: getTracer(),
  },
});

```

[Next.js](https://docs.lmnr.ai/tracing/integrations/nextjs) [LiteLLM](https://docs.lmnr.ai/tracing/integrations/litellm)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
