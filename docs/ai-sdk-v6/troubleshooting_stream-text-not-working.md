TroubleshootingstreamText fails silently

Copy markdown

# `streamText` is not working

## Issue

I am using `streamText` function, and it does not work. It does not throw any errors and the stream is only containing error parts.

## Background

`streamText` immediately starts streaming to enable sending data without waiting for the model. Errors become part of the stream and are not thrown to prevent e.g. servers from crashing.

## Solution

To log errors, you can provide an `onError` callback that is triggered when an error occurs.
    
    
    import { streamText } from 'ai';
    
    
    
    
    const result = streamText({
    
      model: 'openai/gpt-4.1',
    
      prompt: 'Invent a new holiday and describe its traditions.',
    
      onError({ error }) {
    
        console.error(error); // your error logging logic here
    
      },
    
    });

Previous

Abort breaks resumable streams

Next

Streaming Status Shows But No Text Appears