TroubleshootingStreaming Status Shows But No Text Appears

Copy markdown

# Streaming Status Shows But No Text Appears

## Issue

When using `useChat`, the status changes to "streaming" immediately, but no text appears for several seconds.

## Background

The status changes to "streaming" as soon as the connection to the server is established and streaming begins - this includes metadata streaming, not just the LLM's generated tokens.

## Solution

Create a custom loading state that checks if the last assistant message actually contains content:
    
    
    'use client';
    
    
    
    
    import { useChat } from '@ai-sdk/react';
    
    
    
    
    export default function Page() {
    
      const { messages, status } = useChat();
    
    
    
    
      const lastMessage = messages.at(-1);
    
    
    
    
      const showLoader =
    
        status === 'streaming' &&
    
        lastMessage?.role === 'assistant' &&
    
        lastMessage?.parts?.length === 0;
    
    
    
    
      return (
    
        <>
    
          {messages.map(message => (
    
            
    
              {message.role === 'user' ? 'User: ' : 'AI: '}
    
              {message.parts.map((part, index) =>
    
                part.type === 'text' ? {part.text} : null,
    
              )}
    
            
    
          ))}
    
    
    
    
          {showLoader && Loading...}
    
        
    
      );
    
    }

You can also check for specific part types if you're waiting for something specific:
    
    
    const showLoader =
    
      status === 'streaming' &&
    
      lastMessage?.role === 'assistant' &&
    
      !lastMessage?.parts?.some(part => part.type === 'text');

## Related Issues

  * GitHub Issue #7586

Previous

streamText fails silently

Next

Stale body values with useChat