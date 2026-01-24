---
title: Browser Observability for Playwright - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/integrations/playwright#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Integrations

Browser Observability for Playwright

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Playwright integration](https://docs.lmnr.ai/tracing/integrations/playwright#playwright-integration)

[Playwright](https://playwright.dev/) is a framework for browser automation. It has bindings for both JavaScript and Python.

Laminar excels at tracing browser agents by providing unified visibility into both browser session recordings and agent execution steps.

## [​](https://docs.lmnr.ai/tracing/integrations/playwright#playwright-integration) Playwright integration

Laminar has a native integration with Playwright for both JavaScript and Python. You simply need to initialize Laminar with your project API key and Playwright will be traced automatically.
We will hook into the API to create OpenTelemetry spans, but more importantly, we record browser session recordings.

- JavaScript/Typescript

- Python

Copy

```
import { Laminar } from '@lmnr-ai/lmnr';
import { chromium } from 'playwright';

Laminar.initialize({
  projectApiKey: process.env.LMNR_API_KEY,
  instrumentModules: {
    playwright: {
      chromium
    }
  }
});

// The rest of your playwright code

```

[LiteLLM](https://docs.lmnr.ai/tracing/integrations/litellm) [Puppeteer](https://docs.lmnr.ai/tracing/integrations/puppeteer)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.
