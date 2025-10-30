---
title: Adding Voice to Agents
url: 
language: en
---
[Skip to Content](https://mastra.ai/en/docs/agents/adding-voice#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Agents](https://mastra.ai/en/docs/agents/overview "Agents") Adding Voice

Copy page

# Adding Voice to Agents

Mastra agents can be enhanced with voice capabilities, allowing them to speak responses and listen to user input. You can configure an agent to use either a single voice provider or combine multiple providers for different operations.

## Using a Single Provider [Permalink for this section](https://mastra.ai/en/docs/agents/adding-voice\#using-a-single-provider)

The simplest way to add voice to an agent is to use a single provider for both speaking and listening:

```nextra-code

import { createReadStream } from "fs";
import path from "path";
import { Agent } from "@mastra/core/agent";
import { OpenAIVoice } from "@mastra/voice-openai";
import { openai } from "@ai-sdk/openai";

// Initialize the voice provider with default settings
const voice = new OpenAIVoice();

// Create an agent with voice capabilities
export const agent = new Agent({
  name: "Agent",
  instructions: `You are a helpful assistant with both STT and TTS capabilities.`,
  model: openai("gpt-4o"),
  voice,
});

// The agent can now use voice for interaction
const audioStream = await agent.voice.speak("Hello, I'm your AI assistant!", {
  filetype: "m4a",
});

playAudio(audioStream!);

try {
  const transcription = await agent.voice.listen(audioStream);
  console.log(transcription);
} catch (error) {
  console.error("Error transcribing audio:", error);
}
```

## Using Multiple Providers [Permalink for this section](https://mastra.ai/en/docs/agents/adding-voice\#using-multiple-providers)

For more flexibility, you can use different providers for speaking and listening using the CompositeVoice class:

```nextra-code

import { Agent } from "@mastra/core/agent";
import { CompositeVoice } from "@mastra/core/voice";
import { OpenAIVoice } from "@mastra/voice-openai";
import { PlayAIVoice } from "@mastra/voice-playai";
import { openai } from "@ai-sdk/openai";

export const agent = new Agent({
  name: "Agent",
  instructions: `You are a helpful assistant with both STT and TTS capabilities.`,
  model: openai("gpt-4o"),

  // Create a composite voice using OpenAI for listening and PlayAI for speaking
  voice: new CompositeVoice({
    input: new OpenAIVoice(),
    output: new PlayAIVoice(),
  }),
});
```

## Working with Audio Streams [Permalink for this section](https://mastra.ai/en/docs/agents/adding-voice\#working-with-audio-streams)

The `speak()` and `listen()` methods work with Node.js streams. Here’s how to save and load audio files:

### Saving Speech Output [Permalink for this section](https://mastra.ai/en/docs/agents/adding-voice\#saving-speech-output)

The `speak` method returns a stream that you can pipe to a file or speaker.

```nextra-code

import { createWriteStream } from "fs";
import path from "path";

// Generate speech and save to file
const audio = await agent.voice.speak("Hello, World!");
const filePath = path.join(process.cwd(), "agent.mp3");
const writer = createWriteStream(filePath);

audio.pipe(writer);

await new Promise<void>((resolve, reject) => {
  writer.on("finish", () => resolve());
  writer.on("error", reject);
});
```

### Transcribing Audio Input [Permalink for this section](https://mastra.ai/en/docs/agents/adding-voice\#transcribing-audio-input)

The `listen` method expects a stream of audio data from a microphone or file.

```nextra-code

import { createReadStream } from "fs";
import path from "path";

// Read audio file and transcribe
const audioFilePath = path.join(process.cwd(), "/agent.m4a");
const audioStream = createReadStream(audioFilePath);

try {
  console.log("Transcribing audio file...");
  const transcription = await agent.voice.listen(audioStream, {
    filetype: "m4a",
  });
  console.log("Transcription:", transcription);
} catch (error) {
  console.error("Error transcribing audio:", error);
}
```

## Speech-to-Speech Voice Interactions [Permalink for this section](https://mastra.ai/en/docs/agents/adding-voice\#speech-to-speech-voice-interactions)

For more dynamic and interactive voice experiences, you can use real-time voice providers that support speech-to-speech capabilities:

```nextra-code

import { Agent } from "@mastra/core/agent";
import { getMicrophoneStream } from "@mastra/node-audio";
import { OpenAIRealtimeVoice } from "@mastra/voice-openai-realtime";
import { search, calculate } from "../tools";

// Initialize the realtime voice provider
const voice = new OpenAIRealtimeVoice({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-mini-realtime",
  speaker: "alloy",
});

// Create an agent with speech-to-speech voice capabilities
export const agent = new Agent({
  name: "Agent",
  instructions: `You are a helpful assistant with speech-to-speech capabilities.`,
  model: openai("gpt-4o"),
  tools: {
    // Tools configured on Agent are passed to voice provider
    search,
    calculate,
  },
  voice,
});

// Establish a WebSocket connection
await agent.voice.connect();

// Start a conversation
agent.voice.speak("Hello, I'm your AI assistant!");

// Stream audio from a microphone
const microphoneStream = getMicrophoneStream();
agent.voice.send(microphoneStream);

// When done with the conversation
agent.voice.close();
```

### Event System [Permalink for this section](https://mastra.ai/en/docs/agents/adding-voice\#event-system)

The realtime voice provider emits several events you can listen for:

```nextra-code

// Listen for speech audio data sent from voice provider
agent.voice.on("speaking", ({ audio }) => {
  // audio contains ReadableStream or Int16Array audio data
});

// Listen for transcribed text sent from both voice provider and user
agent.voice.on("writing", ({ text, role }) => {
  console.log(`${role} said: ${text}`);
});

// Listen for errors
agent.voice.on("error", (error) => {
  console.error("Voice error:", error);
});
```

## Supported Voice Providers [Permalink for this section](https://mastra.ai/en/docs/agents/adding-voice\#supported-voice-providers)

Mastra supports multiple voice providers for text-to-speech (TTS) and speech-to-text (STT) capabilities:

| Provider | Package | Features | Reference |
| --- | --- | --- | --- |
| OpenAI | `@mastra/voice-openai` | TTS, STT | [Documentation](https://mastra.ai/reference/voice/openai) |
| OpenAI Realtime | `@mastra/voice-openai-realtime` | Realtime speech-to-speech | [Documentation](https://mastra.ai/reference/voice/openai-realtime) |
| ElevenLabs | `@mastra/voice-elevenlabs` | High-quality TTS | [Documentation](https://mastra.ai/reference/voice/elevenlabs) |
| PlayAI | `@mastra/voice-playai` | TTS | [Documentation](https://mastra.ai/reference/voice/playai) |
| Google | `@mastra/voice-google` | TTS, STT | [Documentation](https://mastra.ai/reference/voice/google) |
| Deepgram | `@mastra/voice-deepgram` | STT | [Documentation](https://mastra.ai/reference/voice/deepgram) |
| Murf | `@mastra/voice-murf` | TTS | [Documentation](https://mastra.ai/reference/voice/murf) |
| Speechify | `@mastra/voice-speechify` | TTS | [Documentation](https://mastra.ai/reference/voice/speechify) |
| Sarvam | `@mastra/voice-sarvam` | TTS, STT | [Documentation](https://mastra.ai/reference/voice/sarvam) |
| Azure | `@mastra/voice-azure` | TTS, STT | [Documentation](https://mastra.ai/reference/voice/mastra-voice) |
| Cloudflare | `@mastra/voice-cloudflare` | TTS | [Documentation](https://mastra.ai/reference/voice/mastra-voice) |

For more details on voice capabilities, see the [Voice API Reference](https://mastra.ai/reference/voice/mastra-voice).

[Networks](https://mastra.ai/en/docs/agents/networks "Networks") [Overviewnew](https://mastra.ai/en/docs/workflows/overview "Overview")