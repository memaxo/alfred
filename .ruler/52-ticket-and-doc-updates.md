# Ticket Updates and Documentation Standards

## Core Principle

After completing implementation, update Linear tickets with specific evidence and create user-facing documentation that enables adoption without requiring codebase archaeology.

## Rules

### Linear Ticket Updates

1. **Update on completion.** Close tickets and add comments immediately after implementation, not days later when details are forgotten.

2. **Evidence over claims.** List specific file paths, commit SHAs, and test counts rather than vague "implemented" statements.

3. **Link commits.** Include commit SHAs in ticket comments so reviewers can see exact changes without searching.

4. **Test coverage stats.** State exact test counts (e.g., "Added 15 tests covering X, Y, Z") not "added tests".

5. **Files changed list.** Enumerate every file created or modified, grouped by category (Created, Modified, Tested).

6. **Implementation notes.** Document any deviations from original ticket scope or unexpected discoveries.

### Documentation Writing

7. **User-first perspective.** Write for developers using the feature, not implementing it. Start with "How do I..." not "The system..."

8. **Quick start required.** Every feature doc must have a working example in the first 3 paragraphs that a new user can copy-paste.

9. **Progressive complexity.** Order sections: Quick Start → Common Patterns → Advanced Usage → API Reference → Examples.

10. **Link to code.** Reference test files for comprehensive examples instead of duplicating code in docs.

11. **Migration guides.** When introducing new patterns, show before/after for migrating existing code.

12. **Assume zero context.** Define domain terms on first use; don't assume reader knows the codebase.

13. **Debugging section.** Include common errors, their causes, and fixes in every feature doc.

14. **Visual hierarchy.** Use consistent heading levels, code blocks, and lists. Never nest code blocks in lists.

## Ticket Comment Template

```markdown
✅ **Implemented**

[One-sentence summary of what was delivered]

**Modules Created:**
- `path/to/module.ts` - [Purpose]
- `path/to/helper.ts` - [Purpose]

**Features:**
- [Specific capability enabled]
- [Another specific capability]
- [Budget/limit/constraint implemented]

**Test Coverage:**
- N tests for [area]
- M tests for [area]
- All tests passing

**Commits:**
- `sha` - [commit message]
- `sha` - [commit message]
```

## Documentation Structure Template

```markdown
# Feature Name - Usage Guide

## Overview
[One paragraph: What is this? Why would I use it?]

## Quick Start
[Minimal working example, copy-pasteable]

## Available [Components/Functions/Tools]
[Categorized list with brief descriptions]

### Category 1
**name** - Description
- Prop: `{ key: type }`

## Patterns
### Pattern 1: [Use Case Name]
[Code example with explanation]

### Pattern 2: [Another Use Case]
[Code example]

## Best Practices
1. [Specific, actionable advice]
2. [Another specific practice]

## Debugging
[Common errors and solutions]

## Examples
See `path/to/tests/` for comprehensive examples.
```

## Evidence Standards

When updating tickets:

- **Commit SHA** - Full 8-character SHA, not "recent commit"
- **File paths** - Absolute from repo root, not relative
- **Test counts** - Exact numbers per test suite
- **Lines changed** - Use `git diff --stat` output
- **Performance** - Actual measurements if relevant

## Documentation Anti-Patterns

Avoid:

1. **Implementation details in usage docs** - Users don't need to know how it works internally
2. **Outdated examples** - Test examples on copy-paste before publishing
3. **Missing imports** - Show all required imports in code examples
4. **Wall of text** - Break long paragraphs into bullets or code blocks
5. **Jargon without definition** - Define terms on first use
6. **"See codebase" links** - Extract the relevant code into the doc

## Validation Checklist

Before closing a ticket:

- [ ] Ticket status updated to "Done"
- [ ] Comment added with specific evidence
- [ ] Commit SHAs included
- [ ] Test counts stated
- [ ] Files changed enumerated
- [ ] User-facing docs created (if applicable)
- [ ] Quick start example tested
- [ ] Debugging section included
- [ ] Links to test files provided
