---
title: Error Handling in Workflows (Legacy) | Mastra Docs
url: 
description: Learn how to handle errors in Mastra legacy workflows using step retries, conditional branching, and monitoring.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/workflows-legacy/error-handling#nextra-skip-nav)

Docs

Copy page

# Error Handling in Workflows (Legacy)

Robust error handling is essential for production workflows. Mastra provides several mechanisms to handle errors gracefully, allowing your workflows to recover from failures or gracefully degrade when necessary.

## Overview [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/error-handling\#overview)

Error handling in Mastra workflows can be implemented using:

1. **Step Retries** \- Automatically retry failed steps
2. **Conditional Branching** \- Create alternative paths based on step success or failure
3. **Error Monitoring** \- Watch workflows for errors and handle them programmatically
4. **Result Status Checks** \- Check the status of previous steps in subsequent steps

## Step Retries [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/error-handling\#step-retries)

Mastra provides a built-in retry mechanism for steps that fail due to transient errors. This is particularly useful for steps that interact with external services or resources that might experience temporary unavailability.

### Basic Retry Configuration [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/error-handling\#basic-retry-configuration)

You can configure retries at the workflow level or for individual steps:

```nextra-code

import { LegacyStep, LegacyWorkflow } from "@mastra/core/workflows/legacy";

// Workflow-level retry configuration
const workflow = new LegacyWorkflow({
  name: "my-workflow",
  retryConfig: {
    attempts: 3, // Number of retry attempts
    delay: 1000, // Delay between retries in milliseconds
  },
});

// Step-level retry configuration (overrides workflow-level)
const apiStep = new LegacyStep({
  id: "callApi",
  execute: async () => {
    // API call that might fail
  },
  retryConfig: {
    attempts: 5, // This step will retry up to 5 times
    delay: 2000, // With a 2-second delay between retries
  },
});
```

For more details about step retries, see the [Step Retries](https://mastra.ai/en/reference/legacyWorkflows/step-retries) reference.

## Conditional Branching [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/error-handling\#conditional-branching)

You can create alternative workflow paths based on the success or failure of previous steps using conditional logic:

```nextra-code

// Create a workflow with conditional branching
const workflow = new LegacyWorkflow({
  name: "error-handling-workflow",
});

workflow
  .step(fetchDataStep)
  .then(processDataStep, {
    // Only execute processDataStep if fetchDataStep was successful
    when: ({ context }) => {
      return context.steps.fetchDataStep?.status === "success";
    },
  })
  .then(fallbackStep, {
    // Execute fallbackStep if fetchDataStep failed
    when: ({ context }) => {
      return context.steps.fetchDataStep?.status === "failed";
    },
  })
  .commit();
```

## Error Monitoring [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/error-handling\#error-monitoring)

You can monitor workflows for errors using the `watch` method:

```nextra-code

const { start, watch } = workflow.createRun();

watch(async ({ results }) => {
  // Check for any failed steps
  const failedSteps = Object.entries(results)
    .filter(([_, step]) => step.status === "failed")
    .map(([stepId]) => stepId);

  if (failedSteps.length > 0) {
    console.error(`Workflow has failed steps: ${failedSteps.join(", ")}`);
    // Take remedial action, such as alerting or logging
  }
});

await start();
```

## Handling Errors in Steps [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/error-handling\#handling-errors-in-steps)

Within a step’s execution function, you can handle errors programmatically:

```nextra-code

const robustStep = new LegacyStep({
  id: "robustStep",
  execute: async ({ context }) => {
    try {
      // Attempt the primary operation
      const result = await someRiskyOperation();
      return { success: true, data: result };
    } catch (error) {
      // Log the error
      console.error("Operation failed:", error);

      // Return a graceful fallback result instead of throwing
      return {
        success: false,
        error: error.message,
        fallbackData: "Default value",
      };
    }
  },
});
```

## Checking Previous Step Results [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/error-handling\#checking-previous-step-results)

You can make decisions based on the results of previous steps:

```nextra-code

const finalStep = new LegacyStep({
  id: "finalStep",
  execute: async ({ context }) => {
    // Check results of previous steps
    const step1Success = context.steps.step1?.status === "success";
    const step2Success = context.steps.step2?.status === "success";

    if (step1Success && step2Success) {
      // All steps succeeded
      return { status: "complete", result: "All operations succeeded" };
    } else if (step1Success) {
      // Only step1 succeeded
      return { status: "partial", result: "Partial completion" };
    } else {
      // Critical failure
      return { status: "failed", result: "Critical steps failed" };
    }
  },
});
```

## Best Practices for Error Handling [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/error-handling\#best-practices-for-error-handling)

1. **Use retries for transient failures**: Configure retry policies for steps that might experience temporary issues.

2. **Provide fallback paths**: Design workflows with alternative paths for when critical steps fail.

3. **Be specific about error scenarios**: Use different handling strategies for different types of errors.

4. **Log errors comprehensively**: Include context information when logging errors to aid in debugging.

5. **Return meaningful data on failure**: When a step fails, return structured data about the failure to help downstream steps make decisions.

6. **Consider idempotency**: Ensure steps can be safely retried without causing duplicate side effects.

7. **Monitor workflow execution**: Use the `watch` method to actively monitor workflow execution and detect errors early.


## Advanced Error Handling [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/error-handling\#advanced-error-handling)

For more complex error handling scenarios, consider:

- **Implementing circuit breakers**: If a step fails repeatedly, stop retrying and use a fallback strategy
- **Adding timeout handling**: Set time limits for steps to prevent workflows from hanging indefinitely
- **Creating dedicated error recovery workflows**: For critical workflows, create separate recovery workflows that can be triggered when the main workflow fails

## Related [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/error-handling\#related)

- [Step Retries Reference](https://mastra.ai/en/reference/legacyWorkflows/step-retries)
- [Watch Method Reference](https://mastra.ai/en/reference/legacyWorkflows/watch)
- [Step Conditions](https://mastra.ai/en/reference/legacyWorkflows/step-condition)
- [Control Flow](https://mastra.ai/en/docs/workflows-legacy/control-flow)

[Installation](https://mastra.ai/en/docs/getting-started/installation "Installation")