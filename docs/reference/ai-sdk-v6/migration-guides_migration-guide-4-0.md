Migration GuidesMigrate AI SDK 3.4 to 4.0

Copy markdown

# Migrate AI SDK 3.4 to 4.0

Check out the AI SDK 4.0 release blog post for more information about the release.

## Recommended Migration Process

1. Backup your project. If you use a versioning control system, make sure all previous versions are committed.
2. Migrate to AI SDK 3.4.
3. Upgrade to AI SDK 4.0.
4. Automatically migrate your code using codemods.

> If you don't want to use codemods, we recommend resolving all deprecation warnings before upgrading to AI SDK 4.0.

5. Follow the breaking changes guide below.
6. Verify your project is working as expected.
7. Commit your changes.

## AI SDK 4.0 package versions

You need to update the following packages to the following versions in your `package.json` file(s):

- `ai` package: `4.0.*`
- `ai-sdk@provider-utils` package: `2.0.*`
- `ai-sdk/*` packages: `1.0.*` (other `@ai-sdk` packages)

## Codemods

The AI SDK provides Codemod transformations to help upgrade your codebase when a feature is deprecated, removed, or otherwise changed.

Codemods are transformations that run on your codebase programmatically. They allow you to easily apply many changes without having to manually go through every file.

Codemods are intended as a tool to help you with the upgrade process. They may not cover all of the changes you need to make. You may need to make additional changes manually.

You can run all codemods provided as part of the 4.0 upgrade process by running the following command from the root of your project:

    npx @ai-sdk/codemod upgrade

To run only the v4 codemods:

    npx @ai-sdk/codemod v4

Individual codemods can be run by specifying the name of the codemod:

    npx @ai-sdk/codemod

For example, to run a specific v4 codemod:

    npx @ai-sdk/codemod v4/replace-baseurl src/

See also the table of codemods. In addition, the latest set of codemods can be found in the `@ai-sdk/codemod` repository.

## Provider Changes

### Removed `baseUrl` option

The `baseUrl` option has been removed from all providers. Please use the `baseURL` option instead.

AI SDK 3.4

    const perplexity = createOpenAI({

      // ...

      baseUrl: 'https://api.perplexity.ai/',

    });

AI SDK 4.0

    const perplexity = createOpenAI({

      // ...

      baseURL: 'https://api.perplexity.ai/',

    });

### Anthropic Provider

#### Removed `Anthropic` facade

The `Anthropic` facade has been removed from the Anthropic provider. Please use the `anthropic` object or the `createAnthropic` function instead.

AI SDK 3.4

    const anthropic = new Anthropic({

      // ...

    });

AI SDK 4.0

    const anthropic = createAnthropic({

      // ...

    });

#### Removed `topK` setting

There is no codemod available for this change. Please review and update your code manually.

The model specific `topK` setting has been removed from the Anthropic provider. You can use the standard `topK` setting instead.

AI SDK 3.4

    const result = await generateText({

      model: anthropic('claude-3-5-sonnet-latest', {

        topK: 0.5,

      }),

    });

AI SDK 4.0

    const result = await generateText({

      model: anthropic('claude-3-5-sonnet-latest'),

      topK: 0.5,

    });

### Google Generative AI Provider

#### Removed `Google` facade

The `Google` facade has been removed from the Google Generative AI provider. Please use the `google` object or the `createGoogleGenerativeAI` function instead.

AI SDK 3.4

    const google = new Google({

      // ...

    });

AI SDK 4.0

    const google = createGoogleGenerativeAI({

      // ...

    });

#### Removed `topK` setting

There is no codemod available for this change. Please review and update your code manually.

The model-specific `topK` setting has been removed from the Google Generative AI provider. You can use the standard `topK` setting instead.

AI SDK 3.4

    const result = await generateText({

      model: google('gemini-1.5-flash', {

        topK: 0.5,

      }),

    });

AI SDK 4.0

    const result = await generateText({

      model: google('gemini-1.5-flash'),

      topK: 0.5,

    });

### Google Vertex Provider

#### Removed `topK` setting

There is no codemod available for this change. Please review and update your code manually.

The model-specific `topK` setting has been removed from the Google Vertex provider. You can use the standard `topK` setting instead.

AI SDK 3.4

    const result = await generateText({

      model: vertex('gemini-1.5-flash', {

        topK: 0.5,

      }),

    });

AI SDK 4.0

    const result = await generateText({

      model: vertex('gemini-1.5-flash'),

      topK: 0.5,

    });

### Mistral Provider

#### Removed `Mistral` facade

The `Mistral` facade has been removed from the Mistral provider. Please use the `mistral` object or the `createMistral` function instead.

AI SDK 3.4

    const mistral = new Mistral({

      // ...

    });

AI SDK 4.0

    const mistral = createMistral({

      // ...

    });

### OpenAI Provider

#### Removed `OpenAI` facade

The `OpenAI` facade has been removed from the OpenAI provider. Please use the `openai` object or the `createOpenAI` function instead.

AI SDK 3.4

    const openai = new OpenAI({

      // ...

    });

AI SDK 4.0

    const openai = createOpenAI({

      // ...

    });

### LangChain Adapter

#### Removed `toAIStream`

The `toAIStream` function has been removed from the LangChain adapter. Please use the `toDataStream` function instead.

AI SDK 3.4

    LangChainAdapter.toAIStream(stream);

AI SDK 4.0

    LangChainAdapter.toDataStream(stream);

## AI SDK Core Changes

### `streamText` returns immediately

Instead of returning a Promise, the `streamText` function now returns immediately. It is not necessary to await the result of `streamText`.

AI SDK 3.4

    const result = await streamText({

      // ...

    });

AI SDK 4.0

    const result = streamText({

      // ...

    });

### `streamObject` returns immediately

Instead of returning a Promise, the `streamObject` function now returns immediately. It is not necessary to await the result of `streamObject`.

AI SDK 3.4

    const result = await streamObject({

      // ...

    });

AI SDK 4.0

    const result = streamObject({

      // ...

    });

### Remove roundtrips

The `maxToolRoundtrips` and `maxAutomaticRoundtrips` options have been removed from the `generateText` and `streamText` functions. Please use the `maxSteps` option instead.

The `roundtrips` property has been removed from the `GenerateTextResult` type. Please use the `steps` property instead.

AI SDK 3.4

    const { text, roundtrips } = await generateText({

      maxToolRoundtrips: 1, // or maxAutomaticRoundtrips

      // ...

    });

AI SDK 4.0

    const { text, steps } = await generateText({

      maxSteps: 2,

      // ...

    });

### Removed `nanoid` export

The `nanoid` export has been removed. Please use `generateId` instead.

AI SDK 3.4

    import { nanoid } from 'ai';

AI SDK 4.0

    import { generateId } from 'ai';

### Increased default size of generated IDs

There is no codemod available for this change. Please review and update your code manually.

The `generateId` function now generates 16-character IDs. The previous default was 7 characters.

This might e.g. require updating your database schema if you limit the length of IDs.

AI SDK 4.0

    import { generateId } from 'ai';




    const id = generateId(); // now 16 characters

### Removed `ExperimentalMessage` types

The following types have been removed:

- `ExperimentalMessage` (use `ModelMessage` instead)
- `ExperimentalUserMessage` (use `CoreUserMessage` instead)
- `ExperimentalAssistantMessage` (use `CoreAssistantMessage` instead)
- `ExperimentalToolMessage` (use `CoreToolMessage` instead)

AI SDK 3.4

    import {

      ExperimentalMessage,

      ExperimentalUserMessage,

      ExperimentalAssistantMessage,

      ExperimentalToolMessage,

    } from 'ai';

AI SDK 4.0

    import {

      ModelMessage,

      CoreUserMessage,

      CoreAssistantMessage,

      CoreToolMessage,

    } from 'ai';

### Removed `ExperimentalTool` type

The `ExperimentalTool` type has been removed. Please use the `CoreTool` type instead.

AI SDK 3.4

    import { ExperimentalTool } from 'ai';

AI SDK 4.0

    import { CoreTool } from 'ai';

### Removed experimental AI function exports

The following exports have been removed:

- `experimental_generateText` (use `generateText` instead)
- `experimental_streamText` (use `streamText` instead)
- `experimental_generateObject` (use `generateObject` instead)
- `experimental_streamObject` (use `streamObject` instead)

AI SDK 3.4

    import {

      experimental_generateText,

      experimental_streamText,

      experimental_generateObject,

      experimental_streamObject,

    } from 'ai';

AI SDK 4.0

    import { generateText, streamText, generateObject, streamObject } from 'ai';

### Removed AI-stream related methods from `streamText`

The following methods have been removed from the `streamText` result:

- `toAIStream`
- `pipeAIStreamToResponse`
- `toAIStreamResponse`

Use the `toDataStream`, `pipeDataStreamToResponse`, and `toDataStreamResponse` functions instead.

AI SDK 3.4

    const result = await streamText({

      // ...

    });




    result.toAIStream();

    result.pipeAIStreamToResponse(response);

    result.toAIStreamResponse();

AI SDK 4.0

    const result = streamText({

      // ...

    });




    result.toDataStream();

    result.pipeDataStreamToResponse(response);

    result.toUIMessageStreamResponse();

### Renamed "formatStreamPart" to "formatDataStreamPart"

The `formatStreamPart` function has been renamed to `formatDataStreamPart`.

AI SDK 3.4

    formatStreamPart('text', 'Hello, world!');

AI SDK 4.0

    formatDataStreamPart('text', 'Hello, world!');

### Renamed "parseStreamPart" to "parseDataStreamPart"

The `parseStreamPart` function has been renamed to `parseDataStreamPart`.

AI SDK 3.4

    const part = parseStreamPart(line);

AI SDK 4.0

    const part = parseDataStreamPart(line);

### Renamed `TokenUsage`, `CompletionTokenUsage` and `EmbeddingTokenUsage` types

The `TokenUsage`, `CompletionTokenUsage` and `EmbeddingTokenUsage` types have been renamed to `LanguageModelUsage` (for the first two) and `EmbeddingModelUsage` (for the last).

AI SDK 3.4

    import { TokenUsage, CompletionTokenUsage, EmbeddingTokenUsage } from 'ai';

AI SDK 4.0

    import { LanguageModelUsage, EmbeddingModelUsage } from 'ai';

### Removed deprecated telemetry data

There is no codemod available for this change. Please review and update your code manually.

The following telemetry data values have been removed:

- `ai.finishReason` (now in `ai.response.finishReason`)
- `ai.result.object` (now in `ai.response.object`)
- `ai.result.text` (now in `ai.response.text`)
- `ai.result.toolCalls` (now in `ai.response.toolCalls`)
- `ai.stream.msToFirstChunk` (now in `ai.response.msToFirstChunk`)

This change will apply to observability providers and any scripts or automation that you use for processing telemetry data.

### Provider Registry

#### Removed experimental_Provider, experimental_ProviderRegistry, and experimental_ModelRegistry

The `experimental_Provider` interface, `experimental_ProviderRegistry` interface, and `experimental_ModelRegistry` interface have been removed. Please use the `Provider` interface instead.

AI SDK 3.4

    import { experimental_Provider, experimental_ProviderRegistry } from 'ai';

AI SDK 4.0

    import { Provider } from 'ai';

The model registry is not available any more. Please register providers instead.

#### Removed `experimental_​createModelRegistry` function

The `experimental_createModelRegistry` function has been removed. Please use the `experimental_createProviderRegistry` function instead.

AI SDK 3.4

    import { experimental_createModelRegistry } from 'ai';

AI SDK 4.0

    import { experimental_createProviderRegistry } from 'ai';

The model registry is not available any more. Please register providers instead.

### Removed `rawResponse` from results

There is no codemod available for this change. Please review and update your code manually.

The `rawResponse` property has been removed from the `generateText`, `streamText`, `generateObject`, and `streamObject` results. You can use the `response` property instead.

AI SDK 3.4

    const { text, rawResponse } = await generateText({

      // ...

    });

AI SDK 4.0

    const { text, response } = await generateText({

      // ...

    });

### Removed `init` option from `pipeDataStreamToResponse` and `toDataStreamResponse`

There is no codemod available for this change. Please review and update your code manually.

The `init` option has been removed from the `pipeDataStreamToResponse` and `toDataStreamResponse` functions. You can set the values from `init` directly into the `options` object.

AI SDK 3.4

    const result = await streamText({

      // ...

    });




    result.toUIMessageStreamResponse(response, {

      init: {

        headers: {

          'X-Custom-Header': 'value',

        },

      },

      // ...

    });

AI SDK 4.0

    const result = streamText({

      // ...

    });




    result.toUIMessageStreamResponse(response, {

      headers: {

        'X-Custom-Header': 'value',

      },

      // ...

    });

### Removed `responseMessages` from `generateText` and `streamText`

There is no codemod available for this change. Please review and update your code manually.

The `responseMessages` property has been removed from the `generateText` and `streamText` results. This includes the `onFinish` callback. Please use the `response.messages` property instead.

AI SDK 3.4

    const { text, responseMessages } = await generateText({

      // ...

    });

AI SDK 4.0

    const { text, response } = await generateText({

      // ...

    });




    const responseMessages = response.messages;

### Removed `experimental_​continuationSteps` option

The `experimental_continuationSteps` option has been removed from the `generateText` function. Please use the `experimental_continueSteps` option instead.

AI SDK 3.4

    const result = await generateText({

      experimental_continuationSteps: true,

      // ...

    });

AI SDK 4.0

    const result = await generateText({

      experimental_continueSteps: true,

      // ...

    });

### Removed `LanguageModelResponseMetadataWithHeaders` type

The `LanguageModelResponseMetadataWithHeaders` type has been removed. Please use the `LanguageModelResponseMetadata` type instead.

AI SDK 3.4

    import { LanguageModelResponseMetadataWithHeaders } from 'ai';

AI SDK 4.0

    import { LanguageModelResponseMetadata } from 'ai';

#### Changed `streamText` warnings result to Promise

There is no codemod available for this change. Please review and update your code manually.

The `warnings` property of the `StreamTextResult` type is now a Promise.

AI SDK 3.4

    const result = await streamText({

      // ...

    });




    const warnings = result.warnings;

AI SDK 4.0

    const result = streamText({

      // ...

    });




    const warnings = await result.warnings;

#### Changed `streamObject` warnings result to Promise

There is no codemod available for this change. Please review and update your code manually.

The `warnings` property of the `StreamObjectResult` type is now a Promise.

AI SDK 3.4

    const result = await streamObject({

      // ...

    });




    const warnings = result.warnings;

AI SDK 4.0

    const result = streamObject({

      // ...

    });




    const warnings = await result.warnings;

#### Renamed `simulateReadableStream` `values` to `chunks`

There is no codemod available for this change. Please review and update your code manually.

The `simulateReadableStream` function from `ai/test` has been renamed to `chunks`.

AI SDK 3.4

    import { simulateReadableStream } from 'ai/test';




    const stream = simulateReadableStream({

      values: [1, 2, 3],

      chunkDelayInMs: 100,

    });

AI SDK 4.0

    import { simulateReadableStream } from 'ai/test';




    const stream = simulateReadableStream({

      chunks: [1, 2, 3],

      chunkDelayInMs: 100,

    });

## AI SDK RSC Changes

There are no codemods available for the changes in this section. Please review and update your code manually.

### Removed `render` function

The AI SDK RSC 3.0 `render` function has been removed. Please use the `streamUI` function instead or switch to AI SDK UI.

AI SDK 3.0

    import { render } from '@ai-sdk/rsc';

AI SDK 4.0

    import { streamUI } from '@ai-sdk/rsc';

## AI SDK UI Changes

### Removed Svelte, Vue, and SolidJS exports

This codemod only operates on `.ts` and `.tsx` files. If you have code in files with other suffixes, please review and update your code manually.

The `ai` package no longer exports Svelte, Vue, and SolidJS UI integrations. You need to install the `@ai-sdk/svelte`, `@ai-sdk/vue`, and `@ai-sdk/solid` packages directly.

AI SDK 3.4

    import { useChat } from 'ai/svelte';

AI SDK 4.0

    import { useChat } from '@ai-sdk/svelte';

### Removed `experimental_StreamData`

The `experimental_StreamData` export has been removed. Please use the `StreamData` export instead.

AI SDK 3.4

    import { experimental_StreamData } from 'ai';

AI SDK 4.0

    import { StreamData } from 'ai';

### `useChat` hook

There are no codemods available for the changes in this section. Please review and update your code manually.

#### Removed `streamMode` setting

The `streamMode` options has been removed from the `useChat` hook. Please use the `streamProtocol` parameter instead.

AI SDK 3.4

    const { messages } = useChat({

      streamMode: 'text',

      // ...

    });

AI SDK 4.0

    const { messages } = useChat({

      streamProtocol: 'text',

      // ...

    });

#### Replaced roundtrip setting with `maxSteps`

The following options have been removed from the `useChat` hook:

- `experimental_maxAutomaticRoundtrips`
- `maxAutomaticRoundtrips`
- `maxToolRoundtrips`

Please use the `maxSteps` option instead. The value of `maxSteps` is equal to roundtrips + 1.

AI SDK 3.4

    const { messages } = useChat({

      experimental_maxAutomaticRoundtrips: 2,

      // or maxAutomaticRoundtrips

      // or maxToolRoundtrips

      // ...

    });

AI SDK 4.0

    const { messages } = useChat({

      maxSteps: 3, // 2 roundtrips + 1

      // ...

    });

#### Removed `options` setting

The `options` parameter in the `useChat` hook has been removed. Please use the `headers` and `body` parameters instead.

AI SDK 3.4

    const { messages } = useChat({

      options: {

        headers: {

          'X-Custom-Header': 'value',

        },

      },

      // ...

    });

AI SDK 4.0

    const { messages } = useChat({

      headers: {

        'X-Custom-Header': 'value',

      },

      // ...

    });

#### Removed `experimental_addToolResult` method

The `experimental_addToolResult` method has been removed from the `useChat` hook. Please use the `addToolResult` method instead.

AI SDK 3.4

    const { messages, experimental_addToolResult } = useChat({

      // ...

    });

AI SDK 4.0

    const { messages, addToolResult } = useChat({

      // ...

    });

#### Changed default value of `keepLastMessageOnError` to true and deprecated the option

The `keepLastMessageOnError` option has been changed to default to `true`. The option will be removed in the next major release.

AI SDK 3.4

    const { messages } = useChat({

      keepLastMessageOnError: true,

      // ...

    });

AI SDK 4.0

    const { messages } = useChat({

      // ...

    });

### `useCompletion` hook

There are no codemods available for the changes in this section. Please review and update your code manually.

#### Removed `streamMode` setting

The `streamMode` options has been removed from the `useCompletion` hook. Please use the `streamProtocol` parameter instead.

AI SDK 3.4

    const { text } = useCompletion({

      streamMode: 'text',

      // ...

    });

AI SDK 4.0

    const { text } = useCompletion({

      streamProtocol: 'text',

      // ...

    });

### `useAssistant` hook

#### Removed `experimental_useAssistant` export

The `experimental_useAssistant` export has been removed from the `useAssistant` hook. Please use the `useAssistant` hook directly instead.

AI SDK 3.4

    import { experimental_useAssistant } from '@ai-sdk/react';

AI SDK 4.0

    import { useAssistant } from '@ai-sdk/react';

#### Removed `threadId` and `messageId` from `AssistantResponse`

There is no codemod available for this change. Please review and update your code manually.

The `threadId` and `messageId` parameters have been removed from the `AssistantResponse` function. Please use the `threadId` and `messageId` variables from the outer scope instead.

AI SDK 3.4

    return AssistantResponse(

      { threadId: myThreadId, messageId: myMessageId },

      async ({ forwardStream, sendDataMessage, threadId, messageId }) => {

        // use threadId and messageId here

      },

    );

AI SDK 4.0

    return AssistantResponse(

      { threadId: myThreadId, messageId: myMessageId },

      async ({ forwardStream, sendDataMessage }) => {

        // use myThreadId and myMessageId here

      },

    );

#### Removed `experimental_​AssistantResponse` export

There is no codemod available for this change. Please review and update your code manually.

The `experimental_AssistantResponse` export has been removed. Please use the `AssistantResponse` function directly instead.

AI SDK 3.4

    import { experimental_AssistantResponse } from 'ai';

AI SDK 4.0

    import { AssistantResponse } from 'ai';

### `experimental_useObject` hook

There are no codemods available for the changes in this section. Please review and update your code manually.

The `setInput` helper has been removed from the `experimental_useObject` hook. Please use the `submit` helper instead.

AI SDK 3.4

    const { object, setInput } = useObject({

      // ...

    });

AI SDK 4.0

    const { object, submit } = useObject({

      // ...

    });

## AI SDK Errors

### Removed `isXXXError` static methods

The `isXXXError` static methods have been removed from AI SDK errors. Please use the `isInstance` method of the corresponding error class instead.

AI SDK 3.4

    import { APICallError } from 'ai';




    APICallError.isAPICallError(error);

AI SDK 4.0

    import { APICallError } from 'ai';




    APICallError.isInstance(error);

### Removed `toJSON` method

There is no codemod available for this change. Please review and update your code manually.

The `toJSON` method has been removed from AI SDK errors.

## AI SDK 2.x Legacy Changes

There are no codemods available for the changes in this section. Please review and update your code manually.

### Removed 2.x legacy providers

Legacy providers from AI SDK 2.x have been removed. Please use the new AI SDK provider architecture instead.

#### Removed 2.x legacy function and tool calling

The legacy `function_call` and `tools` options have been removed from `useChat` and `Message`. The `name` property from the `Message` type has been removed. Please use the AI SDK Core tool calling instead.

### Removed 2.x prompt helpers

Prompt helpers for constructing message prompts are no longer needed with the AI SDK provider architecture and have been removed.

### Removed 2.x `AIStream`

The `AIStream` function and related exports have been removed. Please use the `streamText` function and its `toDataStream()` method instead.

### Removed 2.x `StreamingTextResponse`

The `StreamingTextResponse` function has been removed. Please use the `streamText` function and its `toDataStreamResponse()` method instead.

### Removed 2.x `streamToResponse`

The `streamToResponse` function has been removed. Please use the `streamText` function and its `pipeDataStreamToResponse()` method instead.

### Removed 2.x RSC `Tokens` streaming

The legacy `Tokens` RSC streaming from 2.x has been removed. `Tokens` were implemented prior to AI SDK RSC and are no longer needed.

## Codemod Table

The following table lists codemod availability for the AI SDK 4.0 upgrade process. Note the codemod `upgrade` command will run all of them for you. This list is provided to give visibility into which migrations have some automation. It can also be helpful to find the codemod names if you'd like to run a subset of codemods. For more, see the Codemods section.

| Change                                                                                         | Codemod                                               |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Provider Changes**                                                                           |
| Removed baseUrl option                                                                         | `v4/replace-baseurl`                                  |
| **Anthropic Provider**                                                                         |
| Removed Anthropic facade                                                                       | `v4/remove-anthropic-facade`                          |
| Removed topK setting                                                                           | _N/A_                                                 |
| **Google Generative AI Provider**                                                              |
| Removed Google facade                                                                          | `v4/remove-google-facade`                             |
| Removed topK setting                                                                           | _N/A_                                                 |
| **Google Vertex Provider**                                                                     |
| Removed topK setting                                                                           | _N/A_                                                 |
| **Mistral Provider**                                                                           |
| Removed Mistral facade                                                                         | `v4/remove-mistral-facade`                            |
| **OpenAI Provider**                                                                            |
| Removed OpenAI facade                                                                          | `v4/remove-openai-facade`                             |
| **LangChain Adapter**                                                                          |
| Removed toAIStream                                                                             | `v4/replace-langchain-toaistream`                     |
| **AI SDK Core Changes**                                                                        |
| streamText returns immediately                                                                 | `v4/remove-await-streamtext`                          |
| streamObject returns immediately                                                               | `v4/remove-await-streamobject`                        |
| Remove roundtrips                                                                              | `v4/replace-roundtrips-with-maxsteps`                 |
| Removed nanoid export                                                                          | `v4/replace-nanoid`                                   |
| Increased default size of generated IDs                                                        | _N/A_                                                 |
| Removed ExperimentalMessage types                                                              | `v4/remove-experimental-message-types`                |
| Removed ExperimentalTool type                                                                  | `v4/remove-experimental-tool`                         |
| Removed experimental AI function exports                                                       | `v4/remove-experimental-ai-fn-exports`                |
| Removed AI-stream related methods from streamText                                              | `v4/remove-ai-stream-methods-from-stream-text-result` |
| Renamed "formatStreamPart" to "formatDataStreamPart"                                           | `v4/rename-format-stream-part`                        |
| Renamed "parseStreamPart" to "parseDataStreamPart"                                             | `v4/rename-parse-stream-part`                         |
| Renamed TokenUsage, CompletionTokenUsage and EmbeddingTokenUsage types                         | `v4/replace-token-usage-types`                        |
| Removed deprecated telemetry data                                                              | _N/A_                                                 |
| **Provider Registry**                                                                          |
| → Removed experimental_Provider, experimental_ProviderRegistry, and experimental_ModelRegistry | `v4/remove-deprecated-provider-registry-exports`      |
| → Removed experimental_createModelRegistry function                                            | _N/A_                                                 |
| Removed rawResponse from results                                                               | _N/A_                                                 |
| Removed init option from pipeDataStreamToResponse and toDataStreamResponse                     | _N/A_                                                 |
| Removed responseMessages from generateText and streamText                                      | _N/A_                                                 |
| Removed experimental_continuationSteps option                                                  | `v4/replace-continuation-steps`                       |
| Removed LanguageModelResponseMetadataWithHeaders type                                          | `v4/remove-metadata-with-headers`                     |
| Changed streamText warnings result to Promise                                                  | _N/A_                                                 |
| Changed streamObject warnings result to Promise                                                | _N/A_                                                 |
| Renamed simulateReadableStream values to chunks                                                | _N/A_                                                 |
| **AI SDK RSC Changes**                                                                         |
| Removed render function                                                                        | _N/A_                                                 |
| **AI SDK UI Changes**                                                                          |
| Removed Svelte, Vue, and SolidJS exports                                                       | `v4/rewrite-framework-imports`                        |
| Removed experimental_StreamData                                                                | `v4/remove-experimental-streamdata`                   |
| **useChat hook**                                                                               |
| Removed streamMode setting                                                                     | _N/A_                                                 |
| Replaced roundtrip setting with maxSteps                                                       | `v4/replace-roundtrips-with-maxsteps`                 |
| Removed options setting                                                                        | _N/A_                                                 |
| Removed experimental_addToolResult method                                                      | _N/A_                                                 |
| Changed default value of keepLastMessageOnError to true and deprecated the option              | _N/A_                                                 |
| **useCompletion hook**                                                                         |
| Removed streamMode setting                                                                     | _N/A_                                                 |
| **useAssistant hook**                                                                          |
| Removed experimental_useAssistant export                                                       | `v4/remove-experimental-useassistant`                 |
| Removed threadId and messageId from AssistantResponse                                          | _N/A_                                                 |
| Removed experimental_AssistantResponse export                                                  | _N/A_                                                 |
| **experimental_useObject hook**                                                                |
| Removed setInput helper                                                                        | _N/A_                                                 |
| **AI SDK Errors**                                                                              |
| Removed isXXXError static methods                                                              | `v4/remove-isxxxerror`                                |
| Removed toJSON method                                                                          | _N/A_                                                 |
| **AI SDK 2.x Legacy Changes**                                                                  |
| Removed 2.x legacy providers                                                                   | _N/A_                                                 |
| Removed 2.x legacy function and tool calling                                                   | _N/A_                                                 |
| Removed 2.x prompt helpers                                                                     | _N/A_                                                 |
| Removed 2.x AIStream                                                                           | _N/A_                                                 |
| Removed 2.x StreamingTextResponse                                                              | _N/A_                                                 |
| Removed 2.x streamToResponse                                                                   | _N/A_                                                 |
| Removed 2.x RSC Tokens streaming                                                               | _N/A_                                                 |

Previous

Migrate AI SDK 4.0 to 4.1

Next

Migrate AI SDK 3.3 to 3.4
