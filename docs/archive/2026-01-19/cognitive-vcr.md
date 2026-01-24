# Cognitive VCR Testing Architecture

The Cognitive VCR (Video Cassette Recorder) is a testing pattern that "freezes intelligence" to allow deterministic, fast, and cost-effective testing of AI agents while preserving behavioral validity.

## Core Concept

Testing AI agents involves two distinct layers:

1.  **Cognitive Layer (The Brain)**: The LLM's ability to reason, plan, and select tools.
2.  **Kinetic Layer (The Body)**: The system's ability to execute tools, parse outputs, and manage state.

Traditional testing either mocks the brain (making the test tautological) or hits the live API (making the test slow, expensive, and flaky). The VCR pattern solves this by recording the brain's output once and replaying it forever, while keeping the body live.

## Workflow

### 1. Record Mode (`VCR_MODE=record`)

- **Context**: Developer workstation, creating/updating a test.
- **Mechanism**:
  - Test runner connects to real LLM Provider (OpenAI/Anthropic).
  - Requests and Responses are captured.
  - Tool execution happens in a real Sandbox.
  - The full interaction trace is saved to a `.json` cassette.
- **Goal**: Prove that the _current_ prompt engineering + model can solve the task.

### 2. Replay Mode (`VCR_MODE=replay`)

- **Context**: CI/CD, regression testing.
- **Mechanism**:
  - Test runner intercepts LLM requests.
  - Matches request against stored cassette (using fuzzy matching on prompts).
  - Replays the stored LLM response (tool calls, reasoning) _instantly_.
  - **Crucial**: The Tool calls are NOT mocked. The system actually executes `docker exec` or `fs.writeFile`.
- **Goal**: Prove that the _system code_ (orchestrator, parsers, sandbox) still functions correctly given valid intelligence.

## Implementation Details

### Location

`packages/test-kit/src/cognitive/vcr.ts`

### Cassette Format

```json
{
  "id": "test-case-hash",
  "interactions": [
    {
      "input": { "messages": [...] },
      "output": { "text": "...", "toolCalls": [...] }
    }
  ]
}
```

### Usage

```typescript
// packages/test-kit/test/e2e/my-feature.test.ts
import { TestKit } from "@alfred/test-kit";

it("writes code", async () => {
  const kit = await TestKit.create({
    id: "write-code-v1",
    mode: process.env.CI ? "replay" : "record",
  });

  await kit.runtime.run("Write hello world to main.ts");

  // Assert against the REAL sandbox
  const content = await kit.sandbox.readFile("main.ts");
  expect(content).toContain("console.log");
});
```

## Benefits

1.  **Deterministic CI**: No flaky tests due to LLM temperature.
2.  **Speed**: 10s integration tests become 50ms unit tests.
3.  **Cost**: API costs incurred only during authoring, not every commit.
4.  **Validity**: Verifies that the code can handle _actual_ model outputs (hallucinations, weird formats), not just idealized mocks.
