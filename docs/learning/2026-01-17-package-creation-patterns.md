# Codified Learning Summary

**Date:** 2026-01-17  
**Context:** Package creation (@alfred/resilience), documentation (GenUI usage guide), and ticket updates (Linear ALF-338, ALF-339, ALF-303, ALF-346)

## What Was Learned

### 1. Package Creation Patterns (Critical)

**Discovery:** Creating a new package has many subtle requirements that are easy to get wrong.

**Key Issues Found:**
- Missing `.js` extensions in `index.ts` exports breaks ESM compatibility
- Using `"typescript": "catalog:"` fails in package-specific devDependencies
- Relative paths to tsconfig base (`../tsconfig/tsconfig.json`) work better than aliases
- Class properties should be `readonly` unless mutation is explicitly needed
- Functions that only return Promises shouldn't be marked `async`

**Impact:** Without these patterns, packages fail typecheck or have runtime ESM issues.

**Codified In:** `.ruler/51-package-creation.md`

### 2. Documentation Quality Standards

**Discovery:** User-facing documentation needs different structure than implementation docs.

**Key Patterns:**
- Quick start must be in first 3 paragraphs (copy-pasteable)
- Progressive complexity: Quick Start → Patterns → Advanced → API Reference
- Every feature doc needs a debugging section with common errors
- Migration guides essential when introducing new patterns
- Link to test files for comprehensive examples (don't duplicate)

**Impact:** Without this structure, users can't adopt features without asking questions.

**Codified In:** `.ruler/52-ticket-and-doc-updates.md`

### 3. Ticket Update Evidence Standards

**Discovery:** Vague "implemented" comments waste reviewer time.

**Key Requirements:**
- List specific file paths (created vs modified)
- Include commit SHAs for direct code review
- State exact test counts ("15 tests covering X, Y, Z")
- Document deviations from original scope
- Use evidence template for consistency

**Impact:** Reviewers can verify work without searching through git history.

**Codified In:** `.ruler/52-ticket-and-doc-updates.md`

### 4. Code Quality Micro-Patterns

**Discovery:** Your corrections revealed patterns that should be automatic.

**Specific Corrections Made:**
1. `readonly` modifiers on class properties that don't mutate
2. Removed `async` from `raceWithAbort` (only returns Promise)
3. Added `.js` extensions to all exports in `index.ts`
4. Alphabetized exports for merge conflict reduction
5. Multi-line type signatures for long function types

**Why These Matter:**
- `readonly` prevents accidental mutation bugs at compile time
- Removing redundant `async` reduces overhead and improves stack traces
- `.js` extensions required by Node ESM loader (TypeScript resolution doesn't help)
- Alphabetized exports reduce git conflicts when multiple people edit

**Codified In:** `.ruler/53-code-quality-corrections.md`

## Patterns to Prevent Future Issues

### Before Creating a Package

1. ✅ Read `.ruler/51-package-creation.md` template
2. ✅ Create `package.json`, `tsconfig.json`, `turbo.json`, `README.md` first
3. ✅ Use validation checklist before first commit
4. ✅ Run `bun install && bun run typecheck` before writing any code

### Before Closing a Ticket

1. ✅ Use evidence template from `.ruler/52-ticket-and-doc-updates.md`
2. ✅ Include commit SHAs, file paths, and test counts
3. ✅ Create user-facing docs with quick start if applicable
4. ✅ Test documentation examples on copy-paste

### Before Committing Code

1. ✅ Check `.ruler/53-code-quality-corrections.md` for patterns
2. ✅ Mark class properties `readonly` unless mutation needed
3. ✅ Remove `async` if function only returns Promise
4. ✅ Add `.js` extensions to all exports
5. ✅ Alphabetize exports in `index.ts`

## Generalized Prevention Strategy

**The Core Issue:** Subtle requirements that are easy to miss.

**The Solution:** Codify them as checklists that agents and humans follow.

**How It Works:**
1. Agent encounters an issue (e.g., missing `.js` extensions)
2. Human corrects it (your diff shows the fix)
3. Agent reflects on pattern (this document)
4. Agent codifies as rule with examples (`.ruler/*.md`)
5. Agent regenerates `AGENTS.md` (ruler:apply)
6. Future agents follow the rule automatically

**Verification:**
- Rules include both ✅ correct and ❌ wrong examples
- Rationale explains why pattern matters (not just "do this")
- Validation checklists make it easy to verify compliance
- Architecture docs show integration patterns

## Files Created/Modified

### New Ruler Documents
- `.ruler/51-package-creation.md` - Package structure standards
- `.ruler/52-ticket-and-doc-updates.md` - Documentation and ticket evidence
- `.ruler/53-code-quality-corrections.md` - TypeScript quality patterns

### Architecture Documentation
- `docs/architecture/resilience-package.md` - Complete package architecture guide

### Generated
- `AGENTS.md` - Regenerated with new rules

## Measurement of Success

These patterns are successful if:

1. **Next package creation** requires zero corrections for these issues
2. **Next ticket update** includes evidence without being asked
3. **Next documentation** has quick start that works on copy-paste
4. **Code reviews** don't flag readonly/async/extensions issues

## References for Future Work

When creating future packages, read in order:

1. `.ruler/51-package-creation.md` - Structure and validation
2. `docs/architecture/resilience-package.md` - Example of complete architecture
3. `.ruler/52-ticket-and-doc-updates.md` - Evidence standards
4. `.ruler/53-code-quality-corrections.md` - Quality checklist

This creates a feedback loop where each correction improves future work.
