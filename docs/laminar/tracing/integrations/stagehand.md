---
title: Observability for Stagehand - Laminar documentation
url: 
language: en
---
[Skip to main content](https://docs.lmnr.ai/tracing/integrations/stagehand#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Integrations

Observability for Stagehand

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Overview](https://docs.lmnr.ai/tracing/integrations/stagehand#overview)
- [Quickstart](https://docs.lmnr.ai/tracing/integrations/stagehand#quickstart)
- [Step-by-step guide](https://docs.lmnr.ai/tracing/integrations/stagehand#step-by-step-guide)
- [Example of a Stagehand trace](https://docs.lmnr.ai/tracing/integrations/stagehand#example-of-a-stagehand-trace)

## [​](https://docs.lmnr.ai/tracing/integrations/stagehand\#overview)  Overview

[Stagehand](https://github.com/browserbase/stagehand) is an AI Browser Automation Framework developed by [Browserbase](https://browserbase.com/).Laminar provides native integration with Stagehand, allowing you to trace your Stagehand code with just a few lines of code.Laminar observability captures:

- Full recording of a browser window while the code is running
- Execution steps, such as, `act`, `extract`, `observe` and `agent` calls.
- LLM cost of the execution steps
- Latency of the execution steps and LLM calls

## [​](https://docs.lmnr.ai/tracing/integrations/stagehand\#quickstart)  Quickstart

Below is an example of a simple Stagehand script. Highlighted lines are the ones that are required to trace Stagehand with Laminar.

Copy

```
import { Stagehand } from '@browserbase/stagehand';
import { Laminar } from '@lmnr-ai/lmnr';
import { z } from 'zod';

Laminar.initialize({
  projectApiKey: process.env.LMNR_API_KEY,
  instrumentModules: {
    stagehand: Stagehand,
  },
});

const main = async () => {
  const stagehand = new Stagehand();
  await stagehand.init({
    modelName: 'gpt-4.1-mini',
    modelClientOptions: {
      apiKey: process.env.OPENAI_API_KEY,
    },
  });
  const page = stagehand.page;
  await page.goto('https://www.lmnr.ai');
  await page.act('go to Laminar blogs page');
  const blogPosts = await page.extract({
    instruction: "get the blog posts",
    schema: z.object({
      posts: z.array(z.object({
        title: z.string(),
        date: z.date(),
      }))
    })
  });
  await stagehand.close();
  await Laminar.flush();
  return blogPosts;
};

main().then(console.log).catch(console.error);

```

### [​](https://docs.lmnr.ai/tracing/integrations/stagehand\#step-by-step-guide)  Step-by-step guide

1

Start with Stagehand Browser quickstart

Copy

```
npx create-browser-app@latest

```

Choose “Yes” when prompted to start with a quickstart app and follow other instructions.Finally go to the newly created directory and install dependencies.

Copy

```
cd YOUR_APP_NAME
npm install

```

2

Install Laminar

Copy

```
npm install @lmnr-ai/lmnr

```

3

Initialize Laminar

First, we need to initialize Laminar at the start of your application and pass the Stagehand module to `instrumentModules`.

Copy

```
import { Stagehand } from '@browserbase/stagehand';
import { Laminar } from '@lmnr-ai/lmnr';

Laminar.initialize({
  projectApiKey: process.env.LMNR_API_KEY,
  instrumentModules: {
    stagehand: Stagehand,
  },
});

```

4

Finalizing Stagehand traces

If you run Stagehand in a standalone script, in order to flush queued Stagehand traces, make sure to call `stagehand.close()` and `Laminar.flush()`.

Copy

```
await stagehand.close(); // closes the browser and the parent span
await Laminar.flush(); // sends any remaining spans to Laminar

```

## [​](https://docs.lmnr.ai/tracing/integrations/stagehand\#example-of-a-stagehand-trace)  Example of a Stagehand trace

You can see entire session recording of a browser window while the code was running, along with execution steps, such as `act` and `extract`. You can also see LLM cost of the entire execution and of each execution step. For LLM spans you can see the prompt, the response and the model name.

![Stagehand example](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/stagehand.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=c66063df752e656b39718625468f8897)

An example trace for page.act('go to Laminar blogs page')

[Browser Use](https://docs.lmnr.ai/tracing/integrations/browser-use) [Skyvern](https://docs.lmnr.ai/tracing/integrations/skyvern)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Stagehand example](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/stagehand.png?w=840&fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=788e18e4209741a8692812bbf5a95bdc)