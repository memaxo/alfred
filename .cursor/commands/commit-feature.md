# Commit Feature

## Overview
Commit changes following ALFRED's conventional commit format and best practices.

## Pre-Commit Checklist

### 1. Verify Changes
```bash
git status
git diff --stat
```

### 2. Check Quality
- [ ] Tests passing: `bun test <relevant-path>`
- [ ] Lints clean: Use ReadLints tool
- [ ] No unintended changes in diff

### 3. Review Staged Files
Only stage files related to this feature:
```bash
git add <specific-files>
```

## Commit Message Format

### Structure
```
<type>(<scope>): <description>

<body>

<footer>
```

### Types
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `refactor` - Code change without feature/fix
- `test` - Adding/updating tests
- `chore` - Maintenance tasks

### Scopes (ALFRED-specific)
- `agent` - packages/agent
- `api` - packages/api
- `db` - packages/db
- `web` - apps/web
- `voice` - packages/voice
- `runtime` - packages/runtime
- `auth` - packages/auth

### Description
- Imperative mood: "add" not "added" or "adds"
- Lowercase first letter
- No period at end
- Max 50 characters

### Body (optional)
- Explain what and why, not how
- Wrap at 72 characters
- Blank line between subject and body

### Footer (optional)
- `Resolves: ALF-XXX` - Links to Linear issue
- `Breaking: <description>` - For breaking changes

## Examples

### Simple Feature
```bash
git commit -m "feat(agent): add RAG document management tools"
```

### Feature with Details
```bash
git commit -m "$(cat <<'EOF'
feat(agent): add RAG document management tools

Add four new agent tools for RAG document management:
- rag_ingest: Save documents to RAG
- rag_query: Semantic search over documents
- rag_list: List ingested documents
- rag_delete: Remove documents with confirmation

Resolves: ALF-127
EOF
)"
```

### Documentation
```bash
git commit -m "docs: add agent tool development patterns"
```

### Bug Fix
```bash
git commit -m "fix(api): handle null session in auth middleware"
```

## Post-Commit

1. **Verify commit**
   ```bash
   git log -1 --stat
   ```

2. **Push if ready**
   ```bash
   git push
   ```

3. **Update Linear** (if applicable)
   - Move ticket to appropriate status
   - Add comment with commit reference
