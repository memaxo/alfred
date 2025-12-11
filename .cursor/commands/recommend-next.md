# Recommend Next Steps

## Overview
Analyze the current state of work and recommend concrete next steps. Prioritize by impact and logical sequence.

## Analysis Steps

### 1. Review Recent Changes
Check what was just completed:
```bash
git log --oneline -5
git diff HEAD~1 --stat
```

### 2. Check Open Tasks
- Review any active todo list
- Check for incomplete acceptance criteria
- Look for TODO/FIXME comments in changed files

### 3. Identify Gaps
Scan for missing pieces:
- Tests not written
- Documentation not updated
- Error handling incomplete
- Edge cases not covered
- Types not fully specified

### 4. Consider Dependencies
- What else depends on this change?
- What downstream updates are needed?
- Are there related tickets to address?

## Recommendation Format

Present recommendations as a prioritized list:

### High Priority (Do Now)
1. **[Action]**: [Specific task]
   - Why: [Impact/urgency]
   - Files: [Relevant paths]

### Medium Priority (Do Soon)
2. **[Action]**: [Specific task]
   - Why: [Impact/urgency]

### Low Priority (Consider)
3. **[Action]**: [Specific task]
   - Why: [Nice to have]

## Categories to Consider

### Code Quality
- [ ] Add missing type annotations
- [ ] Extract repeated logic
- [ ] Improve error messages
- [ ] Add input validation

### Testing
- [ ] Add unit tests for new code
- [ ] Add integration tests
- [ ] Test error paths
- [ ] Test edge cases

### Documentation
- [ ] Update README
- [ ] Add JSDoc comments
- [ ] Update architecture docs
- [ ] Create/update ruler rules

### Integration
- [ ] Wire up to API routes
- [ ] Add UI components
- [ ] Update client hooks
- [ ] Add metrics/logging

### Cleanup
- [ ] Remove dead code
- [ ] Fix linter warnings
- [ ] Update dependencies
- [ ] Close related tickets

## Output
After analysis, ask: "Would you like me to proceed with [highest priority item]?"
