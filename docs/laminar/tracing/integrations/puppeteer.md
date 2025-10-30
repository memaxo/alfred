---
title: Browser Observability for Puppeteer - Laminar documentation
url: 
language: en
---
[Skip to main content](https://docs.lmnr.ai/tracing/integrations/puppeteer#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Integrations

Browser Observability for Puppeteer

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Puppeteer integration](https://docs.lmnr.ai/tracing/integrations/puppeteer#puppeteer-integration)

[Puppeteer](https://pptr.dev/) is a framework for browser automation. It is natively supported in JavaScript and TypeScript.

Laminar excels at tracing browser agents by providing unified visibility into both browser session recordings and agent execution steps.

## [​](https://docs.lmnr.ai/tracing/integrations/puppeteer\#puppeteer-integration)  Puppeteer integration

Laminar has a native integration with Puppeteer for JavaScript. You simply need to initialize Laminar with your project API key and Puppeteer will be traced automatically.
We will hook into the API to create OpenTelemetry spans, but more importantly, we record browser session recordings.

Copy

```
import { Laminar } from '@lmnr-ai/lmnr';
import puppeteer from 'puppeteer'; // or 'puppeteer-core'

Laminar.initialize({
  projectApiKey: process.env.LMNR_API_KEY,
  instrumentModules: {
    puppeteer: puppeteer
  }
});

// The rest of your puppeteer code

```

[Playwright](https://docs.lmnr.ai/tracing/integrations/playwright) [Browser Use](https://docs.lmnr.ai/tracing/integrations/browser-use)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.