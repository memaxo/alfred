AI SDK Coretranscribe

Copy markdown

# `transcribe()`

`transcribe` is an experimental feature.

Generates a transcript from an audio file.

    import { experimental_transcribe as transcribe } from 'ai';

    import { openai } from '@ai-sdk/openai';

    import { readFile } from 'fs/promises';




    const { text: transcript } = await transcribe({

      model: openai.transcription('whisper-1'),

      audio: await readFile('audio.mp3'),

    });




    console.log(transcript);

## Import

    import { experimental_transcribe as transcribe } from "ai"

## API Signature

### Parameters

### model:

TranscriptionModelV3

The transcription model to use.

### audio:

DataContent (string | Uint8Array | ArrayBuffer | Buffer) | URL

The audio file to generate the transcript from.

### providerOptions?:

Record

Additional provider-specific options.

### maxRetries?:

number

Maximum number of retries. Default: 2.

### abortSignal?:

AbortSignal

An optional abort signal to cancel the call.

### headers?:

Record

Additional HTTP headers for the request.

### Returns

### text:

string

The complete transcribed text from the audio input.

### segments:

Array

An array of transcript segments, each containing a portion of the transcribed text along with its start and end times in seconds.

### language:

string | undefined

The language of the transcript in ISO-639-1 format e.g. "en" for English.

### durationInSeconds:

number | undefined

The duration of the transcript in seconds.

### warnings:

TranscriptionWarning[]

Warnings from the model provider (e.g. unsupported settings).

### responses:

Array

Response metadata from the provider. There may be multiple responses if we made multiple calls to the model.

TranscriptionModelResponseMetadata

### timestamp:

Date

Timestamp for the start of the generated response.

### modelId:

string

The ID of the response model that was used to generate the response.

### headers?:

Record

Response headers.

Previous

generateImage

Next

generateSpeech
