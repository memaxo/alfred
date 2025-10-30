---
title: Custom Scorers
url: 
language: en
---
[Skip to Content](https://mastra.ai/en/docs/scorers/custom-scorers#nextra-skip-nav)

Loading...

[Docs](https://mastra.ai/en/docs "Docs") [Scorersexp.](https://mastra.ai/en/docs/scorers/overview "Scorers") Custom Scorers

Copy page

## Creating scorers [Permalink for this section](https://mastra.ai/en/docs/scorers/custom-scorers\#creating-scorers)

Mastra provides a unified `createScorer` factory that allows you to build custom evaluation logic using either JavaScript functions or LLM-based prompt objects for each step. This flexibility lets you choose the best approach for each part of your evaluation pipeline.

### The Four-Step Pipeline [Permalink for this section](https://mastra.ai/en/docs/scorers/custom-scorers\#the-four-step-pipeline)

All scorers in Mastra follow a consistent four-step evaluation pipeline:

1. **preprocess** (optional): Prepare or transform input/output data
2. **analyze** (optional): Perform evaluation analysis and gather insights
3. **generateScore** (required): Convert analysis into a numerical score
4. **generateReason** (optional): Generate human-readable explanations

Each step can use either **functions** or **prompt objects** (LLM-based evaluation), giving you the flexibility to combine deterministic algorithms with AI judgment as needed.

### Functions vs Prompt Objects [Permalink for this section](https://mastra.ai/en/docs/scorers/custom-scorers\#functions-vs-prompt-objects)

**Functions** use JavaScript for deterministic logic. They’re ideal for:

- Algorithmic evaluations with clear criteria
- Performance-critical scenarios
- Integration with existing libraries
- Consistent, reproducible results

**Prompt Objects** use LLMs as judges for evaluation. They’re perfect for:

- Subjective evaluations requiring human-like judgment
- Complex criteria difficult to code algorithmically
- Natural language understanding tasks
- Nuanced context evaluation

You can mix and match approaches within a single scorer - for example, use a function for preprocessing data and an LLM for analyzing quality.

### Initializing a Scorer [Permalink for this section](https://mastra.ai/en/docs/scorers/custom-scorers\#initializing-a-scorer)

Every scorer starts with the `createScorer` factory function, which requires a name and description, and optionally accepts a type specification and judge configuration.

```nextra-code

import { createScorer } from '@mastra/core/scores';
import { openai } from '@ai-sdk/openai';

const glutenCheckerScorer = createScorer({
  name: 'Gluten Checker',
  description: 'Check if recipes contain gluten ingredients',
  judge: {                    // Optional: for prompt object steps
    model: openai('gpt-4o'),
    instructions: 'You are a Chef that identifies if recipes contain gluten.'
  }
})
// Chain step methods here
.preprocess(...)
.analyze(...)
.generateScore(...)
.generateReason(...)
```

The judge configuration is only needed if you plan to use prompt objects in any step. Individual steps can override this default configuration with their own judge settings.

#### Agent Type for Agent Evaluation [Permalink for this section](https://mastra.ai/en/docs/scorers/custom-scorers\#agent-type-for-agent-evaluation)

For type safety and compatibility with both live agent scoring and trace scoring, use `type: 'agent'` when creating scorers for agent evaluation. This allows you to use the same scorer for an agent and also use it to score traces:

```nextra-code

const myScorer = createScorer({
  // ...
  type: 'agent', // Automatically handles agent input/output types
})
.generateScore(({ run, results }) => {
  // run.output is automatically typed as ScorerRunOutputForAgent
  // run.input is automatically typed as ScorerRunInputForAgent
});
```

### Step-by-Step Breakdown [Permalink for this section](https://mastra.ai/en/docs/scorers/custom-scorers\#step-by-step-breakdown)

#### preprocess Step (Optional) [Permalink for this section](https://mastra.ai/en/docs/scorers/custom-scorers\#preprocess-step-optional)

Prepares input/output data when you need to extract specific elements, filter content, or transform complex data structures.

**Functions:** `({ run, results }) => any`

```nextra-code

const glutenCheckerScorer = createScorer(...)
.preprocess(({ run }) => {
  // Extract and clean recipe text
  const recipeText = run.output.text.toLowerCase();
  const wordCount = recipeText.split(' ').length;

  return {
    recipeText,
    wordCount,
    hasCommonGlutenWords: /flour|wheat|bread|pasta/.test(recipeText)
  };
})
```

**Prompt Objects:** Use `description`, `outputSchema`, and `createPrompt` to structure LLM-based preprocessing.

```nextra-code

const glutenCheckerScorer = createScorer(...)
.preprocess({
  description: 'Extract ingredients from the recipe',
  outputSchema: z.object({
    ingredients: z.array(z.string()),
    cookingMethods: z.array(z.string())
  }),
  createPrompt: ({ run }) => `
    Extract all ingredients and cooking methods from this recipe:
    ${run.output.text}

    Return JSON with ingredients and cookingMethods arrays.
  `
})
```

**Data Flow:** Results are available to subsequent steps as `results.preprocessStepResult`

#### analyze Step (Optional) [Permalink for this section](https://mastra.ai/en/docs/scorers/custom-scorers\#analyze-step-optional)

Performs core evaluation analysis, gathering insights that will inform the scoring decision.

**Functions:** `({ run, results }) => any`

```nextra-code

const glutenCheckerScorer = createScorer({...})
.preprocess(...)
.analyze(({ run, results }) => {
  const { recipeText, hasCommonGlutenWords } = results.preprocessStepResult;

  // Simple gluten detection algorithm
  const glutenKeywords = ['wheat', 'flour', 'barley', 'rye', 'bread'];
  const foundGlutenWords = glutenKeywords.filter(word =>
    recipeText.includes(word)
  );

  return {
    isGlutenFree: foundGlutenWords.length === 0,
    detectedGlutenSources: foundGlutenWords,
    confidence: hasCommonGlutenWords ? 0.9 : 0.7
  };
})
```

**Prompt Objects:** Use `description`, `outputSchema`, and `createPrompt` for LLM-based analysis.

```nextra-code

const glutenCheckerScorer = createScorer({...})
.preprocess(...)
.analyze({
  description: 'Analyze recipe for gluten content',
  outputSchema: z.object({
    isGlutenFree: z.boolean(),
    glutenSources: z.array(z.string()),
    confidence: z.number().min(0).max(1)
  }),
  createPrompt: ({ run, results }) => `
    Analyze this recipe for gluten content:
    "${results.preprocessStepResult.recipeText}"

    Look for wheat, barley, rye, and hidden sources like soy sauce.
    Return JSON with isGlutenFree, glutenSources array, and confidence (0-1).
  `
})
```

**Data Flow:** Results are available to subsequent steps as `results.analyzeStepResult`

#### generateScore Step (Required) [Permalink for this section](https://mastra.ai/en/docs/scorers/custom-scorers\#generatescore-step-required)

Converts analysis results into a numerical score. This is the only required step in the pipeline.

**Functions:** `({ run, results }) => number`

```nextra-code

const glutenCheckerScorer = createScorer({...})
.preprocess(...)
.analyze(...)
.generateScore(({ results }) => {
  const { isGlutenFree, confidence } = results.analyzeStepResult;

  // Return 1 for gluten-free, 0 for contains gluten
  // Weight by confidence level
  return isGlutenFree ? confidence : 0;
})
```

**Prompt Objects:** See the [`createScorer`](https://mastra.ai/reference/scorers/create-scorer) API reference for details on using prompt objects with generateScore, including required `calculateScore` function.

**Data Flow:** The score is available to generateReason as the `score` parameter

#### generateReason Step (Optional) [Permalink for this section](https://mastra.ai/en/docs/scorers/custom-scorers\#generatereason-step-optional)

Generates human-readable explanations for the score, useful for debugging, transparency, or user feedback.

**Functions:** `({ run, results, score }) => string`

```nextra-code

const glutenCheckerScorer = createScorer({...})
.preprocess(...)
.analyze(...)
.generateScore(...)
.generateReason(({ results, score }) => {
  const { isGlutenFree, glutenSources } = results.analyzeStepResult;

  if (isGlutenFree) {
    return `Score: ${score}. This recipe is gluten-free with no harmful ingredients detected.`;
  } else {
    return `Score: ${score}. Contains gluten from: ${glutenSources.join(', ')}`;
  }
})
```

**Prompt Objects:** Use `description` and `createPrompt` for LLM-generated explanations.

```nextra-code

const glutenCheckerScorer = createScorer({...})
.preprocess(...)
.analyze(...)
.generateScore(...)
.generateReason({
  description: 'Explain the gluten assessment',
  createPrompt: ({ results, score }) => `
    Explain why this recipe received a score of ${score}.
    Analysis: ${JSON.stringify(results.analyzeStepResult)}

    Provide a clear explanation for someone with dietary restrictions.
  `
})
```

**Examples and Resources:**

- [Custom Scorer Example](https://mastra.ai/examples/scorers/custom-scorer) \- Complete walkthrough
- [createScorer API Reference](https://mastra.ai/reference/scorers/create-scorer) \- Complete technical documentation
- [Built-in Scorers Source Code](https://github.com/mastra-ai/mastra/tree/main/packages/evals/src/scorers) \- Real implementations for reference

[Off the Shelf Scorers](https://mastra.ai/en/docs/scorers/off-the-shelf-scorers "Off the Shelf Scorers") [Overview](https://mastra.ai/en/docs/auth "Overview")