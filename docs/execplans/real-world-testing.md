# Real-World E2E Testing Plan for Adaptive Behavior

This plan outlines a script to verify the entire "Intelligence Loop" without mocks.

## The Loop
1.  **Input**: User provides a text (e.g., "I love using Bun for my servers").
2.  **Learning**:
    *   `extract()` runs (with `classifier`).
    *   Topics are detected (`['coding']`).
    *   Node is persisted to Graph.
3.  **Adaptation**:
    *   `assistant.generate` is called with a coding question.
    *   `adapter` analyzes context.
    *   System prompt is updated.
    *   Response reflects the persona.

## Implementation Strategy
We will create a standalone script `scripts/test-adaptive-behavior.ts` that:
1.  Initializes the DB connection.
2.  Directly calls the `extractor` to verify topic detection on real inputs.
3.  Directly calls the `adapter` to verify prompt generation.
4.  (Optional) Simulates a full `assistant.generate` call if an LLM provider is configured (otherwise we stop at the prompt generation step to avoid costs/errors).

## scenarios

### Scenario A: The Coder
- **Input**: "How do I optimize a React `useEffect` hook?"
- **Expected Topics**: `['coding']`
- **Expected Persona**: "Senior Software Engineer"

### Scenario B: The Hacker
- **Input**: "I found a CVE-2024-1234 in the firewall."
- **Expected Topics**: `['cybersecurity']`
- **Expected Persona**: "Cybersecurity Researcher"

### Scenario C: The Pundit
- **Input**: "The election results are controversial."
- **Expected Topics**: `['politics']`
- **Expected Persona**: "Political Analyst"
