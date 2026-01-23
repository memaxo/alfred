# VCR Integration Testing

This document describes the VCR (Video Cassette Recorder) testing infrastructure for recording and replaying AI provider API calls, enabling deterministic integration tests without live API calls.

## Overview

The VCR system intercepts HTTP requests to AI providers (OpenAI, Anthropic, Google, Cohere), records the request/response pairs to JSON cassette files, and replays them during subsequent test runs. This provides:

- **Deterministic tests**: Same responses every time
- **Fast execution**: No network latency (10x faster)
- **No API costs**: Replay mode uses no API credits
- **Offline testing**: Tests work without internet
- **CI/CD friendly**: No secrets needed in replay mode

## Quick Start

```bash
# Record new AI responses (requires API keys)
VCR_RECORD=1 bun test packages/api/test/integration/openai-vcr.integration.test.ts

# Replay from cassette (default, no API calls)
bun test packages/api/test/integration/openai-vcr.integration.test.ts

# Validate all cassettes
bun run test:vcr:validate

# Run all integration tests
bun run test:integration:full
```

## Architecture

### Components

```
packages/test-kit/src/vcr/
├── types.ts      # Type definitions for cassettes and interactions
├── hash.ts       # Request hashing for deterministic matching
├── cassette.ts   # File I/O for cassette storage
├── recorder.ts   # Main VCR recorder with fetch interception
└── index.ts      # Module exports
```

### Supported Providers

| Provider | API Host | Status |
|----------|----------|--------|
| OpenAI | `api.openai.com` | ✅ Tested |
| Anthropic | `api.anthropic.com` | ✅ Supported |
| Google | `generativelanguage.googleapis.com` | ✅ Supported |
| Cohere | `api.cohere.ai` | ✅ Supported |

## Usage

### Basic Test Structure

```typescript
import { createVCR } from "@alfred/test-kit/vcr";
import path from "node:path";

const cassettePath = path.join(
  import.meta.dir,
  "__cassettes__",
  "my-test.json"
);

let vcr: Awaited<ReturnType<typeof createVCR>>;

beforeAll(async () => {
  vcr = createVCR({
    cassettePath,
    strictReplay: false, // Allow passthrough if no recording
  });
  await vcr.start();
});

afterAll(async () => {
  await vcr?.stop();
});

it("makes AI API call", async () => {
  // Your test that calls OpenAI/Anthropic/etc
  const result = await caller.assistant.generate({
    messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "Hello" }] }],
  });
  expect(result.text).toBeDefined();
});
```

### Using withVCR Helper

```typescript
import { withVCR } from "@alfred/test-kit/vcr";

it("uses withVCR helper", async () => {
  await withVCR({ cassettePath: "__cassettes__/test.json" }, async (vcr) => {
    // VCR is automatically started and stopped
    const result = await makeAICall();
    expect(result).toBeDefined();
  });
});
```

## VCR Modes

### Record Mode

```bash
VCR_RECORD=1 bun test my-test.ts
# or
VCR_MODE=record bun test my-test.ts
```

- Makes real API calls
- Saves request/response pairs to cassette
- Requires valid API keys
- Creates cassette file if missing

### Replay Mode (Default)

```bash
bun test my-test.ts
# or
VCR_MODE=replay bun test my-test.ts
```

- Intercepts API calls
- Returns recorded responses
- No API keys needed
- Fails if no matching recording (with `strictReplay: true`)

### Passthrough Mode

```bash
VCR_PASSTHROUGH=1 bun test my-test.ts
# or
VCR_MODE=passthrough bun test my-test.ts
```

- Makes real API calls
- Does not record
- Useful for debugging

## Cassette Format

```json
{
  "version": 2,
  "name": "path/to/cassette.json",
  "createdAt": "2025-12-05T02:25:10.732Z",
  "interactions": [
    {
      "id": "uuid",
      "timestamp": 1764901512819,
      "provider": "openai",
      "model": "gpt-4o-mini",
      "request": {
        "url": "https://api.openai.com/v1/chat/completions",
        "method": "POST",
        "headers": {
          "authorization": "[REDACTED]",
          "content-type": "application/json"
        },
        "body": { "model": "gpt-4o-mini", "messages": [...] }
      },
      "response": {
        "status": 200,
        "headers": { ... },
        "body": { "choices": [...] }
      },
      "requestHash": "abc123",
      "durationMs": 1500
    }
  ]
}
```

### Security

- **Authorization headers are automatically redacted** (`[REDACTED]`)
- API keys are never stored in cassettes
- Safe to commit cassettes to version control

## Request Matching

Requests are matched by hash computed from:

- URL path (host stripped)
- HTTP method
- Request body (with volatile fields excluded)
- Model name

### Excluded Fields

These fields are excluded from hash computation:

- `stream`, `stream_options` (streaming config)
- `seed` (randomization)
- `user` (user identifier)

### Custom Matchers

```typescript
import { fuzzyMatcher } from "@alfred/test-kit/vcr";

const vcr = createVCR({
  cassettePath,
  matcher: fuzzyMatcher, // Match only by message content
});
```

## Integration Tests

### Existing Test Files

| File | Description |
|------|-------------|
| `openai-vcr.integration.test.ts` | OpenAI API recording/replay |
| `workflow-pipeline.integration.test.ts` | Workflow streaming tests |
| `voice-pipeline.integration.test.ts` | Voice pipeline (local models) |
| `auth-flow.integration.test.ts` | Authentication flows |

### Test Commands

```bash
# All integration tests
bun run test:integration:full

# Record mode
bun run test:vcr:record

# Validate cassettes
bun run test:vcr:validate
```

## E2E Tests

Playwright E2E tests that don't require VCR:

| File | Tests |
|------|-------|
| `auth.e2e.spec.ts` | 15 authentication tests |
| `workflow-execution.e2e.spec.ts` | 10 workflow UI tests |
| `settings.e2e.spec.ts` | 12 settings/preferences tests |

```bash
# Run E2E tests
bunx playwright test --config apps/web/playwright.config.ts --project=e2e

# List available tests
bunx playwright test --list --config apps/web/playwright.config.ts
```

## CI/CD Integration

The CI pipeline includes:

1. **VCR Validation**: Ensures cassettes are valid JSON with proper structure
2. **Integration Tests**: Runs with cassette replay (no API keys needed)
3. **E2E Tests**: Browser-based tests with Playwright

```yaml
# .github/workflows/ci.yml
- name: Validate VCR cassettes
  run: bun run test:vcr:validate

- name: Full integration tests
  run: bun run test:integration:full
```

## Troubleshooting

### No Matching Recording

```
VCR: No matching recording found for openai request. Hash: abc123.
Run with VCR_RECORD=1 to record.
```

**Solution**: Run in record mode to capture the interaction:
```bash
VCR_RECORD=1 bun test my-test.ts
```

### API Key Issues in Record Mode

```
AI_APICallError: Incorrect API key provided: test
```

**Solution**: Ensure real API key is set and not overwritten:
```typescript
// Preserve key before test utils load
const REAL_KEY = process.env.OPENAI_API_KEY;
// ... after imports ...
process.env.OPENAI_API_KEY = REAL_KEY;
```

### Invalid Model ID

```
AI_APICallError: invalid model ID
```

**Solution**: Set correct model format:
```typescript
process.env.AI_MODEL = "gpt-4o-mini"; // Not "openai/gpt-4o-mini"
```

### Voice Pool Initialization

```
Voice pools not initialized. Call initializeVoicePools() first.
```

**Solution**: Voice tests require local models. Tests will auto-skip if unavailable:
```typescript
it.skipIf(!voicePoolsInitialized)("synthesizes speech", async () => {
  // Test body
});
```

## Best Practices

1. **One cassette per test file**: Keep cassettes focused and manageable
2. **Re-record periodically**: API responses may change
3. **Don't commit failed recordings**: Only commit cassettes with successful responses
4. **Use descriptive test names**: Helps identify which interaction failed
5. **Validate before commit**: Run `bun run test:vcr:validate`

## Related Documentation

- [Workflow Streaming Tests](./workflow-streaming.md)
- [Voice Runtime Fixture](./voice-runtime-fixture.md)
- [E2E Automation](./e2e-automation.md)
- [Cognitive VCR (Legacy)](./cognitive-vcr.md)
