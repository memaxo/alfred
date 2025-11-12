AI SDK CoreTranscription

Copy markdown

# Transcription

Transcription is an experimental feature.

The AI SDK provides the `transcribe` function to transcribe audio using a transcription model.
    
    
    import { experimental_transcribe as transcribe } from 'ai';
    
    import { openai } from '@ai-sdk/openai';
    
    import { readFile } from 'fs/promises';
    
    
    
    
    const transcript = await transcribe({
    
      model: openai.transcription('whisper-1'),
    
      audio: await readFile('audio.mp3'),
    
    });

The `audio` property can be a `Uint8Array`, `ArrayBuffer`, `Buffer`, `string` (base64 encoded audio data), or a `URL`.

To access the generated transcript:
    
    
    const text = transcript.text; // transcript text e.g. "Hello, world!"
    
    const segments = transcript.segments; // array of segments with start and end times, if available
    
    const language = transcript.language; // language of the transcript e.g. "en", if available
    
    const durationInSeconds = transcript.durationInSeconds; // duration of the transcript in seconds, if available

## Settings

### Provider-Specific settings

Transcription models often have provider or model-specific settings which you can set using the `providerOptions` parameter.
    
    
    import { experimental_transcribe as transcribe } from 'ai';
    
    import { openai } from '@ai-sdk/openai';
    
    import { readFile } from 'fs/promises';
    
    
    
    
    const transcript = await transcribe({
    
      model: openai.transcription('whisper-1'),
    
      audio: await readFile('audio.mp3'),
    
      providerOptions: {
    
        openai: {
    
          timestampGranularities: ['word'],
    
        },
    
      },
    
    });

### Abort Signals and Timeouts

`transcribe` accepts an optional `abortSignal` parameter of type `AbortSignal` that you can use to abort the transcription process or set a timeout.
    
    
    import { openai } from '@ai-sdk/openai';
    
    import { experimental_transcribe as transcribe } from 'ai';
    
    import { readFile } from 'fs/promises';
    
    
    
    
    const transcript = await transcribe({
    
      model: openai.transcription('whisper-1'),
    
      audio: await readFile('audio.mp3'),
    
      abortSignal: AbortSignal.timeout(1000), // Abort after 1 second
    
    });

### Custom Headers

`transcribe` accepts an optional `headers` parameter of type `Record` that you can use to add custom headers to the transcription request.
    
    
    import { openai } from '@ai-sdk/openai';
    
    import { experimental_transcribe as transcribe } from 'ai';
    
    import { readFile } from 'fs/promises';
    
    
    
    
    const transcript = await transcribe({
    
      model: openai.transcription('whisper-1'),
    
      audio: await readFile('audio.mp3'),
    
      headers: { 'X-Custom-Header': 'custom-value' },
    
    });

### Warnings

Warnings (e.g. unsupported parameters) are available on the `warnings` property.
    
    
    import { openai } from '@ai-sdk/openai';
    
    import { experimental_transcribe as transcribe } from 'ai';
    
    import { readFile } from 'fs/promises';
    
    
    
    
    const transcript = await transcribe({
    
      model: openai.transcription('whisper-1'),
    
      audio: await readFile('audio.mp3'),
    
    });
    
    
    
    
    const warnings = transcript.warnings;

### Error Handling

When `transcribe` cannot generate a valid transcript, it throws a `AI_NoTranscriptGeneratedError`.

This error can arise for any the following reasons:

  * The model failed to generate a response
  * The model generated a response that could not be parsed

The error preserves the following information to help you log the issue:

  * `responses`: Metadata about the transcription model responses, including timestamp, model, and headers.
  * `cause`: The cause of the error. You can use this for more detailed error handling.

    
    
    import {
    
      experimental_transcribe as transcribe,
    
      NoTranscriptGeneratedError,
    
    } from 'ai';
    
    import { openai } from '@ai-sdk/openai';
    
    import { readFile } from 'fs/promises';
    
    
    
    
    try {
    
      await transcribe({
    
        model: openai.transcription('whisper-1'),
    
        audio: await readFile('audio.mp3'),
    
      });
    
    } catch (error) {
    
      if (NoTranscriptGeneratedError.isInstance(error)) {
    
        console.log('NoTranscriptGeneratedError');
    
        console.log('Cause:', error.cause);
    
        console.log('Responses:', error.responses);
    
      }
    
    }

## Transcription Models

Provider| Model  
---|---  
OpenAI| `whisper-1`  
OpenAI| `gpt-4o-transcribe`  
OpenAI| `gpt-4o-mini-transcribe`  
ElevenLabs| `scribe_v1`  
ElevenLabs| `scribe_v1_experimental`  
Groq| `whisper-large-v3-turbo`  
Groq| `distil-whisper-large-v3-en`  
Groq| `whisper-large-v3`  
Azure OpenAI| `whisper-1`  
Azure OpenAI| `gpt-4o-transcribe`  
Azure OpenAI| `gpt-4o-mini-transcribe`  
Rev.ai| `machine`  
Rev.ai| `low_cost`  
Rev.ai| `fusion`  
Deepgram| `base` (+ variants)  
Deepgram| `enhanced` (+ variants)  
Deepgram| `nova` (+ variants)  
Deepgram| `nova-2` (+ variants)  
Deepgram| `nova-3` (+ variants)  
Gladia| `default`  
AssemblyAI| `best`  
AssemblyAI| `nano`  
Fal| `whisper`  
Fal| `wizper`  
  
Above are a small subset of the transcription models supported by the AI SDK providers. For more, see the respective provider documentation.

Previous

Image Generation

Next

Speech