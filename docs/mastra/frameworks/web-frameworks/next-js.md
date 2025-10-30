---
title: Getting Started with Mastra and Next.js | Mastra Guides
url: 
description: A step-by-step guide to integrating Mastra with Next.js.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Frameworks](https://mastra.ai/en/docs/frameworks/agentic-uis "Frameworks") [Web Frameworks](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react "Web Frameworks") With Next.js

Copy page

# Integrate Mastra in your Next.js project

Mastra integrates with Next.js, making it easy to:

- Build flexible APIs to serve AI-powered features
- Simplify deployment with a unified codebase for frontend and backend
- Take advantage of Next.js’s built-in server actions (App Router) or API Routes (Pages Router) for efficient server-client workflows

Use this guide to scaffold and integrate Mastra with your Next.js project.

App RouterPages Router

### App Router

This guide assumes you’re using the Next.js App Router at the root of your
project, e.g., `app` rather than `src/app`.

## Integrate Mastra [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#integrate-mastra)

To integrate Mastra into your project, you have two options:

### 1\. Use the One-Liner [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#1-use-the-one-liner)

Run the following command to quickly scaffold the default Weather agent with sensible defaults:

```nextra-code

npx mastra@latest init --dir . --components agents,tools --example --llm openai
```

> See [mastra init](https://mastra.ai/reference/cli/init) for more information.

### 2\. Use the Interactive CLI [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#2-use-the-interactive-cli)

If you prefer to customize the setup, run the `init` command and choose from the options when prompted:

```nextra-code

npx mastra@latest init
```

By default, `mastra init` suggests `src` as the install location. If you’re using the App Router at the root of your project (e.g., `app`, not `src/app`), enter `.` when prompted:

## Set Up API Key [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#set-up-api-key)

.env

```nextra-code

OPENAI_API_KEY=<your-api-key>
```

> Each LLM provider uses a different env var. See [Model Capabilities](https://mastra.ai/docs/getting-started/model-capability) for more information.

## Configure Next.js [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#configure-nextjs)

Add to your `next.config.ts`:

next.config.ts

```nextra-code [counter-reset:line]

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@mastra/*"],
};

export default nextConfig;
```

## Start Next.js Dev Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#start-nextjs-dev-server)

You can start your Next.js app in the usual way.

## Create Test Directory [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#create-test-directory)

Create a new directory that will contain a Page, Action, and Form for testing purposes.

```nextra-code

mkdir app/test
```

### Create Test Action [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#create-test-action)

Create a new Action, and add the example code:

```nextra-code

touch app/test/action.ts
```

app/test/action.ts

```nextra-code [counter-reset:line]

"use server";

import { mastra } from "../../mastra";

export async function getWeatherInfo(formData: FormData) {
  const city = formData.get("city")?.toString();
  const agent = mastra.getAgent("weatherAgent");

  const result = await agent.generate(`What's the weather like in ${city}?`);

  return result.text;
}
```

### Create Test Form [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#create-test-form)

Create a new Form component, and add the example code:

```nextra-code

touch app/test/form.tsx
```

app/test/form.tsx

```nextra-code [counter-reset:line]

"use client";

import { useState } from "react";
import { getWeatherInfo } from "./action";

export function Form() {
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const res = await getWeatherInfo(formData);
    setResult(res);
  }

  return (
    <>
      <form action={handleSubmit}>
        <input name="city" placeholder="Enter city" required />
        <button type="submit">Get Weather</button>
      </form>
      {result && <pre>{result}</pre>}
    </>
  );
}
```

### Create Test Page [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#create-test-page)

Create a new Page, and add the example code:

```nextra-code

touch app/test/page.tsx
```

app/test/page.tsx

```nextra-code [counter-reset:line]

import { Form } from "./form";

export default async function Page() {
  return (
    <>
      <h1>Test</h1>
      <Form />
    </>
  );
}
```

> You can now navigate to `/test` in your browser to try it out.

Submitting **London** as the city would return a result similar to:

```nextra-code

Agent response: The current weather in London is as follows:

- **Temperature:** 12.9°C (Feels like 9.7°C)
- **Humidity:** 63%
- **Wind Speed:** 14.7 km/h
- **Wind Gusts:** 32.4 km/h
- **Conditions:** Overcast

Let me know if you need more information!
```

### Pages Router

This guide assumes you’re using the Next.js Pages Router at the root of your
project, e.g., `pages` rather than `src/pages`.

## Integrate Mastra [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#integrate-mastra-1)

To integrate Mastra into your project, you have two options:

### 1\. Use the One-Liner [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#1-use-the-one-liner-1)

Run the following command to quickly scaffold the default Weather agent with sensible defaults:

```nextra-code

npx mastra@latest init --dir . --components agents,tools --example --llm openai
```

> See [mastra init](https://mastra.ai/reference/cli/init) for more information.

### 2\. Use the Interactive CLI [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#2-use-the-interactive-cli-1)

If you prefer to customize the setup, run the `init` command and choose from the options when prompted:

```nextra-code

npx mastra@latest init
```

By default, `mastra init` suggests `src` as the install location. If you’re using the Pages Router at the root of your project (e.g., `pages`, not `src/pages`), enter `.` when prompted:

## Set Up API Key [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#set-up-api-key-1)

.env

```nextra-code

OPENAI_API_KEY=<your-api-key>
```

> Each LLM provider uses a different env var. See [Model Capabilities](https://mastra.ai/docs/getting-started/model-capability) for more information.

## Configure Next.js [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#configure-nextjs-1)

Add to your `next.config.ts`:

next.config.ts

```nextra-code [counter-reset:line]

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@mastra/*"],
};

export default nextConfig;
```

## Start Next.js Dev Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#start-nextjs-dev-server-1)

You can start your Next.js app in the usual way.

## Create Test API Route [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#create-test-api-route)

Create a new API Route, and add the example code:

```nextra-code

touch pages/api/test.ts
```

pages/api/test.ts

```nextra-code [counter-reset:line]

import type { NextApiRequest, NextApiResponse } from "next";

import { mastra } from "../../mastra";

export default async function getWeatherInfo(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const city = req.body.city;
  const agent = mastra.getAgent("weatherAgent");

  const result = await agent.generate(`What's the weather like in ${city}?`);

  return res.status(200).json(result.text);
}
```

## Create Test Page [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#create-test-page-1)

Create a new Page, and add the example code:

```nextra-code

touch pages/test.tsx
```

pages/test.tsx

```nextra-code [counter-reset:line]

import { useState } from "react";

export default function Test() {
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const city = formData.get("city")?.toString();

    const response = await fetch("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city })
    });

    const text = await response.json();
    setResult(text);
  }

  return (
    <>
      <h1>Test</h1>
      <form onSubmit={handleSubmit}>
        <input name="city" placeholder="Enter city" required />
        <button type="submit">Get Weather</button>
      </form>
      {result && <pre>{result}</pre>}
    </>
  );
}
```

> You can now navigate to `/test` in your browser to try it out.

Submitting **London** as the city would return a result similar to:

```nextra-code

Agent response: The current weather in London is as follows:

- **Temperature:** 12.9°C (Feels like 9.7°C)
- **Humidity:** 63%
- **Wind Speed:** 14.7 km/h
- **Wind Gusts:** 32.4 km/h
- **Conditions:** Overcast

Let me know if you need more information!
```

## Next Steps [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js\#next-steps)

- [Deployment \| With Next.js on Vercel](https://mastra.ai/docs/deployment/web-framework#with-nextjs-on-vercel)
- [Monorepo Deployment](https://mastra.ai/en/docs/deployment/monorepo)

[With Vite/React](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react "With Vite/React") [With Astro](https://mastra.ai/en/docs/frameworks/web-frameworks/astro "With Astro")