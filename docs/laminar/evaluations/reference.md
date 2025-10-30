---
title: Laminar evaluations SDK and CLI reference - Laminar documentation
url: 
description: Reference documentation for evaluations in Laminar, including the evaluate function and CLI options.
language: en
---
[Skip to main content](https://docs.lmnr.ai/evaluations/reference#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Evaluations

Laminar evaluations SDK and CLI reference

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [evaluate reference](https://docs.lmnr.ai/evaluations/reference#evaluate-reference)
- [TypeScript evaluation types](https://docs.lmnr.ai/evaluations/reference#typescript-evaluation-types)
- [eval CLI reference](https://docs.lmnr.ai/evaluations/reference#eval-cli-reference)
- [Options](https://docs.lmnr.ai/evaluations/reference#options)
- [Params](https://docs.lmnr.ai/evaluations/reference#params)

## [​](https://docs.lmnr.ai/evaluations/reference\#evaluate-reference)  `evaluate` reference

Evaluations in Laminar are configured using the `evaluate` function. The function takes the following arguments:

- `data`: Either (1) A list of dictionaries, where each dictionary contains the data and target for a single evaluation; or
(2) An instance of `LaminarDataset` – read more in [the dedicated section](https://docs.lmnr.ai/evaluations/configuration#using-a-laminar-dataset-for-evaluations).
- `executor`: An optionally async function that takes a single argument, the evaluation data, and returns the output.
- `evaluators`: A dictionary of async functions that take the output and target as arguments and return a score. Keys in the dictionary are the names of the evaluators.
- `name` (optional): Evaluation name, so it is easier to identify the evaluation in the UI. If not provided, a random name is assigned.
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
- `instrumentModules`: A map from module names to packages to be instrumented.
Read more in the [instrumentation guide](https://docs.lmnr.ai/tracing/automatic-instrumentation#instrument-specific-modules-only).

### [​](https://docs.lmnr.ai/evaluations/reference\#typescript-evaluation-types)  TypeScript evaluation types

Here’s the full type signature of the evaluator function:

Copy

```
abstract class Dataset<D, T> {
  public async slice(start: number, end: number): Promise<Datapoint<D, T>[]> {
    const result = [];
    for (let i = Math.max(start, 0); i < Math.min(end, await this.size()); i++) {
      result.push(await this.get(i));
    }
    return result;
  }
  public abstract size(): Promise<number> | number;
  public abstract get(index: number): Promise<Datapoint<D, T>> | Datapoint<D, T>;
}

type EvaluatorFunctionReturn = number | Record<string, number>;
type EvaluatorFunction<O, T> = (output: O, target?: T, ...args: any[]) =>
  EvaluatorFunctionReturn | Promise<EvaluatorFunctionReturn>;

async function evaluate<D, T, O>({
  data, executor, evaluators, groupName, name, config,
}: {
  /**
   * List of data points to evaluate. `data` is the input to the executor
   * function,
   * `target` is the input to the evaluator function.
   * `Dataset` is the base class for `LaminarDataset`
   */
  data: (Datapoint<D, T>[]) | Dataset<D, T>;
  /**
   * The executor function. Takes the data point + any additional arguments
   * and returns the output to evaluate.
   */
  executor: (data: D, ...args: any[]) => O | Promise<O>;
  /**
   * Evaluator functions and names. Each evaluator function takes the output of
   * the executor _and_ the target data, and returns a score. The score can be a
   * single number or a dict of string keys and number values. If the score is a
   * single number, it will be named after the evaluator function. Evaluator
   * function names must contain only letters, digits, hyphens, underscores,
   * or spaces.
   */
  evaluators: Record<string, EvaluatorFunction<O, T>>;
  /**
   * Name of the evaluation. If not provided, a random name will be assigned.
   */
  name?: string;
  /**
   * Optional group id of the evaluation. Only evaluations within the same
   * group_id can be visually compared. Defaults to "default".
   */
  groupName?: string;
  /**
   * Optional override configurations for the evaluator.
   */
  config?: EvaluatorConfig;
}): Promise<void>;

/**
 * Configuration for the Evaluator
 */
interface EvaluatorConfig {
  /**
   * The number of data points to evaluate in parallel at a time. Defaults to 5.
   */
  concurrencyLimit?: number;
  /**
   * The project API key to use for the evaluation. If not provided,
   * the API key from the environment variable `LMNR_PROJECT_API_KEY` will be used.
   */
  projectApiKey?: string;
  /**
   * The base URL of the Laminar API. If not provided, the default is
   * `https://api.lmnr.ai`. Useful with self-hosted Laminar instances.
   * Do NOT include the port in the URL, use `httpPort` and `grpcPort` instead.
   */
  baseUrl?: string;
  /**
   * The HTTP port of the Laminar API. If not provided, the default is 443.
   */
  httpPort?: number;
  /**
   * The gRPC port of the Laminar API. If not provided, the default is 8443.
   */
  grpcPort?: number;
  /**
   * Object with modules to instrument. If not provided, all
   * available modules are instrumented.
   * See {@link https://docs.lmnr.ai/tracing/automatic-instrumentation}
   */
  instrumentModules?: InitializeOptions['instrumentModules'];
  /**
   * If true, then the spans will not be batched.
   */
  traceDisableBatch?: boolean;
  /**
   * Timeout for trace export. Defaults to 30_000 (30 seconds), which is over
   * the default OTLP exporter timeout of 10_000 (10 seconds).
   */
  traceExportTimeoutMillis?: number;
  /**
   * Defines default log level for SDK and all instrumentations.
   */
  logLevel?: "debug" | "info" | "warn" | "error";

  /**
   * Maximum number of spans to export at a time. Defaults to 64.
   */
  traceExportBatchSize?: number;
}

```

See all 107 lines

Example use:

Copy

```
import type {
  Datapoint,
  EvaluatorFunction,
} from '@lmnr-ai/lmnr';

type DataType = {
  question: string;
  user_id: string;
  timestamp: string;
}

type TargetType = {
  answer: string;
  reasoning?: string;
}

type OutputType = string;

const accuracy: EvaluatorFunction<OutputType, TargetType> =
  (output, target) => output === target.answer ? 1 : 0;

const data: Datapoint<DataType, TargetType> = {
  input: {
    question: "What is the capital of France?",
    user_id: "123",
    timestamp: "2021-01-01",
  },
  target: { answer: "Paris" },
}

evaluate<DataType, TargetType, OutputType>({
  data,
  executor: async (data) => {
    // Call an LLM to answer the question
    return "Paris";
  },
  evaluators: { accuracy },
});

```

See all 38 lines

## [​](https://docs.lmnr.ai/evaluations/reference\#eval-cli-reference)  eval CLI reference

`lmnr eval` subcommand is used to run evaluations.

Copy

```
lmnr eval [options]
# or in most Node settings
npx lmnr eval [options]

```

### [​](https://docs.lmnr.ai/evaluations/reference\#options)  Options

First positional argument is the path to the evaluation file. E.g.

Copy

```
lmnr eval ./evals/my_evaluation.eval.ts

```

If file is not provided, `lmnr eval` will run all files in the `evals` directory that match the naming pattern.
For TypeScript/JavaScript, the pattern is `*.eval.{ts,js}`. For Python, the pattern is `eval_*.py` or `*_eval.py`.

### [​](https://docs.lmnr.ai/evaluations/reference\#params)  Params

`--fail-on-error` – if set, the CLI will fail on non-critical errors, for example, if `evaluate` is not called in the file. Default is `false`.

[Configuration](https://docs.lmnr.ai/evaluations/configuration) [Manual Evaluation](https://docs.lmnr.ai/evaluations/manual-evaluation)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.