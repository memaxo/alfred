TroubleshootinguseChat "An error occurred"

Copy markdown

# `useChat` "An error occurred"

## Issue

I am using `useChat` and I get the error "An error occurred".

## Background

Error messages from `streamText` are masked by default when using `toDataStreamResponse` for security reasons (secure-by-default). This prevents leaking sensitive information to the client.

## Solution

To forward error details to the client or to log errors, use the `getErrorMessage` function when calling `toDataStreamResponse`.
    
    
    export function errorHandler(error: unknown) {
    
      if (error == null) {
    
        return 'unknown error';
    
      }
    
    
    
    
      if (typeof error === 'string') {
    
        return error;
    
      }
    
    
    
    
      if (error instanceof Error) {
    
        return error.message;
    
      }
    
    
    
    
      return JSON.stringify(error);
    
    }
    
    
    const result = streamText({
    
      // ...
    
    });
    
    
    
    
    return result.toUIMessageStreamResponse({
    
      getErrorMessage: errorHandler,
    
    });

In case you are using `createDataStreamResponse`, you can use the `onError` function when calling `toDataStreamResponse`:
    
    
    const response = createDataStreamResponse({
    
      // ...
    
      async execute(dataStream) {
    
        // ...
    
      },
    
      onError: errorHandler,
    
    });

Previous

TypeScript performance issues with Zod and AI SDK 5

Next

Repeated assistant messages in useChat