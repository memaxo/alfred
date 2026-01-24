---
title: Tracing Images sent to LLM models with Laminar - Laminar documentation
url:
description: Automatic tracing of image data in LLM calls
language: en
---

[Skip to main content](https://docs.lmnr.ai/tracing/structure/image#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Tracing Structure

Tracing Images sent to LLM models with Laminar

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Automatic Image Data Capture](https://docs.lmnr.ai/tracing/structure/image#automatic-image-data-capture)
- [OpenAI example](https://docs.lmnr.ai/tracing/structure/image#openai-example)
- [Image URLs from External Sources](https://docs.lmnr.ai/tracing/structure/image#image-urls-from-external-sources)
- [Viewing Images in Laminar Platform](https://docs.lmnr.ai/tracing/structure/image#viewing-images-in-laminar-platform)
- [Start Tracing Images with these Integrations](https://docs.lmnr.ai/tracing/structure/image#start-tracing-images-with-these-integrations)

## [​](https://docs.lmnr.ai/tracing/structure/image#automatic-image-data-capture) Automatic Image Data Capture

Laminar automatically captures and stores image data sent to vision-capable LLM models across any SDK or framework you use. Whether you’re using OpenAI, Anthropic, Google, or any other provider’s SDK, Laminar seamlessly:

- **Automatically detects and saves** all image content in your LLM requests.
- **Saves both Base64 encoded images and URLs**.
- **Operates without interruption** to your main application flow or performance.

This happens transparently in the background - no code changes required.

## [​](https://docs.lmnr.ai/tracing/structure/image#openai-example) OpenAI example

Laminar automatically detects images when you send them using the standard OpenAI SDK patterns. No additional configuration is required - simply use images in your LLM calls as you normally would.

- JavaScript/TypeScript

- Python

Copy

```
import { OpenAI } from 'openai';
import { Laminar, observe } from '@lmnr-ai/lmnr';
import fs from 'fs';

// Initialize Laminar
Laminar.initialize({
  projectApiKey: process.env.LMNR_PROJECT_API_KEY,
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const analyzeImage = async (imagePath, userQuestion) =>
  await observe({ name: 'analyzeImage' }, async () => {
    // Encode image to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // Make LLM call with image - Laminar automatically traces the image data
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [\
        {\
          role: 'user',\
          content: [\
            {\
              type: 'text',\
              text: userQuestion\
            },\
            {\
              type: 'image_url',\
              image_url: {\
                url: `data:image/jpeg;base64,${base64Image}`\
              }\
            }\
          ]\
        }\
      ],
      max_tokens: 500
    });

    return response.choices[0].message.content;
  });

// Example usage
const result = await analyzeImage('eiffel_tower.jpg', 'What information is shown in this image?');
console.log(result);

```

## [​](https://docs.lmnr.ai/tracing/structure/image#image-urls-from-external-sources) Image URLs from External Sources

Laminar also traces images when you reference them by URL instead of uploading them directly:

- JavaScript/TypeScript

- Python

Copy

```
const analyzeWebImage = async (imageUrl, analysisPrompt) =>
  await observe({ name: 'analyzeWebImage' }, async () => {
    // Reference image by URL - Laminar traces the URL and metadata
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [\
        {\
          role: 'user',\
          content: [\
            {\
              type: 'text',\
              text: analysisPrompt\
            },\
            {\
              type: 'image_url',\
              image_url: {\
                url: imageUrl,\
                detail: 'high'  // Optional: control image resolution\
              }\
            }\
          ]\
        }\
      ]
    });

    return response.choices[0].message.content;
  });

// Example usage
const result = await analyzeWebImage(
  'https://example.com/product-image.jpg',
  'Describe this product and its key features.'
);

```

## [​](https://docs.lmnr.ai/tracing/structure/image#viewing-images-in-laminar-platform) Viewing Images in Laminar Platform

When you send images to LLM models, Laminar renders them in the trace view:

![Screenshot of image trace](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/trace-image.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=8cca99b8caab16b20cf957f328d0c639)

In the Laminar platform, you can:

- View the actual images that were sent to the model.
- Click on the image to view in the larger view.
- Correlate images with model responses for debugging.
- Track image usage across different traces and sessions.

## [​](https://docs.lmnr.ai/tracing/structure/image#start-tracing-images-with-these-integrations) Start Tracing Images with these Integrations

Get started with automatic image tracing using any of our supported integrations. No configuration required - just install and your images will be automatically captured:

| Integration                                                              | Description                                                       |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| [OpenAI](https://docs.lmnr.ai/tracing/integrations/openai)               | Trace images sent to GPT-4o, GPT-4-turbo, and other vision models |
| [Anthropic](https://docs.lmnr.ai/tracing/integrations/anthropic)         | Automatically trace images in Claude conversations                |
| [Gemini](https://docs.lmnr.ai/tracing/integrations/gemini)               | Capture images sent to Google’s Gemini Pro Vision models          |
| [LangChain](https://docs.lmnr.ai/tracing/integrations/langchain)         | Automatic image tracing for LangChain vision chains               |
| [Vercel AI SDK](https://docs.lmnr.ai/tracing/integrations/vercel-ai-sdk) | Trace images in Vercel AI SDK multimodal applications             |
| [LiteLLM](https://docs.lmnr.ai/tracing/integrations/litellm)             | Universal image tracing across 100+ LLM providers via LiteLLM     |
| [Browser Use](https://docs.lmnr.ai/tracing/integrations/browser-use)     | Trace images in Browser Use applications                          |
| [Stagehand](https://docs.lmnr.ai/tracing/integrations/stagehand)         | Trace images in Stagehand applications                            |

[Tags](https://docs.lmnr.ai/tracing/structure/tags) [Continuing Traces](https://docs.lmnr.ai/tracing/structure/continuing-traces)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Screenshot of image trace](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/images/traces/trace-image.png?w=840&fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=775f8f2dbb36585561ba60dd834aa17e)
