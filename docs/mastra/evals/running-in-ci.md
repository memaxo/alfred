---
title: Running in CI
url: 
description: Learn how to run Mastra evals in your CI/CD pipeline to monitor agent quality over time.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/evals/running-in-ci#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Evals](https://mastra.ai/en/docs/evals/overview "Evals") Running in CI

Copy page

# Running Evals in CI

**New Scorer API**

We just released a new evals API called Scorers, with a more ergonomic API and more metadata stored for error analysis, and more flexibility to evaluate data structures. It’s fairly simple to migrate, but we will continue to support the existing Evals API.

Running evals in your CI pipeline helps bridge this gap by providing quantifiable metrics for measuring agent quality over time.

## Setting Up CI Integration [Permalink for this section](https://mastra.ai/en/docs/evals/running-in-ci\#setting-up-ci-integration)

We support any testing framework that supports ESM modules. For example, you can use [Vitest](https://vitest.dev/), [Jest](https://jestjs.io/) or [Mocha](https://mochajs.org/) to run evals in your CI/CD pipeline.

src/mastra/agents/index.test.ts

```nextra-code [counter-reset:line]

import { describe, it, expect } from "vitest";
import { evaluate } from "@mastra/evals";
import { ToneConsistencyMetric } from "@mastra/evals/nlp";
import { myAgent } from "./index";

describe("My Agent", () => {
  it("should validate tone consistency", async () => {
    const metric = new ToneConsistencyMetric();
    const result = await evaluate(myAgent, "Hello, world!", metric);

    expect(result.score).toBe(1);
  });
});
```

You will need to configure a testSetup and globalSetup script for your testing framework to capture the eval results. It allows us to show these results in your mastra dashboard.

## Framework Configuration [Permalink for this section](https://mastra.ai/en/docs/evals/running-in-ci\#framework-configuration)

### Vitest Setup [Permalink for this section](https://mastra.ai/en/docs/evals/running-in-ci\#vitest-setup)

Add these files to your project to run evals in your CI/CD pipeline:

globalSetup.ts

```nextra-code [counter-reset:line]

import { globalSetup } from "@mastra/evals";

export default function setup() {
  globalSetup();
}
```

testSetup.ts

```nextra-code [counter-reset:line]

import { beforeAll } from "vitest";
import { attachListeners } from "@mastra/evals";

beforeAll(async () => {
  await attachListeners();
});
```

vitest.config.ts

```nextra-code [counter-reset:line]

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./globalSetup.ts",
    setupFiles: ["./testSetup.ts"],
  },
});
```

## Storage Configuration [Permalink for this section](https://mastra.ai/en/docs/evals/running-in-ci\#storage-configuration)

To store eval results in Mastra Storage and capture results in the Mastra dashboard:

testSetup.ts

```nextra-code [counter-reset:line]

import { beforeAll } from "vitest";
import { attachListeners } from "@mastra/evals";
import { mastra } from "./your-mastra-setup";

beforeAll(async () => {
  // Store evals in Mastra Storage (requires storage to be enabled)
  await attachListeners(mastra);
});
```

With file storage, evals persist and can be queried later. With memory storage, evals are isolated to the test process.

[Custom Evals](https://mastra.ai/en/docs/evals/custom-eval "Custom Evals") [Overview](https://mastra.ai/en/docs/scorers/overview "Overview")