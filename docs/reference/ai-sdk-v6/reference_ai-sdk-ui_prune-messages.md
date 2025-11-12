AI SDK UIpruneMessages

Copy markdown

# `pruneMessages()`

The `pruneMessages` function is used to prune or filter an array of `ModelMessage` objects. This is useful for reducing message context (to save tokens), removing intermediate reasoning, or trimming tool calls and empty messages before sending to an LLM.

app/api/chat/route.ts
    
    
    import { pruneMessages, streamText } from 'ai';
    
    
    
    
    export async function POST(req: Request) {
    
      const { messages } = await req.json();
    
    
    
    
      const prunedMessages = pruneMessages({
    
        messages,
    
        reasoning: 'before-last-message',
    
        toolCalls: 'before-last-2-messages',
    
        emptyMessages: 'remove',
    
      });
    
    
    
    
      const result = streamText({
    
        model: 'openai/gpt-4o',
    
        messages: prunedMessages,
    
      });
    
    
    
    
      return result.toUIMessageStreamResponse();
    
    }

## Import
    
    
    import { pruneMessages } from "ai"

## API Signature

### Parameters

### messages:

ModelMessage[]

An array of ModelMessage objects to prune.

### reasoning:

'all' | 'before-last-message' | 'none'

How to remove reasoning content from assistant messages. Default: "none".

### toolCalls:

'all' | 'before-last-message' | 'before-last-${number}-messages' | 'none' | PruneToolCallsOption[]

How to prune tool call/results/approval content. Can specify strategy or a list with tools.

### emptyMessages:

'keep' | 'remove'

Whether to keep or remove messages whose content is empty after pruning. Default: "remove".

### Returns

An array of `ModelMessage` objects, pruned according to the provided options.

### ModelMessage[]:

Array

The pruned list of ModelMessage objects

## Example Usage
    
    
    import { pruneMessages } from 'ai';
    
    
    
    
    const pruned = pruneMessages({
    
      messages,
    
      reasoning: 'all', // Remove all reasoning parts
    
      toolCalls: 'before-last-message', // Remove tool calls except those in the last message
    
    });

## Pruning Options

  * **reasoning:** Removes reasoning parts from assistant messages. Use `'all'` to remove all, `'before-last-message'` to keep reasoning in the last message, or `'none'` to retain all reasoning.
  * **toolCalls:** Prune tool-call, tool-result, and tool-approval chunks from assistant/tool messages. Options include:
    * `'all'`: Prune all such content.
    * `'before-last-message'`: Prune except in the last message.
    * `before-last-N-messages`: Prune except in the last N messages.
    * `'none'`: Do not prune.
    * Or provide an array for per-tool fine control.
  * **emptyMessages:** Set to `'remove'` (default) to exclude messages that have no content after pruning.

> **Tip** : `pruneMessages` is typically used prior to sending a context window to an LLM to reduce message/token count, especially after a series of tool-calls and approvals.

For advanced usage and the full list of possible message parts, see `ModelMessage` and `pruneMessages` implementation.

Previous

convertToModelMessages

Next

createUIMessageStream