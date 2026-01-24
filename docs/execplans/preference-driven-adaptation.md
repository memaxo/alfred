# Preference-Driven Adaptation

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

## Purpose / Big Picture

We will implement **Dynamic Persona Adaptation** for ALFRED. The goal is to make the assistant automatically adjust its tone, style, and priorities based on the **Domain Topics** detected in the conversation context (e.g., Coding, Cybersecurity, News).

If the user is discussing "Cybersecurity", ALFRED should adopt a rigorous, security-first persona. If "Coding", it should be concise and code-heavy. This closes the loop from "Background Learning" to "Active Assistance."

## Progress

- [x] **Context Analysis Logic**
  - [x] Create `packages/agent/src/assistant/src/adapter.ts`.
  - [x] Implement `analyzeContext(messages, retrieval)` to extract dominant topics (uses `linkEntities`).
  - [x] Define `Persona` templates for each domain (Coding, Security, AI, Politics, News).
- [x] **Router Integration**
  - [x] Update `packages/api/src/routers/assistant.ts` (lines 118-123).
  - [x] Inject the adapted system prompt _before_ generating the response.
- [ ] **Testing**
  - [ ] Create `packages/api/test/assistant.adapter.test.ts`.
  - [ ] Verify that a coding-heavy context triggers the Coding persona.

## Surprises & Discoveries

- Implementation uses graph topology for domain detection (`linkEntities` from `entity-linker.ts`).
- Entity linking uses both NLP extraction and manual capitalized word detection for better recall.
- Domain detection works with both message content and tool names.
- Persona instructions are merged when multiple domains are detected.

## Decision Log

- **Mechanism**: We will use "System Prompt Injection". We won't fine-tune models. We will prepend a "Persona Instruction" block to the LLM's system message based on the detected topics. This is fast, deterministic, and reversible.

## Outcomes & Retrospective

**Status**: ✅ Complete (except testing)

- All core functionality implemented and integrated into assistant router.
- Domain detection uses graph topology (entity → Anchor Concepts).
- Persona instructions successfully injected into system prompts.
- Works seamlessly with RAG context retrieval.
- Testing coverage pending (unit tests for adapter logic).

## Context and Orientation

- **Extractor**: We already have `extract()` which returns topics.
- **Classifier**: We have `VectorClassifier` for semantic matching.
- **Router**: `assistantRouter` handles chat generation.

## Plan of Work

### 1. Define Personas

In `adapter.ts`:

```typescript
const PERSONAS = {
  coding:
    "You are a Senior Software Engineer. Prefer terse, efficient code. Use TypeScript/Bun patterns.",
  cybersecurity:
    "You are a Security Researcher. Prioritize safety. Validate all inputs. Assume adversarial context.",
  // ...
};
```

### 2. Implement Analyzer

Using `detectDomains` and `classifier`, scan the last 3 user messages + retrieved RAG chunks to find the "weighted dominant topic".

### 3. Integrate

In `assistant.generate`:

```typescript
const topics = await analyzeContext(messages);
const persona = getPersona(topics);
const finalSystem = `${baseSystem}\n\n${persona}`;
```

## Concrete Steps

1.  Create `adapter.ts`.
2.  Update `assistant.ts` router.
3.  Add unit tests.
