AI SDK RSCcreateAI

Copy markdown

# `createAI`

AI SDK RSC is currently experimental. We recommend using AI SDK UI for production. For guidance on migrating from RSC to UI, see our migration guide.

Creates a client-server context provider that can be used to wrap parts of your application tree to easily manage both UI and AI states of your application.

## Import
    
    
    import { createAI } from "@ai-sdk/rsc"

## API Signature

### Parameters

### actions:

Record

Server side actions that can be called from the client.

### initialAIState:

any

Initial AI state to be used in the client.

### initialUIState:

any

Initial UI state to be used in the client.

### onGetUIState:

() => UIState

is called during SSR to compare and update UI state.

### onSetAIState:

(Event) => void

is triggered whenever an update() or done() is called by the mutable AI state in your action, so you can safely store your AI state in the database.

Event

### state:

AIState

The resulting AI state after the update.

### done:

boolean

Whether the AI state updates have been finalized or not.

### Returns

It returns an `` context provider.

## Examples

Learn to manage AI and UI states in Next.js

Learn to persist and restore states UI/AI states in Next.js

Previous

streamUI

Next

createStreamableUI