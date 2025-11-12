TroubleshootingUnclosed Streams

Copy markdown

# Unclosed Streams

Sometimes streams are not closed properly, which can lead to unexpected behavior. The following are some common issues that can occur when streams are not closed properly.

## Issue

The streamable UI has been slow to update.

## Solution

This happens when you create a streamable UI using `createStreamableUI` and fail to close the stream. In order to fix this, you must ensure you close the stream by calling the `.done()` method. This will ensure the stream is closed.
    
    
    import { createStreamableUI } from '@ai-sdk/rsc';
    
    
    
    
    const submitMessage = async () => {
    
      'use server';
    
    
    
    
      const stream = createStreamableUI('1');
    
    
    
    
      stream.update('2');
    
      stream.append('3');
    
      stream.done('4'); // [!code ++]
    
    
    
    
      return stream.value;
    
    };

Previous

Getting Timeouts When Deploying on Vercel

Next

useChat Failed to Parse Stream