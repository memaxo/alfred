---
title: Textual Evals
url: 
description: Understand how Mastra uses LLM-as-judge methodology to evaluate text quality.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/evals/textual-evals#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Evals](https://mastra.ai/en/docs/evals/overview "Evals") Textual Evals

Copy page

# Textual Evals

**New Scorer API**

We just released a new evals API called Scorers, with a more ergonomic API and more metadata stored for error analysis, and more flexibility to evaluate data structures. It’s fairly simple to migrate, but we will continue to support the existing Evals API.

Textual evals use an LLM-as-judge methodology to evaluate agent outputs. This approach leverages language models to assess various aspects of text quality, similar to how a teaching assistant might grade assignments using a rubric.

Each eval focuses on specific quality aspects and returns a score between 0 and 1, providing quantifiable metrics for non-deterministic AI outputs.

Mastra provides several eval metrics for assessing Agent outputs. Mastra is not limited to these metrics, and you can also [define your own evals](https://mastra.ai/docs/evals/custom-eval).

## Why Use Textual Evals? [Permalink for this section](https://mastra.ai/en/docs/evals/textual-evals\#why-use-textual-evals)

Textual evals help ensure your agent:

- Produces accurate and reliable responses
- Uses context effectively
- Follows output requirements
- Maintains consistent quality over time

## Available Metrics [Permalink for this section](https://mastra.ai/en/docs/evals/textual-evals\#available-metrics)

### Accuracy and Reliability [Permalink for this section](https://mastra.ai/en/docs/evals/textual-evals\#accuracy-and-reliability)

These metrics evaluate how correct, truthful, and complete your agent’s answers are:

- [`hallucination`](https://mastra.ai/reference/evals/hallucination): Detects facts or claims not present in provided context
- [`faithfulness`](https://mastra.ai/reference/evals/faithfulness): Measures how accurately responses represent provided context
- [`content-similarity`](https://mastra.ai/reference/evals/content-similarity): Evaluates consistency of information across different phrasings
- [`completeness`](https://mastra.ai/reference/evals/completeness): Checks if responses include all necessary information
- [`answer-relevancy`](https://mastra.ai/reference/evals/answer-relevancy): Assesses how well responses address the original query
- [`textual-difference`](https://mastra.ai/reference/evals/textual-difference): Measures textual differences between strings

### Understanding Context [Permalink for this section](https://mastra.ai/en/docs/evals/textual-evals\#understanding-context)

These metrics evaluate how well your agent uses provided context:

- [`context-position`](https://mastra.ai/reference/evals/context-position): Analyzes where context appears in responses
- [`context-precision`](https://mastra.ai/reference/evals/context-precision): Evaluates whether context chunks are grouped logically
- [`context-relevancy`](https://mastra.ai/reference/evals/context-relevancy): Measures use of appropriate context pieces
- [`contextual-recall`](https://mastra.ai/reference/evals/contextual-recall): Assesses completeness of context usage

### Output Quality [Permalink for this section](https://mastra.ai/en/docs/evals/textual-evals\#output-quality)

These metrics evaluate adherence to format and style requirements:

- [`tone`](https://mastra.ai/reference/evals/tone-consistency): Measures consistency in formality, complexity, and style
- [`toxicity`](https://mastra.ai/reference/evals/toxicity): Detects harmful or inappropriate content
- [`bias`](https://mastra.ai/reference/evals/bias): Detects potential biases in the output
- [`prompt-alignment`](https://mastra.ai/reference/evals/prompt-alignment): Checks adherence to explicit instructions like length restrictions, formatting requirements, or other constraints
- [`summarization`](https://mastra.ai/reference/evals/summarization): Evaluates information retention and conciseness
- [`keyword-coverage`](https://mastra.ai/reference/evals/keyword-coverage): Assesses technical terminology usage

[Overview](https://mastra.ai/en/docs/evals/overview "Overview") [Custom Evals](https://mastra.ai/en/docs/evals/custom-eval "Custom Evals")