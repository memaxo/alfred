AI SDK CoreToolLoopAgent

Copy markdown

# `ToolLoopAgent`

Creates a reusable AI agent capable of generating text, streaming responses, and using tools over multiple steps (a reasoning-and-acting loop). `ToolLoopAgent` is ideal for building autonomous, multi-step agents that can take actions, call tools, and reason over the results until a stop condition is reached.

Unlike single-step calls like `generateText()`, an agent can iteratively invoke tools, collect tool results, and decide next actions until completion or user approval is required.

    import { ToolLoopAgent } from 'ai';




    const agent = new ToolLoopAgent({

      model: 'openai/gpt-4o',

      instructions: 'You are a helpful assistant.',

      tools: {

        weather: weatherTool,

        calculator: calculatorTool,

      },

    });




    const result = await agent.generate({

      prompt: 'What is the weather in NYC?',

    });




    console.log(result.text);

To see `ToolLoopAgent` in action, check out these examples.

## Import

    import { ToolLoopAgent } from "ai"

## Constructor

### Parameters

### model:

LanguageModel

The language model instance to use (e.g., from a provider).

### instructions?:

string

Instructions for the agent, usually used for system prompt/context.

### tools?:

Record

A set of tools the agent can call. Keys are tool names. Tools require the underlying model to support tool calling.

### toolChoice?:

ToolChoice

Tool call selection strategy. Options: 'auto' | 'none' | 'required' | { type: 'tool', toolName: string }. Default: 'auto'.

### stopWhen?:

StopCondition | StopCondition[]

Condition(s) for ending the agent loop. Default: stepCountIs(20).

### activeTools?:

Array

Limits the subset of tools that are available in a specific call.

### output?:

Output

Optional structured output specification, for parsing responses into typesafe data.

### prepareStep?:

PrepareStepFunction

Optional function to mutate step settings or inject state for each agent step.

### experimental_repairToolCall?:

ToolCallRepairFunction

Optional callback to attempt automatic recovery when a tool call cannot be parsed.

### onStepFinish?:

GenerateTextOnStepFinishCallback

Callback invoked after each agent step (LLM/tool call) completes.

### experimental_context?:

unknown

Experimental: Custom context object passed to each tool call.

### experimental_telemetry?:

TelemetrySettings

Experimental: Optional telemetry configuration.

### maxOutputTokens?:

number

Maximum number of tokens the model is allowed to generate.

### temperature?:

number

Sampling temperature, controls randomness. Passed through to the model.

### topP?:

number

Top-p (nucleus) sampling parameter. Passed through to the model.

### topK?:

number

Top-k sampling parameter. Passed through to the model.

### presencePenalty?:

number

Presence penalty parameter. Passed through to the model.

### frequencyPenalty?:

number

Frequency penalty parameter. Passed through to the model.

### stopSequences?:

string[]

Custom token sequences which stop the model output. Passed through to the model.

### seed?:

number

Seed for deterministic generation (if supported).

### maxRetries?:

number

How many times to retry on failure. Default: 2.

### abortSignal?:

AbortSignal

Optional abort signal to cancel the ongoing request.

### providerOptions?:

ProviderOptions

Additional provider-specific configuration.

### id?:

string

Custom agent identifier.

## Methods

### `generate()`

Generates a response and triggers tool calls as needed, running the agent loop and returning the final result. Returns a promise resolving to a `GenerateTextResult`.

    const result = await agent.generate({

      prompt: 'What is the weather like?',

    });

### prompt:

string | Array

A text prompt or message array.

### messages:

Array

A full conversation history as a list of model messages.

#### Returns

The `generate()` method returns a `GenerateTextResult` object (see `generateText` for details).

### `stream()`

Streams a response from the agent, including agent reasoning and tool calls, as they occur. Returns a `StreamTextResult`.

    const stream = agent.stream({

      prompt: 'Tell me a story about a robot.',

    });




    for await (const chunk of stream.textStream) {

      console.log(chunk);

    }

### prompt:

string | Array

A text prompt or message array.

### messages:

Array

A full conversation history as a list of model messages.

#### Returns

The `stream()` method returns a `StreamTextResult` object (see `streamText` for details).

## Types

### `InferAgentUIMessage`

Infers the UI message type for the given agent instance. Useful for type-safe UI and message exchanges.

    import { ToolLoopAgent, InferAgentUIMessage } from 'ai';




    const weatherAgent = new ToolLoopAgent({

      model: 'openai/gpt-4o',

      tools: { weather: weatherTool },

    });




    type WeatherAgentUIMessage = InferAgentUIMessage;

## Examples

### Basic Agent with Tools

    import { ToolLoopAgent, stepCountIs } from 'ai';

    import { weatherTool, calculatorTool } from './tools';




    const assistant = new ToolLoopAgent({

      model: 'openai/gpt-4o',

      instructions: 'You are a helpful assistant.',

      tools: {

        weather: weatherTool,

        calculator: calculatorTool,

      },

      stopWhen: stepCountIs(3),

    });




    const result = await assistant.generate({

      prompt: 'What is the weather in NYC and what is 100 * 25?',

    });




    console.log(result.text);

    console.log(result.steps); // Array of all steps taken by the agent

### Streaming Agent Response

    const agent = new ToolLoopAgent({

      model: 'openai/gpt-4o',

      instructions: 'You are a creative storyteller.',

    });




    const stream = agent.stream({

      prompt: 'Tell me a short story about a time traveler.',

    });




    for await (const chunk of stream.textStream) {

      process.stdout.write(chunk);

    }

### Agent with Output Parsing

    import { z } from 'zod';




    const analysisAgent = new ToolLoopAgent({

      model: 'openai/gpt-4o',

      output: {

        schema: z.object({

          sentiment: z.enum(['positive', 'negative', 'neutral']),

          score: z.number(),

          summary: z.string(),

        }),

      },

    });




    const result = await analysisAgent.generate({

      prompt: 'Analyze this review: "The product exceeded my expectations!"',

    });




    console.log(result.output);

    // Typed as { sentiment: 'positive' | 'negative' | 'neutral', score: number, summary: string }

### Example: Approved Tool Execution

    import { openai } from '@ai-sdk/openai';

    import { ToolLoopAgent } from 'ai';




    const agent = new ToolLoopAgent({

      model: openai('gpt-4o'),

      instructions: 'You are an agent with access to a weather API.',

      tools: {

        weather: openai.tools.weather({

          /* ... */

        }),

      },

      // Optionally require approval, etc.

    });




    const result = await agent.generate({

      prompt: 'Is it raining in Paris today?',

    });

    console.log(result.text);

Previous

Agent (Interface)

Next

createAgentUIStream
