AI SDK RSCuseUIState

Copy markdown

# `useUIState`

AI SDK RSC is currently experimental. We recommend using AI SDK UI for production. For guidance on migrating from RSC to UI, see our migration guide.

It is a hook that enables you to read and update the UI State. The state is client-side and can contain functions, React nodes, and other data. UIState is the visual representation of the AI state.

## Import

    import { useUIState } from "@ai-sdk/rsc"

## API Signature

### Returns

Similar to useState, it is an array, where the first element is the current UI state and the second element is the function that updates the state.

## Examples

Learn to manage AI and UI states in Next.js

Previous

useActions

Next

useStreamableValue
