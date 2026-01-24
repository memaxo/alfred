---
title: Observability for Next.js - Laminar documentation
url:
description: Instrument your Next.js app based on App Router with Laminar
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/integrations/nextjs#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Integrations

Observability for Next.js

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/integrations/nextjs#overview)
- [Getting Started](https://docs.lmnr.ai/tracing/integrations/nextjs#getting-started)
- [1\. Install Laminar](https://docs.lmnr.ai/tracing/integrations/nextjs#1-install-laminar)
- [2\. Update your next.config.ts](https://docs.lmnr.ai/tracing/integrations/nextjs#2-update-your-next-config-ts)
- [3\. Initialize Laminar](https://docs.lmnr.ai/tracing/integrations/nextjs#3-initialize-laminar)
- [4\. Patch LLM SDKs](https://docs.lmnr.ai/tracing/integrations/nextjs#4-patch-llm-sdks)
- [5\. Grouping traces within one route](https://docs.lmnr.ai/tracing/integrations/nextjs#5-grouping-traces-within-one-route)

## [​](https://docs.lmnr.ai/tracing/integrations/nextjs#overview) Overview

[Next.js](https://nextjs.org/) is a popular React framework for building web applications.

For a full example app, see [the Next.js guide](https://docs.lmnr.ai/guides/nextjs) and the [Next.js + AI SDK guide](https://docs.lmnr.ai/guides/nextjs-aisdk).

## [​](https://docs.lmnr.ai/tracing/integrations/nextjs#getting-started) Getting Started

### [​](https://docs.lmnr.ai/tracing/integrations/nextjs#1-install-laminar) 1\. Install Laminar

Copy

```
npm add @lmnr-ai/lmnr

```

### [​](https://docs.lmnr.ai/tracing/integrations/nextjs#2-update-your-next-config-ts) 2\. Update your next.config.ts

Add the following to your `next.config.ts` file:

next.config.ts

Copy

```
const nextConfig = {
  serverExternalPackages: ['@lmnr-ai/lmnr'],
};

export default nextConfig;

```

This is because Laminar depends on OpenTelemetry, which uses some Node.js-specific functionality, and we need to inform Next.js about it. Learn more in the [Next.js docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages).

### [​](https://docs.lmnr.ai/tracing/integrations/nextjs#3-initialize-laminar) 3\. Initialize Laminar

To instrument your entire Next.js app, place Laminar initialization in `instrumentation.{ts,js}` file. Learn more about `instrumentation.{ts,js}` [here](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation).

instrumentation.ts

Copy

```
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { Laminar } = await import('@lmnr-ai/lmnr');
    Laminar.initialize({
      projectApiKey: process.env.LMNR_API_KEY,
    });
  }
}

```

`instrumentation.ts` is experimental in Next.js < 15.

If you use Next.js < 15, add the following to your `next.config.js`:

next.config.js

Copy

```
module.exports = {
    experimental: { instrumentationHook: true }
};

```

### [​](https://docs.lmnr.ai/tracing/integrations/nextjs#4-patch-llm-sdks) 4\. Patch LLM SDKs

- AI SDKs

- Other LLM SDKs

AI SDK is already instrumented implicitly, but you need to direct it to use Laminar tracer.

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

### [​](https://docs.lmnr.ai/tracing/integrations/nextjs#5-grouping-traces-within-one-route) 5\. Grouping traces within one route

If your app makes multiple LLM calls within one route, you may want to group them together.You might get this functionality by default, if your app is instrumented with OpenTelemetry and
some Next.js instrumentation, e.g. `@vercel/otel` or `@sentry/nextjs`.Otherwise, you can achieve this by using `observe` function wrapper, e.g. something like

app/api/chat/route.ts

Copy

```
import { NextRequest } from 'next/server';
import { getTracer, observe } from '@lmnr-ai/lmnr';

export const GET = observe(async (req: NextRequest) => {
  const tracer = getTracer();

  const { firstText, secondText } = await observe(
    {
      name: 'GET /api/chat',
    },
    async () => {
      const { firstText } = await generateText({
      model: openai('gpt-4.1-nano'),
      prompt: 'What is Laminar flow?',
      experimental_telemetry: {
        isEnabled: true,
        tracer,
      },
    });

    const { secondText } = await generateText({
      model: openai('gpt-4.1-nano'),
      prompt: 'What is Laminar flow?',
      experimental_telemetry: {
        isEnabled: true,
        tracer,
      },
    });

    return { firstText, secondText };
    }
  );

  return NextResponse.json({ firstText, secondText });
});

```

Learn more about `observe` function wrapper [here](https://docs.lmnr.ai/tracing/structure/observe).

[Cohere](https://docs.lmnr.ai/tracing/integrations/cohere) [Vercel AI SDK](https://docs.lmnr.ai/tracing/integrations/vercel-ai-sdk)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
