---
title: Introduction to Online Evaluators - Laminar documentation
url: 
description: Learn how to automatically evaluate your LLM calls using custom evaluators
language: en
---
[Skip to main content](https://docs.lmnr.ai/evaluations/online-evaluators/introduction#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Online Evaluators

Introduction to Online Evaluators

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [How Online Evaluators Work](https://docs.lmnr.ai/evaluations/online-evaluators/introduction#how-online-evaluators-work)
- [Two Ways to Produce Evaluator Scores](https://docs.lmnr.ai/evaluations/online-evaluators/introduction#two-ways-to-produce-evaluator-scores)
- [1\. Hosted Evaluators (Automated)](https://docs.lmnr.ai/evaluations/online-evaluators/introduction#1-hosted-evaluators-automated)
- [2\. SDK Scoring (Programmatic)](https://docs.lmnr.ai/evaluations/online-evaluators/introduction#2-sdk-scoring-programmatic)
- [Getting Started](https://docs.lmnr.ai/evaluations/online-evaluators/introduction#getting-started)

Online evaluators provide a powerful way to automatically assess and score your LLM calls as they come.
Once registered, evaluators run automatically whenever a span matches their registered path, immediately attaching evaluation scores based on how you define to score them.

## [​](https://docs.lmnr.ai/evaluations/online-evaluators/introduction\#how-online-evaluators-work)  How Online Evaluators Work

The core concept:

1. **Custom Evaluators**: You define your own evaluator logic by writing Python functions that analyze the outputs of your LLM calls. These can range from simple checks to sophisticated analysis. It should always return **number**.
2. **Span Path Registration**: Each evaluator is registered to a specific **span path** \- a unique identifier that corresponds to a particular LLM function or call location in your code.
3. **Automatic Execution**: Once registered, evaluators run automatically whenever a span matches their registered path. The evaluator score is immediately attached to the span.

## [​](https://docs.lmnr.ai/evaluations/online-evaluators/introduction\#two-ways-to-produce-evaluator-scores)  Two Ways to Produce Evaluator Scores

There are two main approaches to generating evaluator scores in Laminar:

### [​](https://docs.lmnr.ai/evaluations/online-evaluators/introduction\#1-hosted-evaluators-automated)  1\. Hosted Evaluators (Automated)

Create custom Python functions that run automatically on our platform. These evaluators:

- Execute automatically when spans match their registered path
- Require no additional code in your application
- Are managed and hosted by Laminar

### [​](https://docs.lmnr.ai/evaluations/online-evaluators/introduction\#2-sdk-scoring-programmatic)  2\. SDK Scoring (Programmatic)

Create scores programmatically using our SDK or REST API. This approach:

- Gives you full control over when and how scores are created
- Allows integration with your existing evaluation pipeline
- Supports custom scoring logic that runs in your environment

Both approaches result in the same evaluator scores being attached to your spans, visible in the Laminar dashboard for analysis and monitoring.

## [​](https://docs.lmnr.ai/evaluations/online-evaluators/introduction\#getting-started)  Getting Started

1. **Go to the Evaluators page** in your Laminar dashboard
2. **Click “New Evaluator”** to start creating your custom evaluator
3. **Create your evaluator** by writing the Python function that will assess your LLM outputs
4. **Go to a span** in your traces and register the evaluator to that specific span path

[Cookbook](https://docs.lmnr.ai/evaluations/cookbook) [Scoring with Hosted Evaluators](https://docs.lmnr.ai/evaluations/online-evaluators/scoring-with-hosted-evaluators)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.