# System Design Checklist

Use this checklist before implementing any system expected to exceed 500 lines or 3 files. Copy this template and fill it out as part of your design process.

---

## System: [Name]

### 1. Responsibility Contract

**Single-sentence responsibility:**

> This system [does what] for [whom] by [how].

**What this system does NOT do:**

- [ ] List boundaries explicitly
- [ ] What adjacent concerns are out of scope?
- [ ] What will callers handle themselves?

**Dependencies (what flows IN):**
| Input | Type | Source |
|-------|------|--------|
| | | |

**Outputs (what flows OUT):**
| Output | Type | Destination |
|--------|------|-------------|
| | | |

---

### 2. Extension Model

**How will new behavior be added?**

- [ ] **Observer pattern** - External code subscribes to events
- [ ] **Middleware pattern** - External code wraps/intercepts processing
- [ ] **Plugin pattern** - External code registers implementations
- [ ] **Configuration** - Behavior changes via config, not code
- [ ] **Composition** - External code composes with this system

**Extension points:**
| Point | Purpose | Interface |
|-------|---------|-----------|
| | | |

**What requires modifying core code?**

- [ ] Nothing (ideal)
- [ ] List exceptions with justification

---

### 3. State Management

**State container:**

- [ ] **Explicit context object** - `Context.get/set()`
- [ ] **State machine** - Defined states and transitions
- [ ] **External store** - Database, cache, etc.
- [ ] **Stateless** - No state between calls

**State shape:**

```typescript
interface SystemState {
  // Define all state explicitly
}
```

**State transitions:**
| From | Event | To | Side Effects |
|------|-------|-----|--------------|
| | | | |

**Observability:**

- [ ] State changes emit events
- [ ] State can be serialized for debugging
- [ ] State can be reconstructed from events (event sourcing)

---

### 4. File Structure

**Planned structure:**

```
package/
├── index.ts          - Public exports
├── types.ts          - Type definitions
├── [core].ts         - Main implementation
├── [concern]/        - Subdirectory per major concern
│   ├── index.ts
│   └── ...
└── __tests__/
```

**Each file's responsibility:**
| File | Single-Sentence Responsibility |
|------|-------------------------------|
| | |

**Directory purpose:**
| Directory | Contains |
|-----------|----------|
| | |

---

### 5. Communication Patterns

**Internal communication:**

- [ ] Function calls with explicit parameters
- [ ] Events via context/emitter
- [ ] Shared state (justify if used)

**External communication:**

- [ ] Return values
- [ ] Events/callbacks
- [ ] Side effects (list explicitly)

**Error handling:**

- [ ] Errors thrown to caller
- [ ] Errors emitted as events
- [ ] Errors logged and swallowed (justify)

---

### 6. Testing Strategy

**Unit testing:**

- [ ] Each module testable in isolation
- [ ] Mocks required: [list, should be < 5]
- [ ] State injectable for testing

**Integration testing:**

- [ ] Key integration points identified
- [ ] Test fixtures/factories planned

**What makes this system hard to test?**

- [ ] Nothing (ideal)
- [ ] List concerns and mitigations

---

### 7. Review Triggers

**This system needs architectural review when:**

- [ ] Total lines exceed: **\_** (suggest 1,000)
- [ ] File count exceeds: **\_** (suggest 5)
- [ ] A feature requires modifying 3+ files
- [ ] The extension model proves inadequate
- [ ] State management becomes unclear

**Scheduled review:**

- [ ] After initial implementation
- [ ] After first major feature addition
- [ ] Every [N] months

---

### 8. Anti-Pattern Watchlist

**Red flags to monitor:**

- [ ] Callback interface growing
- [ ] Files extracted for size, not abstraction
- [ ] "Just add it here for now" decisions
- [ ] State accessed via closures
- [ ] Features requiring core modifications
- [ ] Test setup exceeding 50 lines

---

## Sign-Off

- [ ] Responsibility contract is clear
- [ ] Extension model defined
- [ ] State management explicit
- [ ] File structure planned
- [ ] Testing strategy viable
- [ ] Review triggers set

**Designer:** **\*\***\_\_\_**\*\***  
**Reviewer:** **\*\***\_\_\_**\*\***  
**Date:** **\*\***\_\_\_**\*\***
