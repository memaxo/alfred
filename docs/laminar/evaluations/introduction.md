---
title: Introduction to Laminar evaluations - Laminar documentation
url: 
language: en
---
[Skip to main content](https://docs.lmnr.ai/evaluations/introduction#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Evaluations

Introduction to Laminar evaluations

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Why do we need evals?](https://docs.lmnr.ai/evaluations/introduction#why-do-we-need-evals%3F)
- [Types of evals](https://docs.lmnr.ai/evaluations/introduction#types-of-evals)
- [How evals differ from traditional unit tests](https://docs.lmnr.ai/evaluations/introduction#how-evals-differ-from-traditional-unit-tests)

Evaluation is the process of validating and testing the outputs that your AI applications are producing. Having strong evaluations (“evals”) means a more stable, reliable application that is resilient to code and model changes. An eval is a task used to measure the quality of the output of an LLM or LLM system.

![Screenshot of a trace visualization](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/evals.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=0648a6cc3ff6e6c6ff31650fd2c03458)

### [​](https://docs.lmnr.ai/evaluations/introduction\#why-do-we-need-evals%3F)  Why do we need evals?

In short, evaluations bring rigor to AI development process.When you are building with foundation models, creating high-quality evals is one of the most impactful things you can do. Developing AI solutions involves an iterative design process. Without evals, it can be difficult and time-intensive to understand how different model versions and prompts affect your use case.With continuous model upgrades from providers, evals allow you to efficiently test model performance for your specific uses in a standardized way. Developing a suite of evals customized to your objectives will help you quickly understand how new models perform for your applications. You can also make evals part of your CI/CD pipeline to ensure desired accuracy before deployment.

### [​](https://docs.lmnr.ai/evaluations/introduction\#types-of-evals)  Types of evals

There are two main approaches to evaluating outputs:**1\. Logic-based evaluation**: The simplest and most common type uses code to check outputs against expected answers. For example:

- String matching to check if the completion includes an expected phrase
- Parsing to validate proper JSON output
- Custom logic to verify domain-specific requirements

**2\. Model-based evaluation**: A two-stage process where:

- First, the model generates a response to the input
- Then, another model (ideally more powerful) evaluates the quality of that response

Model-based evaluation works best with powerful models when the desired output has significant variation, such as open-ended questions or creative tasks.

## [​](https://docs.lmnr.ai/evaluations/introduction\#how-evals-differ-from-traditional-unit-tests)  How evals differ from traditional unit tests

Unlike traditional unit tests that focus on binary pass/fail outcomes, evaluations for AI systems require continuous tracking and visualization of performance metrics over time. As models evolve and prompts are refined, being able to compare performance across different versions becomes critical.What makes evals unique is their ability to:

- Track nuanced quality metrics beyond simple correctness
- Visualize performance trends across model versions and prompt iterations
- Compare multiple implementations side-by-side
- Detect subtle regressions that might not be obvious in isolated tests

Laminar provides the best developer experience and visualization capabilities for AI evaluations, making it easy to understand how your models are performing and where improvements can be made. With comprehensive dashboards and detailed tracing, you can get deep insights into every aspect of your AI system’s behavior.Check out our [Quickstart Guide](https://docs.lmnr.ai/evaluations/quickstart) to run your first evaluation.

[Troubleshooting non-Laminar SDKs](https://docs.lmnr.ai/tracing/troubleshooting-opentelemetry) [Quickstart](https://docs.lmnr.ai/evaluations/quickstart)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Screenshot of a trace visualization](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/evaluations/evals.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=90767b312568b62c1f9a821722b7c64e)