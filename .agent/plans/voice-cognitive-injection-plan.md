# Voice Cognitive State Injection Plan

## Purpose
Enhance the voice assistant's relevance and adaptiveness by injecting the user's current "Cognitive State" (focus, activity, energy) into the generation context. This allows the assistant to respond differently when the user is in "Deep Work" vs "Casual" mode.

## Architecture
The `cognitive` package tracks user state. We will read this state in the `voice` package's assistant runner and append it to the system instructions.

## Implementation Steps

### 1. Access Cognitive State
- **Location:** `packages/api/src/voice/assistant.ts`
- **Action:** Import `cognitiveRepo` (or equivalent accessor) from `@alfred/db` or `@alfred/cognitive`.
- **Logic:** In `runAssistantForVoice`, fetch the active state for `input.userId`.

### 2. Format Context Prompt
- **Location:** `packages/api/src/voice/assistant.ts`
- **Action:** Create a helper function `formatCognitiveContext(state)`.
- **Output:** A string like:
  ```text
  [Current User Context]
  Focus: Deep Work
  Activity: Coding (VS Code)
  Energy: High
  Recommendation: Be concise, avoid distractions.
  ```

### 3. Inject into System Prompt
- **Location:** `packages/api/src/voice/assistant.ts`
- **Action:** Modify the `defaults.instructions` passed to `prepareModelMessagesForGenerate` or `generateText`.
- **Logic:** Append the formatted context string to the base system prompt.

### 4. Update Tests
- **Location:** `packages/api/test/voice.assistant.test.ts` (create if missing)
- **Action:** Verify that `runAssistantForVoice` fetches state and includes it in the prompt. Mock the cognitive repo.

## Verification
- **Manual:** Set user state to "Focus", use voice to ask "What should I do?", and verify the response references the focus state or adheres to the "concise" instruction.
- **Automated:** Unit test asserting the system prompt contains the context string.
