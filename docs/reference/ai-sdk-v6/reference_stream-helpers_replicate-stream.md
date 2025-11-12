Stream HelpersReplicateStream

Copy markdown

# `ReplicateStream`

ReplicateStream has been removed in AI SDK 4.0.

ReplicateStream is part of the legacy Replicate integration. It is not compatible with the AI SDK 3.1 functions.

The ReplicateStream function is a utility that handles extracting the stream from the output of Replicate's API. It expects a Prediction object as returned by the Replicate JavaScript SDK, and returns a ReadableStream. Unlike other wrappers, ReplicateStream returns a Promise because it makes a fetch call to the Replicate streaming API under the hood.

## Import

### React
    
    
    import { ReplicateStream } from "ai"

## API Signature

### Parameters

### pre:

Prediction

Object returned by the Replicate JavaScript SDK.

### callbacks?:

AIStreamCallbacksAndOptions

An object containing callback functions to handle the start, each token, and completion of the AI response. In the absence of this parameter, default behavior is implemented.

AIStreamCallbacksAndOptions

### onStart:

() => Promise

An optional function that is called at the start of the stream processing.

### onCompletion:

(completion: string) => Promise

An optional function that is called for every completion. It's passed the completion as a string.

### onFinal:

(completion: string) => Promise

An optional function that is called once when the stream is closed with the final completion message.

### onToken:

(token: string) => Promise

An optional function that is called for each token in the stream. It's passed the token as a string.

### options:

{ headers?: Record }

An optional parameter for passing additional headers.

### Returns

A `ReadableStream` wrapped in a promise.

Previous

MistralStream

Next

InkeepStream