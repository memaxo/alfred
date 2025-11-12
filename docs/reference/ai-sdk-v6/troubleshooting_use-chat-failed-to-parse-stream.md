TroubleshootinguseChat Failed to Parse Stream

Copy markdown

# `useChat` "Failed to Parse Stream String" Error

## Issue

I am using `useChat` or `useCompletion`, and I am getting a `"Failed to parse stream string. Invalid code"` error. I am using version `3.0.20` or newer of the AI SDK.

## Background

The AI SDK has switched to the stream data protocol in version `3.0.20`. `useChat` and `useCompletion` expect stream parts that support data, tool calls, etc. What you see is a failure to parse the stream. This can be caused by using an older version of the AI SDK in the backend, by providing a text stream using a custom provider, or by using a raw LangChain stream result.

## Solution

You can switch `useChat` and `useCompletion` to raw text stream processing with the `streamProtocol` parameter. Set it to `text` as follows:
    
    
    const { messages, append } = useChat({ streamProtocol: 'text' });

Previous

Unclosed Streams

Next

Server Action Plain Objects Error