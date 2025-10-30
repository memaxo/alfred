---
title: Using with CopilotKit
url: 
description: Learn how Mastra leverages the CopilotKit's AGUI library and how you can leverage it to build user experiences
language: en
---
[Skip to Content](https://mastra.ai/en/docs/frameworks/agentic-uis/copilotkit#nextra-skip-nav)

Loading...

[Docs](https://mastra.ai/en/docs "Docs") Frameworks [Agentic UIs](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk "Agentic UIs") With CopilotKit

Copy page

# Integrate CopilotKit with Mastra

CopilotKit provides React components to quickly integrate customizable AI copilots into your application. Combined with Mastra, you can build sophisticated AI apps featuring bidirectional state synchronization and interactive UIs.

Visit the [CopilotKit documentation](https://docs.copilotkit.ai/) to learn more about CopilotKit concepts, components, and advanced usage patterns.

This guide shows two distinct integration approaches:

1. Integrate CopilotKit in your Mastra server with a separate React frontend.
2. Integrate CopilotKit in your Next.js app

Mastra ServerNext.js

### Mastra Server

## Install React Dependencies [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/copilotkit\#install-react-dependencies)

In your React frontend, install the required CopilotKit packages:

npmyarnpnpm

### npm

```nextra-code

npm install @copilotkit/react-core @copilotkit/react-ui
```

### yarn

```nextra-code

yarn add @copilotkit/react-core @copilotkit/react-ui
```

### pnpm

```nextra-code

pnpm add @copilotkit/react-core @copilotkit/react-ui
```

## Create CopilotKit Component [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/copilotkit\#create-copilotkit-component)

Create a CopilotKit component in your React frontend:

components/copilotkit-component.tsx

```nextra-code [counter-reset:line]

import { CopilotChat } from "@copilotkit/react-ui";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";

export function CopilotKitComponent({ runtimeUrl }: { runtimeUrl: string}) {
  return (
    <CopilotKit
      runtimeUrl={runtimeUrl}
      agent="weatherAgent"
    >
      <CopilotChat
        labels={{
          title: "Your Assistant",
          initial: "Hi! 👋 How can I assist you today?",
        }}
      />
    </CopilotKit>
  );
}
```

## Install Dependencies [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/copilotkit\#install-dependencies)

If you have not yet set up your Mastra server, follow the [getting started guide](https://mastra.ai/docs/getting-started/installation) to set up a new Mastra project.

In your Mastra server, install additional packages for CopilotKit integration:

npmyarnpnpm

### npm

```nextra-code

npm install @copilotkit/runtime @ag-ui/mastra
```

### yarn

```nextra-code

yarn add @copilotkit/runtime @ag-ui/mastra
```

### pnpm

```nextra-code

pnpm add @copilotkit/runtime @ag-ui/mastra
```

## Configure Mastra Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/copilotkit\#configure-mastra-server)

Configure your Mastra instance to include CopilotKit’s runtime endpoint:

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { registerCopilotKit } from "@ag-ui/mastra";
import { weatherAgent } from "./agents/weather-agent";

type WeatherRuntimeContext = {
  "user-id": string;
  "temperature-scale": "celsius" | "fahrenheit";
};

export const mastra = new Mastra({
  agents: { weatherAgent },
  server: {
    cors: {
      origin: "*",
      allowMethods: ["*"],
      allowHeaders: ["*"]
    },
    apiRoutes: [\
      registerCopilotKit<WeatherRuntimeContext>({\
        path: "/copilotkit",\
        resourceId: "weatherAgent",\
        setContext: (c, runtimeContext) => {\
          runtimeContext.set("user-id", c.req.header("X-User-ID") || "anonymous");\
          runtimeContext.set("temperature-scale", "celsius");\
        }\
      })\
    ]
  }
});
```

## Usage in your React App [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/copilotkit\#usage-in-your-react-app)

Use the component in your React app with your Mastra server URL:

App.tsx

```nextra-code [counter-reset:line]

import { CopilotKitComponent } from "./components/copilotkit-component";

function App() {
  return (
    <CopilotKitComponent runtimeUrl="http://localhost:4111/copilotkit" />
  );
}

export default App;
```

### Next.js

## Install Dependencies [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/copilotkit\#install-dependencies-1)

In your Next.js app, install the required packages:

npmyarnpnpm

### npm

```nextra-code

npm install @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime @ag-ui/mastra
```

### yarn

```nextra-code

yarn add @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime @ag-ui/mastra
```

### pnpm

```nextra-code

pnpm add @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime @ag-ui/mastra
```

## Create CopilotKit Component [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/copilotkit\#full-stack-nextjs-create-copilotkit-component)

Create a CopilotKit component:

components/copilotkit-component.tsx

```nextra-code [counter-reset:line]

'use client';
import { CopilotChat } from "@copilotkit/react-ui";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";

export function CopilotKitComponent({ runtimeUrl }: { runtimeUrl: string}) {
  return (                                                       y
    <CopilotKit
      runtimeUrl={runtimeUrl}
      agent="weatherAgent"
    >
      <CopilotChat
        labels={{
          title: "Your Assistant",
          initial: "Hi! 👋 How can I assist you today?",
        }}
      />
    </CopilotKit>
  );
}
```

## Create API Route [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/copilotkit\#create-api-route)

There are two approaches for the API route determined by how you’re integrating Mastra in your Next.js application.

1. For a full-stack Next.js app with an instance of Mastra integrated into the app.
2. For a Next.js app with a separate Mastra server and the Mastra Client SDK.

With a Mastra instanceWith the Mastra Client SDK

### With a Mastra instance

Create an API route that connects to local Mastra agents.

app/api/copilotkit/route.ts

```nextra-code [counter-reset:line]

import { mastra } from "../../mastra";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra";
import { NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
  const mastraAgents = MastraAgent.getLocalAgents({
    mastra,
    agentId: "weatherAgent",
  });

  const runtime = new CopilotRuntime({
    agents: mastraAgents,
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
```

### With the Mastra Client SDK

## Install the Mastra Client SDK [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/copilotkit\#install-the-mastra-client-sdk)

Install the Mastra Client SDK.

npmyarnpnpm

### npm

```nextra-code

npm install @mastra/client-js
```

### yarn

```nextra-code

yarn add @mastra/client-js
```

### pnpm

```nextra-code

 pnpm add @mastra/client-js
```

Create an API route that connects to remote Mastra agents:

app/api/copilotkit/route.ts

```nextra-code [counter-reset:line]

import { MastraClient } from "@mastra/client-js";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { MastraAgent } from "@ag-ui/mastra";
import { NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
  const baseUrl = process.env.MASTRA_BASE_URL || "http://localhost:4111";
  const mastraClient = new MastraClient({ baseUrl });

  const mastraAgents = await MastraAgent.getRemoteAgents({ mastraClient });

  const runtime = new CopilotRuntime({
    agents: mastraAgents,
  });

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new ExperimentalEmptyAdapter(),
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
```

## Use Component [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/copilotkit\#use-component)

Use the component with the local API endpoint:

App.tsx

```nextra-code [counter-reset:line]

import { CopilotKitComponent } from "./components/copilotkit-component";

function App() {
  return (
    <CopilotKitComponent runtimeUrl="/api/copilotkit" />
  );
}

export default App;
```

Start building the future!

![CopilotKit output](https://mastra.ai/_next/image?url=%2Fimage%2Fcopilotkit%2Fcpkoutput.jpg&w=1920&q=75)

## Next Steps [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/copilotkit\#next-steps)

- [CopilotKit Documentation](https://docs.copilotkit.ai/) \- Complete CopilotKit reference
- [React Hooks with CopilotKit](https://docs.copilotkit.ai/reference/hooks/useCoAgent) \- Advanced React integration patterns
- [Next.js Integration with Mastra](https://mastra.ai/docs/frameworks/web-frameworks/next-js) \- Full-stack Next.js setup guide

[With Vercel AI SDK](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk "With Vercel AI SDK") [With Assistant UI](https://mastra.ai/en/docs/frameworks/agentic-uis/assistant-ui "With Assistant UI")