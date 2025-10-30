---
title: Overview
url: 
description: Overview of scorers in Mastra, detailing their capabilities for evaluating AI outputs and measuring performance.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/scorers/overview#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") Scorersexp.Overview

Copy page

# Scorers overview

**Scorers** are evaluation tools that measure the quality, accuracy, or performance of AI-generated outputs. Scorers provide an automated way to assess whether your agents, workflows, or language models are producing the desired results by analyzing their responses against specific criteria.

**Scores** are numerical values (typically between 0 and 1) that quantify how well an output meets your evaluation criteria. These scores enable you to objectively track performance, compare different approaches, and identify areas for improvement in your AI systems.

## Evaluation pipeline [Permalink for this section](https://mastra.ai/en/docs/scorers/overview\#evaluation-pipeline)

Mastra scorers follow a flexible four-step pipeline that allows for simple to complex evaluation workflows:

1. **preprocess** (Optional): Prepare or transform input/output data for evaluation
2. **analyze** (Optional): Perform evaluation analysis and gather insights
3. **generateScore** (Required): Convert analysis into a numerical score
4. **generateReason** (Optional): Generate explanations or justifications for the score

This modular structure enables both simple single-step evaluations and complex multi-stage analysis workflows, allowing you to build evaluations that match your specific needs.

### When to use each step [Permalink for this section](https://mastra.ai/en/docs/scorers/overview\#when-to-use-each-step)

**preprocess step** \- Use when your content is complex or needs preprocessing:

- Extracting specific elements from complex data structures
- Cleaning or normalizing text before analysis
- Parsing multiple claims that need individual evaluation
- Filtering content to focus evaluation on relevant sections

**analyze step** \- Use when you need structured evaluation analysis:

- Gathering insights that inform the scoring decision
- Breaking down complex evaluation criteria into components
- Performing detailed analysis that generateScore will use
- Collecting evidence or reasoning data for transparency

**generateScore step** \- Always required for converting analysis to scores:

- Simple scenarios: Direct scoring of input/output pairs
- Complex scenarios: Converting detailed analysis results into numerical scores
- Applying business logic and weighting to analysis results
- The only step that produces the final numerical score

**generateReason step** \- Use when explanations are important:

- Users need to understand why a score was assigned
- Debugging and transparency are critical
- Compliance or auditing requires explanations
- Providing actionable feedback for improvement

To learn how to create your own Scorers, see [Creating Custom Scorers](https://mastra.ai/docs/scorers/custom-scorers).

## Installation [Permalink for this section](https://mastra.ai/en/docs/scorers/overview\#installation)

To access Mastra’s scorers feature install the `@mastra/evals` package.

```nextra-code

npm install @mastra/evals@latest
```

## Live evaluations [Permalink for this section](https://mastra.ai/en/docs/scorers/overview\#live-evaluations)

**Live evaluations** allow you to automatically score AI outputs in real-time as your agents and workflows operate. Instead of running evaluations manually or in batches, scorers run asynchronously alongside your AI systems, providing continuous quality monitoring.

### Adding scorers to agents [Permalink for this section](https://mastra.ai/en/docs/scorers/overview\#adding-scorers-to-agents)

You can add built-in scorers to your agents to automatically evaluate their outputs. See the [full list of built-in scorers](https://mastra.ai/docs/scorers/off-the-shelf-scorers) for all available options.

src/mastra/agents/evaluated-agent.ts

```nextra-code [counter-reset:line]

import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import {
  createAnswerRelevancyScorer,
  createToxicityScorer
} from "@mastra/evals/scorers/llm";

export const evaluatedAgent = new Agent({
  // ...
  scorers: {
    relevancy: {
      scorer: createAnswerRelevancyScorer({ model: openai("gpt-4o-mini") }),
      sampling: { type: "ratio", rate: 0.5 }
    },
    safety: {
      scorer: createToxicityScorer({ model: openai("gpt-4o-mini") }),
      sampling: { type: "ratio", rate: 1 }
    }
  }
});
```

### Adding scorers to workflow steps [Permalink for this section](https://mastra.ai/en/docs/scorers/overview\#adding-scorers-to-workflow-steps)

You can also add scorers to individual workflow steps to evaluate outputs at specific points in your process:

src/mastra/workflows/content-generation.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { customStepScorer } from "../scorers/custom-step-scorer";

const contentStep = createStep({
  // ...
  scorers: {
    customStepScorer: {
      scorer: customStepScorer(),
      sampling: {
        type: "ratio",
        rate: 1, // Score every step execution
      }
    }
  },
});

export const contentWorkflow = createWorkflow({ ... })
  .then(contentStep)
  .commit();
```

### How live evaluations work [Permalink for this section](https://mastra.ai/en/docs/scorers/overview\#how-live-evaluations-work)

**Asynchronous execution**: Live evaluations run in the background without blocking your agent responses or workflow execution. This ensures your AI systems maintain their performance while still being monitored.

**Sampling control**: The `sampling.rate` parameter (0-1) controls what percentage of outputs get scored:

- `1.0`: Score every single response (100%)
- `0.5`: Score half of all responses (50%)
- `0.1`: Score 10% of responses
- `0.0`: Disable scoring

**Automatic storage**: All scoring results are automatically stored in the `mastra_scorers` table in your configured database, allowing you to analyze performance trends over time.

## Trace evaluations [Permalink for this section](https://mastra.ai/en/docs/scorers/overview\#trace-evaluations)

In addition to live evaluations, you can use scorers to evaluate historical traces from your agent interactions and workflows. This is particularly useful for analyzing past performance, debugging issues, or running batch evaluations.

**Observability Required**

To score traces, you must first configure observability in your Mastra instance to collect trace data. See [AI Tracing documentation](https://mastra.ai/en/docs/observability/ai-tracing) for setup instructions.

### Scoring traces with the playground [Permalink for this section](https://mastra.ai/en/docs/scorers/overview\#scoring-traces-with-the-playground)

To score traces, you first need to register your scorers with your Mastra instance:

```nextra-code

const mastra = new Mastra({
  // ...
  scorers: {
    answerRelevancy: myAnswerRelevancyScorer,
    responseQuality: myResponseQualityScorer
  }
});
```

Once registered, you can score traces interactively within the Mastra playground under the Observability section. This provides a user-friendly interface for running scorers against historical traces.

## Testing scorers locally [Permalink for this section](https://mastra.ai/en/docs/scorers/overview\#testing-scorers-locally)

Mastra provides a CLI command `mastra dev` to test your scorers. The playground includes a scorers section where you can run individual scorers against test inputs and view detailed results.

For more details, see the [Local Dev Playground](https://mastra.ai/docs/server-db/local-dev-playground) docs.

## Next steps [Permalink for this section](https://mastra.ai/en/docs/scorers/overview\#next-steps)

- Learn how to create your own scorers in the [Creating Custom Scorers](https://mastra.ai/docs/scorers/custom-scorers) guide
- Explore built-in scorers in the [Off-the-shelf Scorers](https://mastra.ai/docs/scorers/off-the-shelf-scorers) section
- Test scorers with the [Local Dev Playground](https://mastra.ai/docs/server-db/local-dev-playground)
- See example scorers in the [Examples Overview](https://mastra.ai/examples) section

[Running in CI](https://mastra.ai/en/docs/evals/running-in-ci "Running in CI") [Off the Shelf Scorers](https://mastra.ai/en/docs/scorers/off-the-shelf-scorers "Off the Shelf Scorers")