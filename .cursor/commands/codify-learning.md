# Codify Learning

## Overview

After completing a significant implementation, reflect on what patterns emerged and codify them in documentation and rules. This ensures learnings benefit future development.

## When to Use

- After implementing a new feature type (tool, router, component)
- When you discover a pattern that should be repeated
- After fixing a subtle bug with a non-obvious solution
- When existing documentation is incomplete or misleading

## Reflection Questions

### 1. What patterns emerged?

- What file structure did you use? Why?
- What conventions did you follow?
- What dependencies did you wire together?
- What testing approach worked?

### 2. What was non-obvious?

- What took longer than expected?
- What existing code did you have to read to understand?
- What would have helped if documented?

### 3. What should be repeatable?

- Is this a one-off or a pattern others will follow?
- Are there multiple correct approaches, or one canonical way?
- What mistakes should future developers avoid?

## Documentation Targets

### `.ruler/` Rules (for agent instructions)

Create new rule file if:

- Pattern applies to multiple scenarios
- AI agents should follow this automatically
- Convention should be enforced

Format: Short, numbered rules (see existing `.ruler/*.md` files)

### `docs/architecture/` (for humans)

Update or create doc if:

- Architecture decision was made
- System design should be understood
- Operational knowledge is needed

Format: Purpose, structure, key decisions, examples

### `docs/execplans/` (for tracking)

Create ExecPlan if:

- Work spans multiple sessions
- Progress should be tracked
- Others may need to continue the work

## Codification Steps

1. **Identify the pattern** - What did you learn that's generalizable?

2. **Check existing docs** - Is this already documented? Update vs create?

3. **Write concise rules** - For `.ruler/`, keep rules short and numbered

4. **Update architecture docs** - For `docs/`, include examples

5. **Run ruler:apply** - Regenerate AGENTS.md after `.ruler/` changes

   ```bash
   bun run ruler:apply
   ```

6. **Commit documentation** - Separate commit for docs
   ```bash
   git add .ruler/ docs/ AGENTS.md
   git commit -m "docs: codify <pattern> patterns from <feature>"
   ```

## Example Output

From implementing RAG tools, I created:

- `.ruler/34-agent-tools.md` - 20 rules for tool development
- Updated `docs/architecture/packages.md` - Added RAG folder structure
- Updated `docs/architecture/tool-security-patterns.md` - Added RAG examples
