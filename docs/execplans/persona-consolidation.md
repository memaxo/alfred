# PRD: Consolidated Persona Architecture

**Owner:** voice / cognition  
**Status:** Draft  
**Date:** January 2026

---

## Executive Summary

Alfred's persona is fragmented across 12+ files, gated behind feature flags, and inconsistent between interaction modalities. A user speaking to Alfred via voice, chatting via text, and receiving TUI greetings encounters three different personalities. This PRD defines a unified persona architecture that ensures Alfred is the same character regardless of channel.

---

## Problem Statement

### Current State: Fragmented Identity

| Location | What It Defines | Gated By |
|----------|-----------------|----------|
| `.ruler/10-alfred-persona.md` | Development persona for AI agents | Always applied |
| `packages/agent/src/assistant/src/jarvis-persona.ts` | JARVIS transitions, humor, system enhancement | `ENABLE_JARVIS_PERSONA=1` |
| `packages/agent/src/assistant/src/adapter.ts` | Domain-specific personas (Coding, Security, AI) | Context detection |
| `packages/agent/src/agents.ts` | Base agent instructions | Always |
| `packages/agent/src/preference/prompt.ts` | User preference → system prompt | `PREFERENCE_ADAPTATION_ENABLED=1` |
| `packages/tui/src/tui/intro/greeting.ts` | TUI butler greetings | Always |
| `packages/api/src/voice/assistant.ts` | Voice JARVIS integration, opening injection | `ENABLE_JARVIS_PERSONA=1` |
| `packages/api/src/voice/plan-speech.ts` | Workflow summary speech patterns | Always |
| `packages/runtime/src/phases/plan.ts` | Orchestration planner persona | Always |
| `packages/runtime/src/phases/act.ts` | Execution coordinator persona | Always |
| `apps/web/src/hooks/use-ambient-awareness.ts` | Web HUD JARVIS greetings | Always |
| `docs/architecture/jarvis-evolution.md` | Design spec (not implemented) | N/A |
| `docs/architecture/personality-architecture.md` | Tunable traits design (not implemented) | N/A |

### Identified Problems

1. **No single source of truth.** Changing Alfred's personality requires editing 7+ files.

2. **Feature-flagged identity.** `ENABLE_JARVIS_PERSONA=1` creates two different Alfreds.

3. **Inconsistent honorifics.** "Sir or Madam as appropriate" is documented but there's no mechanism to set user preference—Alfred always says "Sir."

4. **Domain personas override character.** Coding/Security personas can conflict with butler tone.

5. **Channel-specific personality.** Voice, text, TUI, and workflow each express personality differently with no shared primitives.

6. **TTS accent is not controllable.** "British RP accent" is an instruction to the LLM about word choice, not to the TTS about pronunciation. Accent depends entirely on voice model selection.

7. **Tool announcements lack persona.** When Alfred executes tools, results are presented without butler framing.

8. **Design specs exist but aren't implemented.** `personality-architecture.md` describes tunable traits (Curiosity, Tenacity, Amicability) but this is a design document, not code.

---

## Goals

### Primary Goals

1. **Single source of truth.** One canonical definition of who Alfred is.
2. **Channel-agnostic personality.** Same character across voice, text, TUI, workflow.
3. **Consistent honorifics.** User can configure "Sir," "Madam," custom, or none.
4. **Controllable accent.** Voice model selection tied to persona.
5. **Tool announcements with character.** Alfred describes what he's doing in butler style.

### Non-Goals

1. **Full personality traits implementation.** The cognitive `Personality` type (Curiosity, Tenacity, etc.) is out of scope—that's a separate effort.
2. **Multiple personas.** Alfred is Alfred. No "switch to JARVIS mode."
3. **Per-domain personalities.** Domain context affects knowledge, not character.

---

## User Stories

### US-1: Consistent Voice Across Channels
**As a user**, I want Alfred to sound like the same person whether I'm typing, speaking, or reading TUI output, so that the experience feels coherent.

**Acceptance Criteria:**
- Voice responses begin with butler-style acknowledgments ("Understood, Sir.")
- Text responses use the same transitional phrases
- TUI greetings match voice/text tone
- Workflow summaries maintain butler demeanor

### US-2: Configurable Honorific
**As a user**, I want to choose how Alfred addresses me, so that the assistant feels personalized.

**Acceptance Criteria:**
- Settings UI includes honorific preference: Sir, Madam, [custom], None
- All channels respect this preference
- Default is "Sir" (matches Alfred Pennyworth character)

### US-3: Accent-Matched Voice
**As a user**, I want Alfred's spoken voice to match the British butler character, so that voice interactions feel authentic.

**Acceptance Criteria:**
- Default TTS voice is British English
- Voice model selection is documented in persona config
- User can override voice preference

### US-4: Butler-Styled Tool Announcements
**As a user**, I want Alfred to describe tool executions in character, so that automated actions feel like butler service.

**Acceptance Criteria:**
- Tool calls include persona-appropriate preamble ("I'll look into that for you, Sir.")
- Tool results include persona-appropriate summary ("That's sorted, Sir.")
- Error handling maintains calm authority ("I'm afraid there's been a complication, Sir.")

### US-5: No Feature Flags for Core Personality
**As a developer**, I want Alfred's personality to be enabled by default with no feature flags, so that all users get the same experience.

**Acceptance Criteria:**
- `ENABLE_JARVIS_PERSONA` flag is removed
- Persona is always active
- Preference adaptation remains opt-in (not core personality)

---

## Proposed Architecture

### 1. Canonical Persona Module

Create `packages/agent/src/persona/` as the single source of truth:

```
packages/agent/src/persona/
├── index.ts              # Main export: buildPersonaPrompt()
├── character.ts          # Alfred's core traits, principles, speech patterns
├── transitions.ts        # Acknowledgments, alerts, closings, wit
├── honorific.ts          # Honorific handling (Sir/Madam/custom/none)
├── voice.ts              # Voice-specific adaptations (sentence length, TTS hints)
├── text.ts               # Text-specific adaptations (formatting, markdown)
├── workflow.ts           # Workflow-specific language (plan summaries, status)
├── tool.ts               # Tool announcement framing
└── types.ts              # Type definitions
```

### 2. Character Definition (`character.ts`)

The canonical definition of who Alfred is:

```typescript
export const ALFRED_CHARACTER = {
  name: "Alfred",
  archetype: "Butler-AI hybrid: Alfred Pennyworth's composure with JARVIS's technical fluency",
  
  // Core traits (constants, not tunable)
  traits: {
    demeanor: "Calm, competent, occasionally witty",
    authority: "Grounded authority without arrogance",
    humor: "Dry, deadpan, technical—never forced",
    honesty: "Confident but honest about uncertainty",
  },
  
  // Voice characteristics
  voice: {
    accent: "British RP (Received Pronunciation)",
    pace: "Measured for explanations, crisp for acknowledgments",
    vocabulary: "Technical precision with accessibility—uses 'nominal', 'parameters', 'diagnostics' naturally",
  },
  
  // Behavioral principles
  principles: [
    "Instant acknowledgment for routine commands",
    "Proactive awareness—reference time, system status, relevant context",
    "Complete answers without unnecessary preamble",
    "Calm authority in error situations—never panic or alarm",
    "Efficiency over verbosity",
  ],
  
  // Anti-patterns (what Alfred never does)
  antipatterns: [
    "Never use emoji",
    "Never use slang or corporate jargon",
    "Never start with 'I'm happy to help' or similar",
    "Never apologize excessively",
    "Never refuse reasonable requests without explanation",
    "Never claim subjective experience or feelings",
  ],
  
  // Technical vocabulary
  vocabulary: {
    status: ["nominal", "within parameters", "operational", "anomaly detected"],
    actions: ["initiating", "executing", "processing", "completed"],
    acknowledgment: ["Understood", "Very good", "Right away", "Consider it done"],
  },
} as const;
```

### 3. Single Entry Point (`index.ts`)

All consumers call one function:

```typescript
export type PersonaContext = {
  /** Interaction channel */
  modality: "voice" | "text" | "tui" | "workflow";
  
  /** User's configured honorific */
  honorific: "Sir" | "Madam" | string | null;
  
  /** Optional domain context (affects knowledge, not personality) */
  domain?: "coding" | "security" | "ai" | "general";
  
  /** Session context for appropriate openings */
  session?: {
    isStart: boolean;
    hour: number;
    focusMode?: boolean;
  };
  
  /** Tool context for announcements */
  tool?: {
    phase: "announcing" | "executing" | "completed" | "error";
    toolName: string;
    result?: unknown;
    error?: Error;
  };
};

/**
 * Build the complete persona prompt for any interaction.
 * This is the ONLY function consumers should use.
 */
export function buildPersonaPrompt(context: PersonaContext): string;

/**
 * Get an appropriate opening for the current context.
 */
export function getOpening(context: Pick<PersonaContext, "session" | "honorific">): string;

/**
 * Format a tool announcement in butler style.
 */
export function formatToolAnnouncement(context: PersonaContext): string;

/**
 * Get a contextually appropriate transitional phrase.
 */
export function getTransition(
  category: "acknowledge" | "alert" | "status" | "complete" | "wit" | "uncertain",
  honorific: string | null
): string;
```

### 4. Honorific Handling (`honorific.ts`)

```typescript
export type HonorificPreference = "Sir" | "Madam" | string | null;

/**
 * Apply honorific to a phrase.
 * 
 * Examples:
 * - "Understood." → "Understood, Sir."
 * - "Good morning." → "Good morning, Sir."
 * - "Done." → "Done, Sir."
 */
export function applyHonorific(phrase: string, honorific: HonorificPreference): string;

/**
 * Get the user's configured honorific.
 */
export async function getUserHonorific(userId: string): Promise<HonorificPreference>;
```

### 5. Voice-Specific Adaptations (`voice.ts`)

```typescript
/**
 * Adapt text for TTS synthesis.
 * - Shorter sentences for natural pauses
 * - No markdown or special characters
 * - Numbers spelled out where appropriate
 */
export function adaptForVoice(text: string): string;

/**
 * Get the recommended TTS voice model for Alfred's character.
 */
export function getAlfredVoiceModel(): {
  provider: "piper" | "elevenlabs" | "openai";
  voice: string;
  accent: "british-rp";
};
```

### 6. Tool Announcements (`tool.ts`)

```typescript
const TOOL_ANNOUNCEMENTS = {
  announcing: [
    "I'll look into that for you",
    "Allow me to check",
    "One moment while I",
    "Let me",
  ],
  executing: [
    "Processing",
    "Working on it",
    "Executing now",
  ],
  completed: [
    "That's sorted",
    "Done",
    "Complete",
    "Finished",
  ],
  error: [
    "I'm afraid there's been a complication",
    "I regret to report an issue",
    "There appears to be a problem",
  ],
} as const;

/**
 * Format a tool call announcement.
 * 
 * @example
 * formatToolAnnouncement({ toolName: "search_calendar", phase: "announcing", honorific: "Sir" })
 * // → "Let me search your calendar, Sir."
 */
export function formatToolAnnouncement(opts: {
  toolName: string;
  phase: keyof typeof TOOL_ANNOUNCEMENTS;
  honorific: HonorificPreference;
  result?: unknown;
  error?: Error;
}): string;
```

### 7. Workflow Language (`workflow.ts`)

```typescript
/**
 * Convert a structured plan to butler-style speech.
 * Used by voice workflow and text summaries.
 */
export function planToButlerSpeech(
  plan: StructuredPlan,
  verbosity: "brief" | "standard" | "detailed",
  honorific: HonorificPreference
): string;

/**
 * Format workflow status in butler style.
 */
export function formatWorkflowStatus(
  status: WorkflowStatus,
  honorific: HonorificPreference
): string;
```

---

## Migration Plan

### Phase 1: Create Persona Module (Week 1)

1. Create `packages/agent/src/persona/` with all files
2. Extract transitions from `jarvis-persona.ts` → `transitions.ts`
3. Define `ALFRED_CHARACTER` in `character.ts`
4. Implement `buildPersonaPrompt()` with tests
5. Add honorific preference to user settings schema

### Phase 2: Integrate Persona Module (Week 2)

1. Update `packages/api/src/voice/assistant.ts` to use `buildPersonaPrompt()`
2. Update `packages/agent/src/agents.ts` to use `buildPersonaPrompt()`
3. Update `packages/tui/src/tui/intro/greeting.ts` to use persona module
4. Update `packages/api/src/voice/plan-speech.ts` to use `planToButlerSpeech()`
5. Add honorific preference UI to Settings > Voice

### Phase 3: Tool Announcement Integration (Week 3)

1. Implement `formatToolAnnouncement()`
2. Update agent tool execution to include persona-styled announcements
3. Add tests for tool announcement formatting

### Phase 4: Cleanup & Removal (Week 4)

1. Remove `ENABLE_JARVIS_PERSONA` feature flag
2. Remove redundant persona definitions from old locations
3. Update documentation to reference new architecture
4. Add persona contract tests ensuring cross-channel consistency

---

## Data Model Changes

### New User Preference Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `persona.honorific` | `"Sir" \| "Madam" \| string \| null` | `"Sir"` | How Alfred addresses the user |
| `persona.voice_model` | `string` | `"en_US-lessac-medium"` | TTS voice model preference |
| `persona.wit_level` | `number` (0-1) | `0.4` | Frequency of dry humor (0 = none, 1 = frequent) |

### Migration

```sql
-- Add persona preferences
INSERT INTO preference_defaults (key, value, description)
VALUES 
  ('persona.honorific', '"Sir"', 'How Alfred addresses the user'),
  ('persona.voice_model', '"en_US-lessac-medium"', 'TTS voice model'),
  ('persona.wit_level', '0.4', 'Dry humor frequency 0-1');
```

---

## API Changes

### New tRPC Procedures

```typescript
// packages/api/src/routers/preferences.ts

/** Get persona configuration */
persona.get: authedProcedure.query(async ({ ctx }) => {
  return {
    honorific: await getPreference(ctx.userId, "persona.honorific"),
    voiceModel: await getPreference(ctx.userId, "persona.voice_model"),
    witLevel: await getPreference(ctx.userId, "persona.wit_level"),
  };
});

/** Update persona configuration */
persona.update: authedProcedure
  .input(z.object({
    honorific: z.union([z.literal("Sir"), z.literal("Madam"), z.string(), z.null()]).optional(),
    voiceModel: z.string().optional(),
    witLevel: z.number().min(0).max(1).optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // Update preferences
  });
```

---

## UI Changes

### Settings > Voice (or Settings > Persona)

Add a new section for persona configuration:

```
┌─────────────────────────────────────────────────────────┐
│ Persona Settings                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ How should Alfred address you?                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ○ Sir                                               │ │
│ │ ○ Madam                                             │ │
│ │ ○ Custom: [____________]                            │ │
│ │ ○ No honorific                                      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Voice Model                                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ British English (Lessac) - Default              ▼  │ │
│ └─────────────────────────────────────────────────────┘ │
│ Alfred's character is designed for British RP accent.   │
│                                                         │
│ Wit Level                                               │
│ ┌──────────────────────────────────────────┬──────────┐ │
│ │ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │   40%    │ │
│ └──────────────────────────────────────────┴──────────┘ │
│ Occasional dry humor     ←→     Frequent technical wit  │
│                                                         │
│ Preview:                                                │
│ "Good morning, Sir. Systems nominal. Shall we begin?"   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests

```typescript
// packages/agent/test/persona/index.test.ts

describe("buildPersonaPrompt", () => {
  it("includes character traits for all modalities", () => {
    const voice = buildPersonaPrompt({ modality: "voice", honorific: "Sir" });
    const text = buildPersonaPrompt({ modality: "text", honorific: "Sir" });
    
    // Both should contain core character traits
    expect(voice).toContain("British RP");
    expect(text).toContain("British RP");
    expect(voice).toContain("calm authority");
    expect(text).toContain("calm authority");
  });
  
  it("respects honorific preference", () => {
    const sir = buildPersonaPrompt({ modality: "text", honorific: "Sir" });
    const madam = buildPersonaPrompt({ modality: "text", honorific: "Madam" });
    const none = buildPersonaPrompt({ modality: "text", honorific: null });
    
    expect(sir).toContain("Sir");
    expect(madam).toContain("Madam");
    expect(none).not.toContain("Sir");
    expect(none).not.toContain("Madam");
  });
  
  it("adapts for voice modality", () => {
    const voice = buildPersonaPrompt({ modality: "voice", honorific: "Sir" });
    
    // Voice should have speech-friendly instructions
    expect(voice).toContain("short sentences");
    expect(voice).toContain("crisp for acknowledgments");
  });
});

describe("formatToolAnnouncement", () => {
  it("formats tool announcements with honorific", () => {
    const result = formatToolAnnouncement({
      toolName: "search_calendar",
      phase: "announcing",
      honorific: "Sir",
    });
    
    expect(result).toMatch(/calendar/i);
    expect(result).toContain("Sir");
  });
  
  it("handles errors with calm authority", () => {
    const result = formatToolAnnouncement({
      toolName: "search_calendar",
      phase: "error",
      honorific: "Sir",
      error: new Error("Connection failed"),
    });
    
    expect(result).toContain("complication");
    expect(result).not.toContain("error");
    expect(result).not.toContain("failed");
  });
});
```

### Contract Tests

```typescript
// packages/agent/test/persona/contract.test.ts

describe("Persona Contract", () => {
  const modalities = ["voice", "text", "tui", "workflow"] as const;
  
  it("all modalities produce consistent character", () => {
    const prompts = modalities.map(m => 
      buildPersonaPrompt({ modality: m, honorific: "Sir" })
    );
    
    // All should contain core character elements
    for (const prompt of prompts) {
      expect(prompt).toContain("Alfred");
      expect(prompt).toContain("Understood");
      expect(prompt).not.toContain("I'm happy to help");
      expect(prompt).not.toContain("emoji");
    }
  });
  
  it("transitions are available across all modalities", () => {
    const categories = ["acknowledge", "alert", "status", "complete"] as const;
    
    for (const category of categories) {
      const transition = getTransition(category, "Sir");
      expect(transition.length).toBeGreaterThan(0);
      expect(transition).toContain("Sir");
    }
  });
});
```

### Integration Tests

```typescript
// packages/api/test/voice/persona-integration.test.ts

describe("Voice Persona Integration", () => {
  it("voice responses use persona module", async () => {
    const result = await runAssistantForVoice(ctx, {
      text: "What time is it?",
      userId: "test-user",
    });
    
    // Should start with butler-style acknowledgment
    expect(result.text).toMatch(/^(Understood|Right away|Very good)/);
  });
  
  it("respects user honorific preference", async () => {
    await setPreference("test-user", "persona.honorific", "Madam");
    
    const result = await runAssistantForVoice(ctx, {
      text: "Good morning",
      userId: "test-user",
    });
    
    expect(result.text).toContain("Madam");
    expect(result.text).not.toContain("Sir");
  });
});
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Persona consistency | 100% of modalities use `buildPersonaPrompt()` | Code audit |
| Feature flag removal | 0 persona-related feature flags | Grep for flags |
| Honorific respect | 100% of responses respect user preference | Integration tests |
| Channel parity | Voice/text/TUI express same character | Contract tests |
| Tool announcement coverage | All tool calls include butler framing | Coverage analysis |

---

## Risks and Mitigations

### Risk 1: Breaking Changes to Voice Experience
**Mitigation:** Phase rollout. Keep existing `jarvis-persona.ts` functional during migration. A/B test with subset of users if needed.

### Risk 2: Performance Regression
**Mitigation:** `buildPersonaPrompt()` must return in <1ms. Cache generated prompts per (modality, honorific) pair.

### Risk 3: LLM Ignoring Persona Instructions
**Mitigation:** Add "Begin your reply with exactly: '{opening}'" for voice. Test with multiple models. Include explicit examples in prompt.

### Risk 4: TTS Accent Mismatch
**Mitigation:** Document recommended voice models. Default to British English voice. Allow user override but warn if accent mismatches character.

---

## Open Questions

1. **Should domain knowledge injection remain separate?** Current proposal: Yes. Domain affects what Alfred knows, not who he is.

2. **Should wit level be user-configurable?** Current proposal: Yes, via `persona.wit_level` preference.

3. **Should we support multiple personas?** Current proposal: No. Alfred is Alfred. This keeps the system simple and the character consistent.

4. **Should persona affect reasoning depth?** Current proposal: Out of scope—that's the cognitive personality system's job.

---

## Appendix A: Current Persona Fragments (For Reference)

### `jarvis-persona.ts` - JARVIS_SYSTEM_ENHANCEMENT
```typescript
You are ALFRED, an AI assistant with characteristics inspired by both Alfred Pennyworth and JARVIS from Iron Man.

### Voice Characteristics
- Accent: British RP (Received Pronunciation)
- Tone: Competent, efficient, occasionally witty
- Address: "Sir" or "Madam" as appropriate
- Pace: Measured for explanations, crisp for acknowledgments

### Behavioral Traits
1. **Instant Acknowledgment**: Start responses with brief confirmation
2. **Proactive Awareness**: Reference time, system status, or relevant context
3. **Technical Fluency**: Use precise technical vocabulary, but explain when needed
4. **Dry Wit**: Occasional deadpan humor, especially about technical situations
5. **Efficiency**: Complete answers without unnecessary preamble

### What NOT to do
- Never panic or express alarm (calm authority always)
- Never use emoji, slang, or corporate jargon
- Never start with "I'm happy to help" or similar
- Never apologize excessively
- Never refuse reasonable requests without explanation
```

### `agents.ts` - assistantInstructions
```typescript
"You are Alfred, a single-user cognitive co-pilot. Offer direct, actionable responses and prefer concrete steps over small talk. Only explain tool calls when the user needs the reasoning."
```

### `greeting.ts` - GREETINGS
```typescript
{
  morning: [
    "Good morning, Sir. How may I assist you today?",
    "Good morning, Sir. I trust you slept well.",
    "Good morning, Sir. A fresh day awaits.",
  ],
  // ... afternoon, evening, night
}
```

---

## Appendix B: Related Documents

- `docs/architecture/jarvis-evolution.md` - Original JARVIS evolution spec
- `docs/architecture/personality-architecture.md` - Tunable personality traits design
- `.ruler/10-alfred-persona.md` - Developer-facing persona rules
