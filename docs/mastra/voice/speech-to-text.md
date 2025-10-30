---
title: Speech-to-Text (STT) in Mastra | Mastra Docs
url: 
description: Overview of Speech-to-Text capabilities in Mastra, including configuration, usage, and integration with voice providers.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/voice/speech-to-text#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Voice](https://mastra.ai/en/docs/voice/overview "Voice") Speech to Text

Copy page

# Speech-to-Text (STT)

Speech-to-Text (STT) in Mastra provides a standardized interface for converting audio input into text across multiple service providers.
STT helps create voice-enabled applications that can respond to human speech, enabling hands-free interaction, accessibility for users with disabilities, and more natural human-computer interfaces.

## Configuration [Permalink for this section](https://mastra.ai/en/docs/voice/speech-to-text\#configuration)

To use STT in Mastra, you need to provide a `listeningModel` when initializing the voice provider. This includes parameters such as:

- **`name`**: The specific STT model to use.
- **`apiKey`**: Your API key for authentication.
- **Provider-specific options**: Additional options that may be required or supported by the specific voice provider.

**Note**: All of these parameters are optional. You can use the default settings provided by the voice provider, which will depend on the specific provider you are using.

```nextra-code

const voice = new OpenAIVoice({
  listeningModel: {
    name: "whisper-1",
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// If using default settings the configuration can be simplified to:
const voice = new OpenAIVoice();
```

## Available Providers [Permalink for this section](https://mastra.ai/en/docs/voice/speech-to-text\#available-providers)

Mastra supports several Speech-to-Text providers, each with their own capabilities and strengths:

- [**OpenAI**](https://mastra.ai/reference/voice/openai) \- High-accuracy transcription with Whisper models
- [**Azure**](https://mastra.ai/reference/voice/azure) \- Microsoft’s speech recognition with enterprise-grade reliability
- [**ElevenLabs**](https://mastra.ai/reference/voice/elevenlabs) \- Advanced speech recognition with support for multiple languages
- [**Google**](https://mastra.ai/reference/voice/google) \- Google’s speech recognition with extensive language support
- [**Cloudflare**](https://mastra.ai/reference/voice/cloudflare) \- Edge-optimized speech recognition for low-latency applications
- [**Deepgram**](https://mastra.ai/reference/voice/deepgram) \- AI-powered speech recognition with high accuracy for various accents
- [**Sarvam**](https://mastra.ai/reference/voice/sarvam) \- Specialized in Indic languages and accents

Each provider is implemented as a separate package that you can install as needed:

```nextra-code

pnpm add @mastra/voice-openai  # Example for OpenAI
```

## Using the Listen Method [Permalink for this section](https://mastra.ai/en/docs/voice/speech-to-text\#using-the-listen-method)

The primary method for STT is the `listen()` method, which converts spoken audio into text. Here’s how to use it:

```nextra-code

import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { OpenAIVoice } from "@mastra/voice-openai";
import { getMicrophoneStream } from "@mastra/node-audio";

const voice = new OpenAIVoice();

const agent = new Agent({
  name: "Voice Agent",
  instructions:
    "You are a voice assistant that provides recommendations based on user input.",
  model: openai("gpt-4o"),
  voice,
});

const audioStream = getMicrophoneStream(); // Assume this function gets audio input

const transcript = await agent.voice.listen(audioStream, {
  filetype: "m4a", // Optional: specify the audio file type
});

console.log(`User said: ${transcript}`);

const { text } = await agent.generate(
  `Based on what the user said, provide them a recommendation: ${transcript}`,
);

console.log(`Recommendation: ${text}`);
```

Check out the [Adding Voice to Agents](https://mastra.ai/en/docs/agents/adding-voice) documentation to learn how to use STT in an agent.

[Text to Speech](https://mastra.ai/en/docs/voice/text-to-speech "Text to Speech") [Speech to Speechnew](https://mastra.ai/en/docs/voice/speech-to-speech "Speech to Speech")