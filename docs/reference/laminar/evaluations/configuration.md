---
title: Configuring Laminar evaluations - Laminar documentation
url: 
description: This page describes how to configure evaluations in Laminar and showcases some common use cases.
language: en
---
[Skip to main content](https://docs.lmnr.ai/evaluations/configuration#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Evaluations

Configuring Laminar evaluations

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Configuring evaluations to report results to locally self-hosted Laminar](https://docs.lmnr.ai/evaluations/configuration#configuring-evaluations-to-report-results-to-locally-self-hosted-laminar)
- [Configuring evaluations](https://docs.lmnr.ai/evaluations/configuration#configuring-evaluations)
- [evaluate reference](https://docs.lmnr.ai/evaluations/configuration#evaluate-reference)
- [eval CLI reference](https://docs.lmnr.ai/evaluations/configuration#eval-cli-reference)
- [Formatting evaluation files](https://docs.lmnr.ai/evaluations/configuration#formatting-evaluation-files)
- [Options](https://docs.lmnr.ai/evaluations/configuration#options)
- [Params](https://docs.lmnr.ai/evaluations/configuration#params)

## [​](https://docs.lmnr.ai/evaluations/configuration\#configuring-evaluations-to-report-results-to-locally-self-hosted-laminar)  Configuring evaluations to report results to locally self-hosted Laminar

In this example, we configure the evaluation to report results to a locally self-hosted Laminar instance.Evaluations send data to Laminar over both HTTP and gRPC. HTTP is used to create an evaluation and report
the datapoints, stats, and trace ids. OpenTelemetry traces themselves are sent over gRPC.Assuming you have configured Laminar to run on ports 8000 and 8001 on your `localhost`, you will need to
pass these values to the `evaluate` function.

- JavaScript/TypeScript

- Python


Copy

```
import { evaluate } from '@lmnr-ai/lmnr';
evaluate({
    data: evaluationData,
    executor: async (data) => await getCapital(data),
    evaluators: [evaluator],
    config: {
        projectApiKey: process.env.LMNR_PROJECT_API_KEY,
        baseUrl: 'http://localhost',
        httpPort: 8000,
        grpcPort: 8001,
    }
})

```

Run this file either by executing it, or by running it with `npx lmnr eval` CLI.

## [​](https://docs.lmnr.ai/evaluations/configuration\#configuring-evaluations)  Configuring evaluations

### [​](https://docs.lmnr.ai/evaluations/configuration\#evaluate-reference)  `evaluate` reference

Evaluations in Laminar are configured using the `evaluate` function. The function takes the following arguments:

- `data`: Either (1) A list of dictionaries, where each dictionary contains the data, target, and metadata for a single evaluation; or
(2) An instance of `LaminarDataset` – read more in [the dedicated page](https://docs.lmnr.ai/evaluations/using-dataset).
- `executor`: An optionally async function that takes a single argument, the evaluation data, and returns the output.
- `evaluators`: A dictionary of async functions that take the output and target as arguments and return a score.
- `name` (optional): Evaluation name, so it is easier to identify the evaluation in the UI. If not provided, a random name is assigned in the backend.
- `groupName`/ `group_name` (optional): An optional string that groups evaluations together. Only evaluations with the same group name can be visually compared.

Additional optional configuration parameters are passed as a `config` object in JavaScript/TypeScript and directly to `evaluate` in Python.

- JavaScript/TypeScript

- Python


- `projectApiKey`: The API key of the project where the evaluation results will be stored.
Required, unless you set the `LMNR_PROJECT_API_KEY` environment variable.
- `concurrencyLimit`: The number of evaluations to run in parallel. Default is `5`.
- `baseUrl`: The base URL of the Laminar instance. Do NOT include port here. Default is `https://api.lmnr.ai`.
- `httpPort`: The port of the Laminar instance for HTTP. Used to send evaluation results and metadata.
Default is 443. For local self-hosted Laminar, use 8000.
- `grpcPort`: The port of the Laminar instance for gRPC. Used to send traces via OTel gRPC exporter.
Default is 8443. For local self-hosted Laminar, use 8001.
- `instrumentModules`: An object with modules to instrument.
Read more in the [instrumentation guide](https://docs.lmnr.ai/tracing/automatic-instrumentation#instrument-specific-modules-only).

### [​](https://docs.lmnr.ai/evaluations/configuration\#eval-cli-reference)  eval CLI reference

`lmnr eval` subcommand is used to run evaluations.

Copy

```
lmnr eval [options]
# or in most Node settings
npx lmnr eval [options]

```

#### [​](https://docs.lmnr.ai/evaluations/configuration\#formatting-evaluation-files)  Formatting evaluation files

When you run an evaluation file from the CLI, the evaluate functions must be called
at the top level of the file. You can have one or more `evaluate` calls in the file.

In Python, you can not `await` the calls to `evaluate` when running an evaluation file from the CLI.

#### [​](https://docs.lmnr.ai/evaluations/configuration\#options)  Options

First positional argument is the path to the evaluation file. E.g.

Copy

```
lmnr eval ./evals/my_evaluation.eval.ts

```

If file is not provided, `lmnr eval` will run all files in the `evals` directory that match the naming pattern.
For TypeScript/JavaScript, the pattern is `*.eval.{ts,js}`. For Python, the pattern is `eval_*.py` or `*_eval.py`.

#### [​](https://docs.lmnr.ai/evaluations/configuration\#params)  Params

`--fail-on-error` – if set, the CLI will fail on non-critical errors, for example, if `evaluate` is not called in the file. Default is `false`.

[Human Evaluators](https://docs.lmnr.ai/evaluations/human-evaluators) [SDK and CLI reference](https://docs.lmnr.ai/evaluations/reference)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.