AI SDK CorewrapLanguageModel

Copy markdown

# `wrapLanguageModel()`

The `wrapLanguageModel` function provides a way to enhance the behavior of language models by wrapping them with middleware. See Language Model Middleware for more information on middleware.
    
    
    import { wrapLanguageModel } from 'ai';
    
    
    
    
    const wrappedLanguageModel = wrapLanguageModel({
    
      model: 'openai/gpt-4.1',
    
      middleware: yourLanguageModelMiddleware,
    
    });

## Import
    
    
    import { wrapLanguageModel } from "ai"

## API Signature

### Parameters

### model:

LanguageModelV3

The original LanguageModelV3 instance to be wrapped.

### middleware:

LanguageModelV3Middleware | LanguageModelV3Middleware[]

The middleware to be applied to the language model. When multiple middlewares are provided, the first middleware will transform the input first, and the last middleware will be wrapped directly around the model.

### modelId:

string

Optional custom model ID to override the original model's ID.

### providerId:

string

Optional custom provider ID to override the original model's provider.

### Returns

A new `LanguageModelV3` instance with middleware applied.

Previous

cosineSimilarity

Next

LanguageModelV3Middleware