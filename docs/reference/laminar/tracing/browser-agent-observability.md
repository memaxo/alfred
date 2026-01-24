---
title: Browser agent observability - Laminar documentation
url:
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/browser-agent-observability#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing

Browser agent observability

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/browser-agent-observability#overview)
- [How does it work?](https://docs.lmnr.ai/tracing/browser-agent-observability#how-does-it-work%3F)
- [Example](https://docs.lmnr.ai/tracing/browser-agent-observability#example)

## [​](https://docs.lmnr.ai/tracing/browser-agent-observability#overview) Overview

Laminar has an extensive observability suite for browser agents. If you are
building browser agents, you can use Laminar to trace them and record the browser sessions.That is, by default, you will get both the LLM calls traces and a session recording of
the browser sessions.

## [​](https://docs.lmnr.ai/tracing/browser-agent-observability#how-does-it-work%3F) How does it work?

Laminar traces the LLM calls using automatic instrumentations provided by OpenLLMetry.In addition, Laminar instruments popular browser automation frameworks (integrations with [Puppeteer](https://docs.lmnr.ai/tracing/integrations/puppeteer), [Playwright](https://docs.lmnr.ai/tracing/integrations/playwright), [Stagehand](https://docs.lmnr.ai/tracing/integrations/stagehand), [BrowserUse](https://docs.lmnr.ai/tracing/integrations/browser-use), and [Skyvern](https://docs.lmnr.ai/tracing/integrations/skyvern)) and records the browser sessions.

## [​](https://docs.lmnr.ai/tracing/browser-agent-observability#example) Example

Here is an example of a simple browser agent that uses Playwright to navigate to a website and extract the title.

If you don’t have a project API key, you can get one by signing up on [Laminar](https://lmnr.ai/) or spinning up a [self-hosted instance](https://docs.lmnr.ai/self-hosting/setup) and getting a key from the project settings.

- JavaScript/TypeScript

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
    },
    // add other libraries as you need
  }
});

async function main() {
  const page = await browser.newPage();

  await page.goto('https://www.duckduckgo.com/');

  await page.locator('input[name="q"]').fill('Laminar observability');

  await page.locator('input[name="q"]').press('Enter');
  const textSelector = await page.locator('a', { hasText: 'www.lmnr.ai' }).first();
  await textSelector?.waitFor();
  await textSelector?.click();
  const title = await page.title();
  await page.waitForLoadState('load');
  console.log('Title of this page is', title);
  await browser.close();
}

main().then(() => Laminar.shutdown().then(() => {
  console.log('Done!');
}));

```

As a result, you will get a trace and a recording like this![Example Playwright Trace with session recording](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/traces/playwright-simple-trace.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=95a75e247fc7e6b3786d66a91b1b3570)A more complex trace may look like this. This was recorded by running Laminar Index browser agent.![Example complex Playwright Trace with session recording](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/traces/browser-trace.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=9fd234a64578006aab3d06fa6af7bf33)

[Real-time Traces](https://docs.lmnr.ai/tracing/realtime) [LangGraph Visualization](https://docs.lmnr.ai/tracing/langgraph-visualization)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Example Playwright Trace with session recording](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/traces/playwright-simple-trace.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=26b22c8b2aed626b6dbbde353a2029e4)

![Example complex Playwright Trace with session recording](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/traces/browser-trace.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=e4bfce017dc4dc132a8cb78cc7964aa2)
